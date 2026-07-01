create table public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid,
  actor_email text,
  actor_login text,
  action text not null,
  entity_type text not null,
  entity_id text,
  entity_label text,
  summary text not null,
  before_data jsonb,
  after_data jsonb,
  created_at timestamptz not null default now()
);

create index audit_logs_created_at_idx on public.audit_logs (created_at desc);
create index audit_logs_entity_idx on public.audit_logs (entity_type, entity_id);
create index audit_logs_actor_idx on public.audit_logs (actor_id, created_at desc);

grant select, insert on public.audit_logs to authenticated;
grant all on public.audit_logs to service_role;

alter table public.audit_logs enable row level security;

create policy "Staff can view audit logs"
  on public.audit_logs
  for select
  to authenticated
  using (true);

create policy "Staff can insert audit logs"
  on public.audit_logs
  for insert
  to authenticated
  with check ((select auth.uid()) = actor_id);
