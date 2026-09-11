-- Runs against the current schema; all fixtures and changes are rolled back.
begin;
do $$
declare
  client_uuid uuid := gen_random_uuid();
  subscription_uuid uuid := gen_random_uuid();
  charge_uuid uuid := gen_random_uuid();
  covered_uuid uuid := gen_random_uuid();
begin
  insert into public.clients(id, child_name, parent_name)
  values (client_uuid, '__payment_guard_test__', '__test__');
  insert into public.client_subscriptions(id, client_id, plan_type, amount, visits_limit)
  values (subscription_uuid, client_uuid, 'hour_3', 7200, 10);
  insert into public.bookings(id, client_id, child_name, parent_name, visit_date, format, amount, subscription_id, subscription_plan)
  values
    (charge_uuid, client_uuid, '__payment_guard_test__', '__test__', current_date, 'hour_3', 7200, subscription_uuid, 'hour_3'),
    (covered_uuid, client_uuid, '__payment_guard_test__', '__test__', current_date + 1, 'hour_3', 0, subscription_uuid, 'hour_3');

  begin
    update public.bookings set amount = 0 where id = charge_uuid;
    raise exception 'FAIL: package payment was erased';
  exception when check_violation then
    if sqlerrm not like 'Оплату абонемента не можна обнулити.%' then raise; end if;
  end;

  update public.bookings set amount = 6480 where id = charge_uuid;
  update public.bookings set payment_status = 'оплачено карткою' where id = charge_uuid;
  update public.bookings set amount = 0, visit_time = '11:00' where id = covered_uuid;
  if (select amount from public.bookings where id = charge_uuid) <> 6480 then
    raise exception 'FAIL: discounted charge was not preserved';
  end if;
  if (select sum(amount) from public.bookings where subscription_id = subscription_uuid) <> 6480 then
    raise exception 'FAIL: covered visit was charged';
  end if;
end;
$$;
rollback;
