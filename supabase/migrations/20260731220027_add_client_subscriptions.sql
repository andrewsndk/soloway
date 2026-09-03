create table public.client_subscriptions (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients(id) on delete cascade,
  plan_type text not null check (plan_type in ('hour_1', 'hour_3', 'half_day', 'full_day', 'unlimited_month')),
  status text not null default 'pending' check (status in ('pending', 'active', 'exhausted', 'expired', 'cancelled')),
  visits_limit integer check (visits_limit is null or visits_limit > 0),
  visits_used integer not null default 0 check (visits_used >= 0),
  amount numeric not null default 0,
  starts_at timestamptz,
  expires_at timestamptz,
  paid_at timestamptz,
  activated_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint subscription_dates_check check (expires_at is null or starts_at is null or expires_at > starts_at),
  constraint subscription_usage_check check (visits_limit is null or visits_used <= visits_limit)
);

create unique index client_subscriptions_one_open_idx
  on public.client_subscriptions (client_id)
  where status in ('pending', 'active');
create index client_subscriptions_client_idx on public.client_subscriptions (client_id, created_at desc);

alter table public.bookings add column if not exists subscription_id uuid references public.client_subscriptions(id) on delete set null;
alter table public.bookings add column if not exists subscription_plan text;
alter table public.bookings drop constraint if exists bookings_subscription_plan_check;
alter table public.bookings add constraint bookings_subscription_plan_check
  check (subscription_plan is null or subscription_plan in ('hour_1', 'hour_3', 'half_day', 'full_day', 'unlimited_month'));
create index bookings_subscription_idx on public.bookings(subscription_id);

grant select, insert, update, delete on public.client_subscriptions to authenticated;
grant all on public.client_subscriptions to service_role;
alter table public.client_subscriptions enable row level security;
create policy "Staff can view subscriptions" on public.client_subscriptions for select to authenticated using (true);
create policy "Staff can insert subscriptions" on public.client_subscriptions for insert to authenticated with check (true);
create policy "Staff can update subscriptions" on public.client_subscriptions for update to authenticated using (true) with check (true);
create policy "Staff can delete subscriptions" on public.client_subscriptions for delete to authenticated using (true);

create trigger client_subscriptions_touch before update on public.client_subscriptions
for each row execute function public.touch_updated_at();

create or replace function public.apply_subscription_visit_usage()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  subscription_row public.client_subscriptions%rowtype;
begin
  if new.status = 'Завершено' and old.status <> 'Завершено' and new.subscription_id is not null then
    select * into subscription_row
    from public.client_subscriptions
    where id = new.subscription_id
    for update;

    if not found or subscription_row.status <> 'active' then
      raise exception 'Абонемент не активний';
    end if;
    if subscription_row.expires_at is not null and now() >= subscription_row.expires_at then
      update public.client_subscriptions set status = 'expired' where id = subscription_row.id;
      raise exception 'Термін дії абонемента завершився';
    end if;
    if subscription_row.plan_type <> 'unlimited_month' and subscription_row.visits_used >= coalesce(subscription_row.visits_limit, 0) then
      update public.client_subscriptions set status = 'exhausted' where id = subscription_row.id;
      raise exception 'Абонемент повністю використаний';
    end if;

    update public.client_subscriptions
    set visits_used = case when plan_type = 'unlimited_month' then visits_used else visits_used + 1 end,
        status = case when plan_type <> 'unlimited_month' and visits_used + 1 >= visits_limit then 'exhausted' else status end
    where id = subscription_row.id;
  elsif old.status = 'Завершено' and new.status <> 'Завершено' and old.subscription_id is not null then
    update public.client_subscriptions
    set visits_used = case when plan_type = 'unlimited_month' then visits_used else greatest(0, visits_used - 1) end,
        status = case when status = 'exhausted' then 'active' else status end
    where id = old.subscription_id and status in ('active', 'exhausted');
  end if;
  return new;
end;
$$;

drop trigger if exists bookings_subscription_usage on public.bookings;
create trigger bookings_subscription_usage
before update of status on public.bookings
for each row execute function public.apply_subscription_visit_usage();
