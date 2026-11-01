-- Enforce the purchase/usage boundary for both admin and public bookings.
create or replace function public.ensure_subscription_purchase_before_usage()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  package public.client_subscriptions%rowtype;
  entering_completed boolean;
begin
  if new.subscription_id is null then
    return new;
  end if;

  -- Serialize first-charge selection across simultaneous bookings.
  select * into package from public.client_subscriptions
  where id = new.subscription_id for update;
  if not found then
    raise exception 'Абонемент не знайдено';
  end if;

  entering_completed := new.status = 'Завершено';
  if tg_op = 'UPDATE' then
    entering_completed := entering_completed and (
      old.status is distinct from 'Завершено'
      or old.subscription_id is distinct from new.subscription_id
    );
  end if;
  if entering_completed and (package.status <> 'active' or package.paid_at is null) then
    raise exception using errcode = '23514',
      message = 'Спочатку підтвердьте оплату та активуйте абонемент, потім завершіть візит.';
  end if;

  if tg_op = 'INSERT' and package.status = 'pending'
    and new.amount = 0 and not new.amount_override
    and new.status not in ('Скасовано', 'Не прийшли')
    and not exists (
      select 1 from public.bookings
      where subscription_id = package.id and amount > 0
    ) then
    if package.amount <= 0 then
      raise exception 'Вкажіть вартість абонемента перед створенням першого візиту';
    end if;
    new.amount := package.amount;
  end if;
  return new;
end;
$$;

create trigger bookings_ensure_subscription_purchase
before insert or update of status, subscription_id on public.bookings
for each row execute function public.ensure_subscription_purchase_before_usage();
;
