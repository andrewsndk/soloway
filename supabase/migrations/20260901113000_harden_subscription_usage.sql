create or replace function public.recalculate_subscription_usage(p_subscription_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  subscription_row public.client_subscriptions%rowtype;
  completed_visits integer;
begin
  if p_subscription_id is null then
    return;
  end if;

  select * into subscription_row
  from public.client_subscriptions
  where id = p_subscription_id
  for update;

  if not found then
    return;
  end if;

  if subscription_row.plan_type = 'unlimited_month' then
    update public.client_subscriptions
    set visits_used = 0
    where id = p_subscription_id and visits_used <> 0;
    return;
  end if;

  select count(*)::integer into completed_visits
  from public.bookings
  where subscription_id = p_subscription_id
    and status = 'Завершено';

  if completed_visits > coalesce(subscription_row.visits_limit, 0) then
    raise exception 'Кількість завершених візитів перевищує ліміт абонемента';
  end if;

  update public.client_subscriptions
  set visits_used = completed_visits,
      status = case
        when status in ('cancelled', 'expired', 'pending') then status
        when completed_visits >= visits_limit then 'exhausted'
        else 'active'
      end
  where id = p_subscription_id
    and (
      visits_used is distinct from completed_visits
      or status is distinct from case
        when status in ('cancelled', 'expired', 'pending') then status
        when completed_visits >= visits_limit then 'exhausted'
        else 'active'
      end
    );
end;
$$;

create or replace function public.validate_booking_subscription()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  subscription_row public.client_subscriptions%rowtype;
  expected_format text;
  completed_visits integer;
begin
  if tg_op = 'UPDATE'
    and old.subscription_id is not null
    and new.subscription_id is distinct from old.subscription_id
    and exists (
      select 1
      from public.client_subscriptions
      where id = old.subscription_id
        and status in ('active', 'exhausted')
    ) then
    raise exception 'Активований абонемент не можна відв’язати через редагування бронювання';
  end if;

  if new.subscription_id is null then
    if new.subscription_plan is not null then
      raise exception 'Тип абонемента вказано без прив’язки до абонемента';
    end if;
    return new;
  end if;

  select * into subscription_row
  from public.client_subscriptions
  where id = new.subscription_id;

  if not found then
    raise exception 'Абонемент не знайдено';
  end if;
  if subscription_row.client_id <> new.client_id then
    raise exception 'Абонемент належить іншій дитині';
  end if;
  if new.subscription_plan is distinct from subscription_row.plan_type then
    raise exception 'Тип бронювання не відповідає абонементу';
  end if;

  expected_format := case subscription_row.plan_type
    when 'hour_1' then 'hour_1'
    when 'hour_3' then 'hour_3'
    when 'half_day' then 'half_day'
    when 'full_day' then 'full_day'
    when 'unlimited_month' then 'full_day'
  end;
  if new.format is distinct from expected_format then
    raise exception 'Формат візиту не відповідає абонементу';
  end if;

  if new.status = 'Завершено' and (
    tg_op = 'INSERT'
    or old.status <> 'Завершено'
    or old.subscription_id is distinct from new.subscription_id
  ) then
    if subscription_row.status not in ('pending', 'active') then
      raise exception 'Абонемент не активний';
    end if;
    if subscription_row.status = 'active'
      and subscription_row.expires_at is not null
      and now() >= subscription_row.expires_at then
      raise exception 'Термін дії абонемента завершився';
    end if;
    if subscription_row.plan_type <> 'unlimited_month' then
      select count(*)::integer into completed_visits
      from public.bookings
      where subscription_id = new.subscription_id
        and status = 'Завершено'
        and id <> new.id;
      if completed_visits >= coalesce(subscription_row.visits_limit, 0) then
        raise exception 'Абонемент повністю використаний';
      end if;
    end if;
  end if;

  return new;
end;
$$;

create or replace function public.sync_subscription_usage_from_booking()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'DELETE' then
    perform public.recalculate_subscription_usage(old.subscription_id);
    return old;
  end if;

  if tg_op = 'UPDATE' and old.subscription_id is distinct from new.subscription_id then
    perform public.recalculate_subscription_usage(old.subscription_id);
  end if;
  perform public.recalculate_subscription_usage(new.subscription_id);
  return new;
end;
$$;

revoke all on function public.recalculate_subscription_usage(uuid) from public, anon, authenticated;
revoke all on function public.sync_subscription_usage_from_booking() from public, anon, authenticated;

drop trigger if exists bookings_subscription_usage on public.bookings;
drop trigger if exists bookings_validate_subscription on public.bookings;
drop trigger if exists bookings_sync_subscription_usage on public.bookings;

create trigger bookings_validate_subscription
before insert or update of status, subscription_id, subscription_plan, format
on public.bookings
for each row execute function public.validate_booking_subscription();

create trigger bookings_sync_subscription_usage
after insert or delete or update of status, subscription_id
on public.bookings
for each row execute function public.sync_subscription_usage_from_booking();

create unique index if not exists bookings_one_subscription_charge_idx
  on public.bookings (subscription_id)
  where subscription_id is not null and amount > 0;

do $$
declare
  subscription_id uuid;
begin
  for subscription_id in select id from public.client_subscriptions loop
    perform public.recalculate_subscription_usage(subscription_id);
  end loop;
end;
$$;
