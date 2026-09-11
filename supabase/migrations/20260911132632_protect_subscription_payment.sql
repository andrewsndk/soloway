create or replace function public.protect_subscription_payment()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if old.subscription_id is not null
    and new.subscription_id is not distinct from old.subscription_id
    and old.amount > 0
    and coalesce(new.amount, 0) <= 0 then
    raise exception using
      errcode = '23514',
      message = 'Оплату абонемента не можна обнулити. Нульова сума застосовується до наступних візитів.';
  end if;
  return new;
end;
$$;

revoke all on function public.protect_subscription_payment() from public, anon, authenticated;

create trigger bookings_protect_subscription_payment
before update of amount, subscription_id on public.bookings
for each row execute function public.protect_subscription_payment();
