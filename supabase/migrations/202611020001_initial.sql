-- PLANTA MÓVEL — MVP. Executar no SQL Editor de um projeto Supabase novo.
-- Segurança: RLS ativo, escrita vinculada à sessão/turno. Não publicar service_role.
create extension if not exists pgcrypto;

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  matricula text not null unique check (matricula ~ '^[A-Za-z0-9._-]{3,40}$'),
  full_name text not null check (char_length(trim(full_name)) between 3 and 120),
  auth_email text not null unique,
  role text not null default 'operador' check (role in ('operador','configurador')),
  created_at timestamptz not null default now()
);
create table public.auth_login_attempts (
  id bigint generated always as identity primary key,
  matricula text not null,
  success boolean not null default false,
  created_at timestamptz not null default now()
);
create index auth_attempts_lookup on public.auth_login_attempts (matricula, created_at desc);

create table public.shifts (
  id uuid primary key default gen_random_uuid(),
  shift_date date not null,
  kind text not null check (kind in ('diurno','noturno')),
  status text not null default 'aberto' check (status in ('aberto','encerrado')),
  closed_by uuid references public.profiles(id),
  closed_by_name text,
  closed_at timestamptz,
  final_condition text check (final_condition in ('mantidas','alteradas')),
  close_notes text,
  late_reason text,
  created_at timestamptz not null default now(),
  unique(shift_date,kind)
);
create index shifts_date_idx on public.shifts(shift_date desc,kind);

create table public.shift_participants (
  id uuid primary key default gen_random_uuid(),
  shift_id uuid not null references public.shifts(id),
  operator_id uuid not null references public.profiles(id),
  operator_name text not null,
  joined_at timestamptz not null default now(),
  unique(shift_id,operator_id)
);

create table public.module_states (
  id uuid primary key default gen_random_uuid(),
  shift_id uuid not null references public.shifts(id),
  module_code text not null check (module_code in ('QJ341','QH441','QA452')),
  condition text not null check (condition in ('em_operacao','nao_utilizado','em_manutencao','indisponivel')),
  reason text,
  revision integer not null default 1,
  updated_by uuid references public.profiles(id),
  updated_by_name text,
  updated_at timestamptz not null default now(),
  unique(shift_id,module_code),
  check (condition='em_operacao' or length(trim(coalesce(reason,''))) >= 3)
);

create table public.checklist_responses (
  id uuid primary key default gen_random_uuid(),
  shift_id uuid not null references public.shifts(id),
  module_code text not null check (module_code in ('QJ341','QH441','QA452')),
  item_index integer not null check (item_index between 1 and 8),
  status text not null check (status in ('conforme','anomalia','nao_aplica','nao_verificado')),
  detail text,
  photo_path text,
  revision integer not null default 1,
  updated_by uuid references public.profiles(id),
  updated_by_name text,
  updated_at timestamptz not null default now(),
  unique(shift_id,module_code,item_index),
  check (status='conforme' or char_length(trim(coalesce(detail,''))) >= 3)
);
create index checklist_shift on public.checklist_responses(shift_id,module_code);

create table public.module_notes (
  id uuid primary key default gen_random_uuid(),
  shift_id uuid not null references public.shifts(id),
  module_code text not null check (module_code in ('QJ341','QH441','QA452')),
  body text not null check (length(trim(body)) >= 3),
  created_by uuid references public.profiles(id),
  operator_name text,
  created_at timestamptz not null default now()
);

create table public.hourmeter_readings (
  id uuid primary key default gen_random_uuid(),
  shift_id uuid not null references public.shifts(id),
  module_code text not null check (module_code in ('QJ341','QH441','QA452')),
  reading_type text not null check (reading_type in ('inicial','final')),
  value numeric(15,2) not null check (value >= 0),
  created_by uuid references public.profiles(id),
  operator_name text,
  created_at timestamptz not null default now()
);
create index hourmeter_shift on public.hourmeter_readings(shift_id,module_code,created_at desc);

create table public.production_records (
  id uuid primary key default gen_random_uuid(),
  shift_id uuid not null references public.shifts(id),
  material text not null check (material in ('Hematita Bocaina','Hematitinha','Granulado','Outro')),
  other_material text,
  modules text[] not null check (array_length(modules,1) between 1 and 3 and modules <@ array['QJ341','QH441','QA452']::text[]),
  tonnage numeric(15,2) check (tonnage >= 0),
  notes text,
  created_by uuid references public.profiles(id),
  operator_name text,
  created_at timestamptz not null default now(),
  check (material <> 'Outro' or length(trim(coalesce(other_material,''))) >= 2)
);

create table public.downtime_records (
  id uuid primary key default gen_random_uuid(),
  shift_id uuid not null references public.shifts(id),
  affected text not null check (affected in ('QJ341','QH441','QA452','Planta inteira')),
  reason text not null check (length(trim(reason)) >= 3),
  starts_at timestamptz,
  ends_at timestamptz,
  notes text,
  revision integer not null default 1,
  created_by uuid references public.profiles(id),
  operator_name text,
  created_at timestamptz not null default now(),
  updated_by uuid references public.profiles(id),
  updated_by_name text,
  updated_at timestamptz not null default now(),
  check (starts_at is null or ends_at is null or ends_at >= starts_at)
);

create table public.occurrences (
  id uuid primary key default gen_random_uuid(),
  shift_id uuid not null references public.shifts(id),
  category text not null check (category in ('Movimentação da planta','Posicionamento','Limpeza','Regulagem','Manutenção','Outros')),
  happened_at timestamptz not null,
  description text not null check (length(trim(description)) >= 3),
  photo_path text,
  generate_pending boolean not null default false,
  created_by uuid references public.profiles(id),
  operator_name text,
  created_at timestamptz not null default now()
);

create table public.issues (
  id uuid primary key default gen_random_uuid(),
  shift_id uuid not null references public.shifts(id),
  origin text not null check (origin in ('checklist','ocorrencia')),
  origin_id uuid not null,
  module_code text check (module_code in ('QJ341','QH441','QA452')),
  item_index integer,
  description text not null,
  photo_path text,
  status text not null default 'aberta' check (status in ('aberta','em_acompanhamento','resolvida')),
  revision integer not null default 1,
  solution text,
  created_at timestamptz not null default now(),
  created_by uuid references public.profiles(id),
  operator_name text,
  resolved_at timestamptz,
  resolved_by uuid references public.profiles(id),
  resolved_by_name text,
  updated_at timestamptz not null default now(),
  unique(origin,origin_id,created_at)
);
create index issues_status on public.issues(status,created_at desc);

create table public.handover_notes (
  id uuid primary key default gen_random_uuid(),
  shift_id uuid not null references public.shifts(id),
  body text not null check (length(trim(body)) >= 3),
  created_by uuid references public.profiles(id),
  operator_name text,
  created_at timestamptz not null default now()
);

create table public.equipment_images (
  module_code text primary key check (module_code in ('QJ341','QH441','QA452')),
  storage_path text not null,
  updated_by uuid references public.profiles(id),
  updated_at timestamptz not null default now()
);

create table public.audit_events (
  id bigint generated always as identity primary key,
  shift_id uuid references public.shifts(id),
  entity_table text not null,
  entity_id uuid not null,
  operation text not null,
  old_data jsonb,
  new_data jsonb,
  actor_id uuid,
  actor_name text,
  created_at timestamptz not null default now()
);
create index audit_shift_created on public.audit_events(shift_id,created_at desc);

-- Toda autorização é calculada pelo servidor, nunca por role enviada pelo cliente.
create or replace function public.is_operator() returns boolean language sql stable security definer set search_path = public as $$
  select auth.uid() is not null and exists (select 1 from public.profiles where id=auth.uid());
$$;
create or replace function public.is_configurator() returns boolean language sql stable security definer set search_path = public as $$
  select auth.uid() is not null and exists (select 1 from public.profiles where id=auth.uid() and role='configurador');
$$;
create or replace function public.is_current_shift(p_id uuid) returns boolean language sql stable security definer set search_path = public as $$
  with local_clock as (select now() at time zone 'America/Sao_Paulo' as t),
  ck as (select case when t::time < time '07:00' then (t::date - 1)
                    else t::date end as d,
                   case when t::time >= time '07:00' and t::time < time '19:00'
                        then 'diurno' else 'noturno' end as k from local_clock)
  select exists(select 1 from public.shifts s cross join ck where s.id=p_id and s.shift_date=ck.d and s.kind=ck.k);
$$;
create or replace function public.can_edit_shift(p_id uuid) returns boolean language sql stable security definer set search_path = public as $$
  select public.is_operator() and public.is_current_shift(p_id) and exists(
    select 1 from public.shift_participants p join public.shifts s on s.id=p.shift_id
    where p.shift_id=p_id and p.operator_id=auth.uid() and s.status='aberto');
$$;
create or replace function public.can_answer_module(p_shift_id uuid,p_module_code text,p_item_index integer) returns boolean language sql stable security definer set search_path=public as $$
  select public.can_edit_shift(p_shift_id) and exists (select 1 from public.module_states s
    where s.shift_id=p_shift_id and s.module_code=p_module_code
      and (s.condition='em_operacao' or p_item_index in (1,2,8)));
$$;
create or replace function public.is_on_active_shift() returns boolean language sql stable security definer set search_path = public as $$
  select exists(select 1 from public.shift_participants p join public.shifts s on s.id=p.shift_id
    where p.operator_id=auth.uid() and s.status='aberto' and public.is_current_shift(s.id));
$$;

-- Impede turnos duplicados e ingressos retroativos, inclusive sob concorrência.
create or replace function public.join_current_shift()
returns public.shifts language plpgsql security definer set search_path=public as $$
declare v_date date; v_kind text; v_shift public.shifts; v_name text; v_now timestamp;
begin
  if not public.is_operator() then raise exception 'Sessão não autorizada'; end if;
  v_now := now() at time zone 'America/Sao_Paulo';
  v_date := case when v_now::time < time '07:00' then v_now::date-1 else v_now::date end;
  v_kind := case when v_now::time >= time '07:00' and v_now::time < time '19:00' then 'diurno' else 'noturno' end;
  insert into public.shifts(shift_date,kind) values (v_date,v_kind) on conflict (shift_date,kind) do nothing;
  select * into v_shift from public.shifts where shift_date=v_date and kind=v_kind;
  if v_shift.status <> 'aberto' then return v_shift; end if;
  select full_name into v_name from public.profiles where id=auth.uid();
  insert into public.shift_participants(shift_id,operator_id,operator_name)
  values(v_shift.id,auth.uid(),v_name) on conflict(shift_id,operator_id) do nothing;
  return v_shift;
end; $$;

-- Metadados de autoria/revisão definidos no banco.
create or replace function public.stamp_record() returns trigger language plpgsql security definer set search_path=public as $$
declare v_name text;
begin
  select full_name into v_name from public.profiles where id=auth.uid();
  if TG_OP='INSERT' then
    new.created_by := auth.uid(); new.operator_name := v_name; new.created_at := now();
  else
    new.created_by := old.created_by; new.operator_name := old.operator_name;
    new.created_at := old.created_at;
    new.updated_by := auth.uid(); new.updated_by_name := v_name; new.updated_at := now();
    if TG_TABLE_NAME='downtime_records' then new.revision:=old.revision+1; end if;
  end if;
  return new;
end; $$;
create or replace function public.stamp_module_revision() returns trigger language plpgsql security definer set search_path=public as $$
declare v_name text;
begin
  select full_name into v_name from public.profiles where id=auth.uid();
  new.updated_by:=auth.uid(); new.updated_by_name:=v_name; new.updated_at:=now();
  if TG_OP='UPDATE' then
    new.shift_id:=old.shift_id; new.module_code:=old.module_code;
    if TG_TABLE_NAME='checklist_responses' then new.item_index:=old.item_index; end if;
    new.revision:=old.revision+1;
  else new.revision:=1; end if;
  return new;
end; $$;
create or replace function public.stamp_images() returns trigger language plpgsql security definer set search_path=public as $$
begin
  new.updated_by:=auth.uid(); new.updated_at:=now(); return new;
end; $$;
create trigger module_state_stamp before insert or update on public.module_states for each row execute function public.stamp_module_revision();
create trigger checklist_stamp before insert or update on public.checklist_responses for each row execute function public.stamp_module_revision();
create trigger module_notes_stamp before insert on public.module_notes for each row execute function public.stamp_record();
create trigger meter_stamp before insert on public.hourmeter_readings for each row execute function public.stamp_record();
create or replace function public.validate_hourmeter() returns trigger language plpgsql security definer set search_path=public as $$
declare v_other numeric;
begin
  select value into v_other from public.hourmeter_readings
    where shift_id=new.shift_id and module_code=new.module_code
      and reading_type=(case when new.reading_type='inicial' then 'final' else 'inicial' end)
    order by created_at desc,id desc limit 1;
  if v_other is not null and
    ((new.reading_type='final' and new.value<v_other) or (new.reading_type='inicial' and new.value>v_other)) then
    raise exception 'O horímetro final não pode ser menor que o inicial';
  end if;
  return new;
end; $$;
create trigger meter_validate before insert on public.hourmeter_readings for each row execute function public.validate_hourmeter();
create trigger production_stamp before insert on public.production_records for each row execute function public.stamp_record();
create trigger downtime_stamp before insert or update on public.downtime_records for each row execute function public.stamp_record();
create trigger occurrence_stamp before insert on public.occurrences for each row execute function public.stamp_record();
create trigger handover_stamp before insert on public.handover_notes for each row execute function public.stamp_record();
create trigger images_stamp before insert or update on public.equipment_images for each row execute function public.stamp_images();

-- Questões de checklist e ocorrências criam pendências automaticamente no backend.
create or replace function public.issue_from_checklist() returns trigger language plpgsql security definer set search_path=public as $$
begin
  if new.status='anomalia' then
    if TG_OP='UPDATE' and old.status='anomalia' then return new; end if;
    insert into public.issues(shift_id,origin,origin_id,module_code,item_index,description,photo_path,created_by,operator_name)
    values(new.shift_id,'checklist',new.id,new.module_code,new.item_index,new.detail,new.photo_path,new.updated_by,new.updated_by_name);
  end if;
  return new;
end; $$;
create trigger checklist_issue after insert or update on public.checklist_responses for each row execute function public.issue_from_checklist();
create or replace function public.issue_from_occurrence() returns trigger language plpgsql security definer set search_path=public as $$
begin
  if new.generate_pending then
    insert into public.issues(shift_id,origin,origin_id,description,photo_path,created_by,operator_name)
    values(new.shift_id,'ocorrencia',new.id,new.description,new.photo_path,new.created_by,new.operator_name);
  end if;
  return new;
end; $$;
create trigger occurrence_issue after insert on public.occurrences for each row execute function public.issue_from_occurrence();
create or replace function public.stamp_issue_update() returns trigger language plpgsql security definer set search_path=public as $$
begin
  new.id:=old.id; new.shift_id:=old.shift_id; new.origin:=old.origin;
  new.origin_id:=old.origin_id; new.created_at:=old.created_at;
  new.created_by:=old.created_by; new.operator_name:=old.operator_name;
  new.description:=old.description; new.photo_path:=old.photo_path;
  new.module_code:=old.module_code; new.item_index:=old.item_index;
  if old.status='resolvida' then raise exception 'Pendência resolvida não pode ser alterada'; end if;
  if new.status='resolvida' then
    if length(trim(coalesce(new.solution,''))) < 3 then raise exception 'Descreva a solução'; end if;
    if old.status<>'resolvida' then
      new.resolved_at:=now(); new.resolved_by:=auth.uid();
      select full_name into new.resolved_by_name from public.profiles where id=auth.uid();
    end if;
  else
    new.solution:=null; new.resolved_at:=null; new.resolved_by:=null; new.resolved_by_name:=null;
  end if;
  new.revision:=old.revision+1;
  new.updated_at:=now(); return new;
end; $$;
create trigger issue_stamp before update on public.issues for each row execute function public.stamp_issue_update();

-- Auditoria imutável para inserções e alterações, inclusive após fechamento.
create or replace function public.record_audit() returns trigger language plpgsql security definer set search_path=public as $$
declare v_id uuid; v_shift uuid; v_actor uuid; v_name text;
begin
  v_id := case when TG_OP='DELETE' then old.id else new.id end;
  v_shift := case when TG_OP='DELETE' then old.shift_id else new.shift_id end;
  v_actor:=auth.uid();
  select full_name into v_name from public.profiles where id=v_actor;
  insert into public.audit_events(shift_id,entity_table,entity_id,operation,old_data,new_data,actor_id,actor_name)
  values(v_shift,TG_TABLE_NAME,v_id,TG_OP,
    case when TG_OP='INSERT' then null else to_jsonb(old) end,
    case when TG_OP='DELETE' then null else to_jsonb(new) end,
    v_actor,v_name);
  return coalesce(new,old);
end; $$;
create trigger audit_module_states after insert or update on public.module_states for each row execute function public.record_audit();
create trigger audit_checklist after insert or update on public.checklist_responses for each row execute function public.record_audit();
create trigger audit_module_notes after insert on public.module_notes for each row execute function public.record_audit();
create trigger audit_meters after insert on public.hourmeter_readings for each row execute function public.record_audit();
create trigger audit_production after insert on public.production_records for each row execute function public.record_audit();
create trigger audit_downtime after insert or update on public.downtime_records for each row execute function public.record_audit();
create trigger audit_occurrences after insert on public.occurrences for each row execute function public.record_audit();
create trigger audit_issues after insert or update on public.issues for each row execute function public.record_audit();
create trigger audit_handover_notes after insert on public.handover_notes for each row execute function public.record_audit();
-- Auditoria de substituições de fotografias oficiais (sem guardar bytes de imagens).
create or replace function public.audit_equipment_images() returns trigger language plpgsql security definer set search_path=public as $$
declare v_name text;
begin
  select full_name into v_name from public.profiles where id=auth.uid();
  insert into public.audit_events(entity_table,entity_id,operation,actor_id,actor_name,old_data,new_data)
  values('equipment_images',gen_random_uuid(),TG_OP,auth.uid(),v_name,
    case when TG_OP='INSERT' then null else to_jsonb(old) end,to_jsonb(new));
  return new;
end; $$;
create trigger audit_equipment_images after insert or update on public.equipment_images for each row execute function public.audit_equipment_images();

-- Fechamento exclusivamente por RPC (operador atual ou fechamento tardio justificado).
create or replace function public.close_shift(p_shift_id uuid,p_final_condition text,p_notes text,p_changes_confirmed boolean default false,p_late_reason text default null)
returns public.shifts language plpgsql security definer set search_path=public as $$
declare v_shift public.shifts; v_now timestamp; v_end timestamp; v_name text;
begin
  if not public.is_operator() then raise exception 'Sem autorização'; end if;
  if p_final_condition not in ('mantidas','alteradas') then raise exception 'Selecione as condições finais'; end if;
  if p_final_condition='alteradas' and not coalesce(p_changes_confirmed,false) then raise exception 'Atualize e confirme os itens alterados'; end if;
  if p_final_condition='alteradas' and not exists(select 1 from public.audit_events where shift_id=p_shift_id and entity_table='checklist_responses' and operation='UPDATE') then
    raise exception 'Nenhum item do checklist foi atualizado neste turno. Atualize os itens alterados antes de finalizar';
  end if;
  select * into v_shift from public.shifts where id=p_shift_id for update;
  if not found then raise exception 'Turno inexistente'; end if;
  if v_shift.status='encerrado' then raise exception 'Turno já encerrado'; end if;
  if not exists(select 1 from public.shift_participants where shift_id=p_shift_id and operator_id=auth.uid()) then
    raise exception 'Somente um participante pode encerrar este turno';
  end if;
  v_now:=now() at time zone 'America/Sao_Paulo';
  v_end:=v_shift.shift_date::timestamp + case when v_shift.kind='diurno' then interval '19 hours' else interval '31 hours' end;
  if v_now >= v_end and length(trim(coalesce(p_late_reason,''))) < 5 then
    raise exception 'Informe a justificativa do encerramento tardio';
  end if;
  if v_now < v_end and not public.is_current_shift(p_shift_id) then
    raise exception 'Não é possível encerrar um turno futuro';
  end if;
  select full_name into v_name from public.profiles where id=auth.uid();
  update public.shifts set status='encerrado',closed_by=auth.uid(),closed_by_name=v_name,closed_at=now(),
    final_condition=p_final_condition, close_notes=nullif(trim(p_notes),''),
    late_reason=nullif(trim(p_late_reason),'') where id=p_shift_id returning * into v_shift;
  insert into public.audit_events(shift_id,entity_table,entity_id,operation,actor_id,actor_name,new_data)
  values(p_shift_id,'shifts',p_shift_id,'CLOSE',auth.uid(),v_name,to_jsonb(v_shift));
  return v_shift;
end; $$;

-- POLÍTICAS: sessão autenticada + perfil existente; sem escrita pública.
alter table public.profiles enable row level security;
alter table public.auth_login_attempts enable row level security;
alter table public.shifts enable row level security;
alter table public.shift_participants enable row level security;
alter table public.module_states enable row level security;
alter table public.checklist_responses enable row level security;
alter table public.module_notes enable row level security;
alter table public.hourmeter_readings enable row level security;
alter table public.production_records enable row level security;
alter table public.downtime_records enable row level security;
alter table public.occurrences enable row level security;
alter table public.issues enable row level security;
alter table public.handover_notes enable row level security;
alter table public.equipment_images enable row level security;
alter table public.audit_events enable row level security;

create policy "Perfil próprio ou configurador" on public.profiles for select to authenticated
  using (id=auth.uid() or public.is_configurator());
-- Sem policies de INSERT/UPDATE/DELETE para profiles: só o backend service_role.
create policy "Turnos visíveis" on public.shifts for select to authenticated using (public.is_operator());
create policy "Participantes visíveis" on public.shift_participants for select to authenticated using (public.is_operator());
create policy "Módulos visíveis" on public.module_states for select to authenticated using (public.is_operator());
create policy "Módulos inserir" on public.module_states for insert to authenticated with check (public.can_edit_shift(shift_id));
create policy "Módulos alterar" on public.module_states for update to authenticated using (public.can_edit_shift(shift_id)) with check (public.can_edit_shift(shift_id));
create policy "Respostas visíveis" on public.checklist_responses for select to authenticated using (public.is_operator());
create policy "Respostas inserir" on public.checklist_responses for insert to authenticated with check (public.can_answer_module(shift_id,module_code,item_index));
create policy "Respostas alterar" on public.checklist_responses for update to authenticated using (public.can_answer_module(shift_id,module_code,item_index)) with check (public.can_answer_module(shift_id,module_code,item_index));

create policy "Notas módulo ler" on public.module_notes for select to authenticated using (public.is_operator());
create policy "Notas módulo inserir" on public.module_notes for insert to authenticated with check (public.can_edit_shift(shift_id));
create policy "Horímetros ler" on public.hourmeter_readings for select to authenticated using (public.is_operator());
create policy "Horímetros inserir" on public.hourmeter_readings for insert to authenticated with check (public.can_edit_shift(shift_id));
create policy "Produção ler" on public.production_records for select to authenticated using (public.is_operator());
create policy "Produção inserir" on public.production_records for insert to authenticated with check (public.can_edit_shift(shift_id));
create policy "Paradas ler" on public.downtime_records for select to authenticated using (public.is_operator());
create policy "Paradas inserir" on public.downtime_records for insert to authenticated with check (public.can_edit_shift(shift_id));
create policy "Paradas atualizar" on public.downtime_records for update to authenticated using (public.can_edit_shift(shift_id)) with check (public.can_edit_shift(shift_id));
create policy "Ocorrências ler" on public.occurrences for select to authenticated using (public.is_operator());
create policy "Ocorrências inserir" on public.occurrences for insert to authenticated with check (public.can_edit_shift(shift_id));
create policy "Pendências ler" on public.issues for select to authenticated using (public.is_operator());
-- Criação de pendências apenas por triggers a partir de respostas/ocorrências, sem INSERT do navegador.
create policy "Pendências atualizar" on public.issues for update to authenticated using (public.is_on_active_shift()) with check (public.is_on_active_shift());
create policy "Notas passagem ler" on public.handover_notes for select to authenticated using (public.is_operator());
create policy "Notas passagem inserir" on public.handover_notes for insert to authenticated with check (public.can_edit_shift(shift_id));
create policy "Imagens ler" on public.equipment_images for select to authenticated using (public.is_operator());
create policy "Imagens alterar" on public.equipment_images for update to authenticated using (public.is_configurator()) with check (public.is_configurator());
create policy "Imagens inserir" on public.equipment_images for insert to authenticated with check (public.is_configurator());
create policy "Auditoria ler" on public.audit_events for select to authenticated
  using (public.is_operator() and (entity_table not in ('profiles','equipment_images') or public.is_configurator()));

-- Bucket privado: URL assinada por usuário autorizado.
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('plant-photos','plant-photos',false,10485760,array['image/jpeg','image/png','image/webp'])
on conflict(id) do nothing;
create policy "Fotos privadas ler" on storage.objects for select to authenticated
  using (bucket_id='plant-photos' and public.is_operator());
create policy "Fotos operacionais ou imagens administrativas" on storage.objects for insert to authenticated
  with check (bucket_id='plant-photos' and
    ((storage.foldername(name))[1] in ('anomalies','occurrences') and public.is_on_active_shift()
     or (storage.foldername(name))[1]='equipment' and public.is_configurator()));

-- Atualização em tempo real (há polling de segurança no frontend se WebSocket indisponível).
do $$ declare v_table text; begin
  foreach v_table in array array['shifts','shift_participants','module_states','checklist_responses','module_notes',
    'hourmeter_readings','production_records','downtime_records','occurrences','issues','handover_notes','equipment_images'] loop
    begin execute format('alter publication supabase_realtime add table public.%I',v_table);
    exception when duplicate_object then null;
    end;
  end loop;
end $$;

revoke all on function public.join_current_shift() from public, anon;
revoke all on function public.close_shift(uuid,text,text,boolean,text) from public, anon;
grant execute on function public.join_current_shift() to authenticated;
grant execute on function public.close_shift(uuid,text,text,boolean,text) to authenticated;

-- A conta configuradora será promovida manualmente, após cadastrar-se:
-- update public.profiles set role='configurador' where matricula='MATRICULA_VERIFICADA';
