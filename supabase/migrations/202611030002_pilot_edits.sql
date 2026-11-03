-- VERSÃO PILOTO: edição/anulação compartilhada entre operadores do MESMO turno.
-- Execute após a migração inicial e a correção de GRANTs.
-- ATENÇÃO: exclusões são físicas. Não use com registros reais sem homologação.
-- Os servidores do Supabase ainda podem ter logs/backups: NÃO promete eliminação forense.
BEGIN;

-- Dados atuais sempre distinguem edição do registro original, sem guardar versões anteriores.
ALTER TABLE public.hourmeter_readings ADD COLUMN IF NOT EXISTS edited boolean NOT NULL DEFAULT false;
ALTER TABLE public.hourmeter_readings ADD COLUMN IF NOT EXISTS revision integer NOT NULL DEFAULT 1;
ALTER TABLE public.production_records ADD COLUMN IF NOT EXISTS edited boolean NOT NULL DEFAULT false;
ALTER TABLE public.production_records ADD COLUMN IF NOT EXISTS revision integer NOT NULL DEFAULT 1;
ALTER TABLE public.downtime_records ADD COLUMN IF NOT EXISTS edited boolean NOT NULL DEFAULT false;
ALTER TABLE public.module_notes ADD COLUMN IF NOT EXISTS edited boolean NOT NULL DEFAULT false;
ALTER TABLE public.module_notes ADD COLUMN IF NOT EXISTS revision integer NOT NULL DEFAULT 1;
ALTER TABLE public.occurrences ADD COLUMN IF NOT EXISTS edited boolean NOT NULL DEFAULT false;
ALTER TABLE public.occurrences ADD COLUMN IF NOT EXISTS revision integer NOT NULL DEFAULT 1;
ALTER TABLE public.handover_notes ADD COLUMN IF NOT EXISTS edited boolean NOT NULL DEFAULT false;
ALTER TABLE public.handover_notes ADD COLUMN IF NOT EXISTS revision integer NOT NULL DEFAULT 1;

-- Preserve autor/data original, marque 'editado' e incremente a versão para evitar concorrência silenciosa.
CREATE OR REPLACE FUNCTION public.stamp_record() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v_name text;
BEGIN
  SELECT full_name INTO v_name FROM public.profiles WHERE id=auth.uid();
  IF TG_OP='INSERT' THEN
    NEW.created_by:=auth.uid(); NEW.operator_name:=v_name; NEW.created_at:=now();
  ELSE
    NEW.id:=OLD.id; NEW.shift_id:=OLD.shift_id;
    NEW.created_by:=OLD.created_by; NEW.operator_name:=OLD.operator_name; NEW.created_at:=OLD.created_at;
    NEW.edited:=true;
    NEW.revision:=OLD.revision+1;
    IF TG_TABLE_NAME='downtime_records' THEN
      NEW.updated_by:=auth.uid(); NEW.updated_by_name:=v_name; NEW.updated_at:=now();
    END IF;
    IF TG_TABLE_NAME='hourmeter_readings' THEN NEW.module_code:=OLD.module_code; END IF;
    IF TG_TABLE_NAME='module_notes' THEN NEW.module_code:=OLD.module_code; END IF;
  END IF;
  RETURN NEW;
END; $$;

-- Ativar proteção de metadados na atualização e validação do horímetro também em correções.
DROP TRIGGER IF EXISTS meter_stamp ON public.hourmeter_readings;
CREATE TRIGGER meter_stamp BEFORE INSERT OR UPDATE ON public.hourmeter_readings FOR EACH ROW EXECUTE FUNCTION public.stamp_record();
DROP TRIGGER IF EXISTS meter_validate ON public.hourmeter_readings;
CREATE TRIGGER meter_validate BEFORE INSERT OR UPDATE ON public.hourmeter_readings FOR EACH ROW EXECUTE FUNCTION public.validate_hourmeter();
DROP TRIGGER IF EXISTS production_stamp ON public.production_records;
CREATE TRIGGER production_stamp BEFORE INSERT OR UPDATE ON public.production_records FOR EACH ROW EXECUTE FUNCTION public.stamp_record();
DROP TRIGGER IF EXISTS module_notes_stamp ON public.module_notes;
CREATE TRIGGER module_notes_stamp BEFORE INSERT OR UPDATE ON public.module_notes FOR EACH ROW EXECUTE FUNCTION public.stamp_record();
DROP TRIGGER IF EXISTS occurrence_stamp ON public.occurrences;
CREATE TRIGGER occurrence_stamp BEFORE INSERT OR UPDATE ON public.occurrences FOR EACH ROW EXECUTE FUNCTION public.stamp_record();
DROP TRIGGER IF EXISTS handover_stamp ON public.handover_notes;
CREATE TRIGGER handover_stamp BEFORE INSERT OR UPDATE ON public.handover_notes FOR EACH ROW EXECUTE FUNCTION public.stamp_record();

-- Só participantes autenticados do turno ATUAL, se ele continuar ABERTO.
-- RLS vale igualmente para registros do próprio operador e de colegas do mesmo turno.
CREATE POLICY "Piloto editar horimetros" ON public.hourmeter_readings FOR UPDATE TO authenticated
  USING (public.can_edit_shift(shift_id)) WITH CHECK (public.can_edit_shift(shift_id));
CREATE POLICY "Piloto anular horimetros" ON public.hourmeter_readings FOR DELETE TO authenticated
  USING (public.can_edit_shift(shift_id));
CREATE POLICY "Piloto editar producao" ON public.production_records FOR UPDATE TO authenticated
  USING (public.can_edit_shift(shift_id)) WITH CHECK (public.can_edit_shift(shift_id));
CREATE POLICY "Piloto anular producao" ON public.production_records FOR DELETE TO authenticated
  USING (public.can_edit_shift(shift_id));
CREATE POLICY "Piloto anular paradas" ON public.downtime_records FOR DELETE TO authenticated
  USING (public.can_edit_shift(shift_id));
CREATE POLICY "Piloto editar ocorrencias" ON public.occurrences FOR UPDATE TO authenticated
  USING (public.can_edit_shift(shift_id)) WITH CHECK (public.can_edit_shift(shift_id));
CREATE POLICY "Piloto anular ocorrencias" ON public.occurrences FOR DELETE TO authenticated
  USING (public.can_edit_shift(shift_id));
CREATE POLICY "Piloto editar notas modulo" ON public.module_notes FOR UPDATE TO authenticated
  USING (public.can_edit_shift(shift_id)) WITH CHECK (public.can_edit_shift(shift_id));
CREATE POLICY "Piloto anular notas modulo" ON public.module_notes FOR DELETE TO authenticated
  USING (public.can_edit_shift(shift_id));
CREATE POLICY "Piloto editar notas passagem" ON public.handover_notes FOR UPDATE TO authenticated
  USING (public.can_edit_shift(shift_id)) WITH CHECK (public.can_edit_shift(shift_id));
CREATE POLICY "Piloto anular notas passagem" ON public.handover_notes FOR DELETE TO authenticated
  USING (public.can_edit_shift(shift_id));
CREATE POLICY "Piloto anular checklist" ON public.checklist_responses FOR DELETE TO authenticated
  USING (public.can_edit_shift(shift_id));

GRANT UPDATE, DELETE ON TABLE public.hourmeter_readings, public.production_records,
  public.downtime_records, public.occurrences, public.module_notes,
  public.handover_notes TO authenticated;
GRANT DELETE ON TABLE public.checklist_responses TO authenticated;

-- A edição de uma ocorrência pode criar, atualizar ou remover sua pendência vinculada.
-- IMPORTANTE: pendências resolvidas não podem ser descaracterizadas via edição do registro.
CREATE OR REPLACE FUNCTION public.sync_pilot_issue() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v_origin text; v_origin_id uuid; v_existing public.issues; v_pending boolean; v_description text; v_photo text;
BEGIN
  v_origin:=CASE WHEN TG_TABLE_NAME='occurrences' THEN 'ocorrencia' ELSE 'checklist' END;
  v_origin_id:=CASE WHEN TG_OP='DELETE' THEN OLD.id ELSE NEW.id END;
  SELECT * INTO v_existing FROM public.issues WHERE origin=v_origin AND origin_id=v_origin_id ORDER BY created_at DESC LIMIT 1;
  IF TG_OP='DELETE' THEN
    IF v_existing.id IS NOT NULL AND v_existing.status='resolvida' THEN RAISE EXCEPTION 'Pendência resolvida: não é possível anular o registro de origem'; END IF;
    DELETE FROM public.issues WHERE origin=v_origin AND origin_id=v_origin_id;
    RETURN OLD;
  END IF;
  v_pending:=CASE WHEN TG_TABLE_NAME='occurrences' THEN NEW.generate_pending ELSE NEW.status='anomalia' END;
  v_description:=CASE WHEN TG_TABLE_NAME='occurrences' THEN NEW.description ELSE NEW.detail END;
  v_photo:=NEW.photo_path;
  IF v_existing.id IS NOT NULL AND v_existing.status='resolvida' THEN
    IF NOT v_pending OR v_existing.description IS DISTINCT FROM v_description THEN
      RAISE EXCEPTION 'Pendência resolvida: não altere ou anule o registro sem revisão administrativa';
    END IF;
    RETURN NEW;
  END IF;
  IF NOT v_pending THEN
    DELETE FROM public.issues WHERE origin=v_origin AND origin_id=v_origin_id;
  ELSIF v_existing.id IS NULL THEN
    INSERT INTO public.issues (shift_id,origin,origin_id,module_code,item_index,description,photo_path,created_by,operator_name)
    VALUES (NEW.shift_id,v_origin,NEW.id,
      CASE WHEN TG_TABLE_NAME='checklist_responses' THEN NEW.module_code ELSE null END,
      CASE WHEN TG_TABLE_NAME='checklist_responses' THEN NEW.item_index ELSE null END,
      v_description,v_photo,
      CASE WHEN TG_TABLE_NAME='checklist_responses' THEN NEW.updated_by ELSE NEW.created_by END,
      CASE WHEN TG_TABLE_NAME='checklist_responses' THEN NEW.updated_by_name ELSE NEW.operator_name END);
  ELSE
    -- Não muda status da pendência; somente atualiza descrição/foto no vínculo.
    UPDATE public.issues SET description=v_description,photo_path=v_photo WHERE id=v_existing.id;
  END IF;
  RETURN NEW;
END; $$;

-- Permitir sincronização interna da descrição de pendências pela trigger da origem.
CREATE OR REPLACE FUNCTION public.stamp_issue_update() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
  NEW.id:=OLD.id; NEW.shift_id:=OLD.shift_id; NEW.origin:=OLD.origin;
  NEW.origin_id:=OLD.origin_id; NEW.created_at:=OLD.created_at;
  NEW.created_by:=OLD.created_by; NEW.operator_name:=OLD.operator_name;
  NEW.module_code:=OLD.module_code; NEW.item_index:=OLD.item_index;
  IF pg_trigger_depth() <= 1 THEN
    NEW.description:=OLD.description; NEW.photo_path:=OLD.photo_path;
  END IF;
  IF OLD.status='resolvida' THEN RAISE EXCEPTION 'Pendência resolvida não pode ser alterada'; END IF;
  IF NEW.status='resolvida' THEN
    IF length(trim(coalesce(NEW.solution,'')))<3 THEN RAISE EXCEPTION 'Descreva a solução'; END IF;
    IF OLD.status<>'resolvida' THEN
      NEW.resolved_at:=now(); NEW.resolved_by:=auth.uid();
      SELECT full_name INTO NEW.resolved_by_name FROM public.profiles WHERE id=auth.uid();
    END IF;
  ELSE
    NEW.solution:=null; NEW.resolved_at:=null; NEW.resolved_by:=null; NEW.resolved_by_name:=null;
  END IF;
  NEW.revision:=OLD.revision+1; NEW.updated_at:=now(); RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS checklist_issue ON public.checklist_responses;
DROP TRIGGER IF EXISTS occurrence_issue ON public.occurrences;
CREATE TRIGGER pilot_checklist_issue AFTER INSERT OR UPDATE OR DELETE ON public.checklist_responses FOR EACH ROW EXECUTE FUNCTION public.sync_pilot_issue();
CREATE TRIGGER pilot_occurrence_issue AFTER INSERT OR UPDATE OR DELETE ON public.occurrences FOR EACH ROW EXECUTE FUNCTION public.sync_pilot_issue();

-- Nesta fase de testes, não gerar histórico de edição/anulação para registros operacionais.
-- A auditoria de alterações administrativas permanece separada.
DROP TRIGGER IF EXISTS audit_module_states ON public.module_states;
DROP TRIGGER IF EXISTS audit_checklist ON public.checklist_responses;
DROP TRIGGER IF EXISTS audit_module_notes ON public.module_notes;
DROP TRIGGER IF EXISTS audit_meters ON public.hourmeter_readings;
DROP TRIGGER IF EXISTS audit_production ON public.production_records;
DROP TRIGGER IF EXISTS audit_downtime ON public.downtime_records;
DROP TRIGGER IF EXISTS audit_occurrences ON public.occurrences;
DROP TRIGGER IF EXISTS audit_issues ON public.issues;
DROP TRIGGER IF EXISTS audit_handover_notes ON public.handover_notes;

-- Eventos legados de auditoria (que já existiam) ficam restritos ao Configurador,
-- nunca acessíveis pela conta de operador no histórico comum nem pela API autenticada.
DROP POLICY IF EXISTS "Auditoria ler" ON public.audit_events;
DROP POLICY IF EXISTS "Auditoria somente configurador" ON public.audit_events;
CREATE POLICY "Auditoria somente configurador" ON public.audit_events FOR SELECT TO authenticated
  USING (public.is_configurator());

-- O encerramento quando condições alteradas não depende mais da trilha de auditoria.
CREATE OR REPLACE FUNCTION public.close_shift(p_shift_id uuid,p_final_condition text,p_notes text,p_changes_confirmed boolean DEFAULT false,p_late_reason text DEFAULT null)
RETURNS public.shifts LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v_shift public.shifts; v_now timestamp; v_end timestamp; v_name text;
BEGIN
  IF NOT public.is_operator() THEN RAISE EXCEPTION 'Sem autorização'; END IF;
  IF p_final_condition NOT IN ('mantidas','alteradas') THEN RAISE EXCEPTION 'Selecione as condições finais'; END IF;
  IF p_final_condition='alteradas' AND NOT COALESCE(p_changes_confirmed,false) THEN RAISE EXCEPTION 'Atualize e confirme os itens alterados'; END IF;
  IF p_final_condition='alteradas' AND NOT EXISTS(
    SELECT 1 FROM public.checklist_responses WHERE shift_id=p_shift_id AND revision>1
  ) THEN RAISE EXCEPTION 'Atualize os itens alterados antes de finalizar'; END IF;
  SELECT * INTO v_shift FROM public.shifts WHERE id=p_shift_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Turno inexistente'; END IF;
  IF v_shift.status='encerrado' THEN RAISE EXCEPTION 'Turno já encerrado'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.shift_participants WHERE shift_id=p_shift_id AND operator_id=auth.uid()) THEN
    RAISE EXCEPTION 'Somente um participante pode encerrar este turno'; END IF;
  v_now:=now() AT TIME ZONE 'America/Sao_Paulo';
  v_end:=v_shift.shift_date::timestamp+CASE WHEN v_shift.kind='diurno' THEN interval '19 hours' ELSE interval '31 hours' END;
  IF v_now>=v_end AND length(trim(coalesce(p_late_reason,'')))<5 THEN RAISE EXCEPTION 'Informe a justificativa do encerramento tardio'; END IF;
  IF v_now<v_end AND NOT public.is_current_shift(p_shift_id) THEN RAISE EXCEPTION 'Não é possível encerrar turno futuro'; END IF;
  SELECT full_name INTO v_name FROM public.profiles WHERE id=auth.uid();
  UPDATE public.shifts SET status='encerrado',closed_by=auth.uid(),closed_by_name=v_name,closed_at=now(),
    final_condition=p_final_condition,close_notes=nullif(trim(p_notes),''),late_reason=nullif(trim(p_late_reason),'')
    WHERE id=p_shift_id RETURNING * INTO v_shift;
  RETURN v_shift;
END; $$;

COMMIT;
-- Resultado esperado: Success. No rows returned.
