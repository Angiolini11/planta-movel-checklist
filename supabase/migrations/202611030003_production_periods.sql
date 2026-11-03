-- PLANTA MÓVEL: horários de início/término das atividades de produção.
-- Execute uma única vez no SQL Editor, após as migrações anteriores.
-- Não apaga nem altera registros existentes: horários antigos permanecem NULL.
-- Campos opcionais (podem ser preenchidos posteriormente via edição no site).
BEGIN;

ALTER TABLE public.production_records
  ADD COLUMN IF NOT EXISTS starts_at timestamptz,
  ADD COLUMN IF NOT EXISTS ends_at timestamptz;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname='production_period_order' AND conrelid='public.production_records'::regclass
  ) THEN
    ALTER TABLE public.production_records
      ADD CONSTRAINT production_period_order
      CHECK (starts_at IS NULL OR ends_at IS NULL OR ends_at >= starts_at);
  END IF;
END;
$$;

-- Garante no banco que a atividade pertence ao seu turno, mesmo se houver
-- requisições externas à interface. Datas são calculadas em São Paulo.
CREATE OR REPLACE FUNCTION public.check_production_shift_period()
RETURNS trigger LANGUAGE plpgsql SET search_path=public AS $$
DECLARE
  v_date date;
  v_kind text;
  v_begin timestamptz;
  v_finish timestamptz;
BEGIN
  SELECT shift_date, kind INTO v_date, v_kind
  FROM public.shifts WHERE id = NEW.shift_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Turno inexistente';
  END IF;
  v_begin := (v_date::timestamp + CASE WHEN v_kind='diurno'
                 THEN INTERVAL '7 hours' ELSE INTERVAL '19 hours' END)
             AT TIME ZONE 'America/Sao_Paulo';
  v_finish := (v_date::timestamp + CASE WHEN v_kind='diurno'
                 THEN INTERVAL '19 hours' ELSE INTERVAL '31 hours' END)
             AT TIME ZONE 'America/Sao_Paulo';
  IF (NEW.starts_at IS NOT NULL AND (NEW.starts_at < v_begin OR NEW.starts_at > v_finish))
     OR (NEW.ends_at IS NOT NULL AND (NEW.ends_at < v_begin OR NEW.ends_at > v_finish)) THEN
    RAISE EXCEPTION 'Horário da produção fora do turno selecionado';
  END IF;
  IF NEW.starts_at IS NOT NULL AND NEW.ends_at IS NOT NULL AND NEW.ends_at < NEW.starts_at THEN
    RAISE EXCEPTION 'Término da produção anterior ao início';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS production_shift_period_validate ON public.production_records;
CREATE TRIGGER production_shift_period_validate
  BEFORE INSERT OR UPDATE ON public.production_records
  FOR EACH ROW EXECUTE FUNCTION public.check_production_shift_period();

COMMIT;

-- Conferência: ambas as colunas devem constar no resultado desta consulta.
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_schema='public'
  AND table_name='production_records'
  AND column_name IN ('starts_at','ends_at')
ORDER BY column_name;
