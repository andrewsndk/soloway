create table public.solo_insights (
  client_id uuid primary key references public.clients(id) on delete cascade,
  source_hash text not null,
  source_booking_ids uuid[] not null default '{}',
  remember text not null,
  ask text not null,
  activity text not null,
  watch_out text not null,
  generated_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

grant select on public.solo_insights to authenticated;
grant all on public.solo_insights to service_role;

alter table public.solo_insights enable row level security;

create policy "Staff can view SOLO insights"
on public.solo_insights for select
to authenticated
using (true);

create trigger solo_insights_touch
before update on public.solo_insights
for each row execute function public.touch_updated_at();
