-- Run on a production-shaped test database after the migration. No data persists.
begin;
select set_config('request.jwt.claims', json_build_object('sub', id, 'role', 'authenticated', 'email', 'andrew@soloway.local')::text, true)
from auth.users where email = 'ira@soloway.local';
set local role authenticated;
do $$
declare affected integer;
begin
  if crm_private.can_view_finance() then raise exception 'Worker gained finance access'; end if;
  if exists(select 1 from public.cash_expenses) then raise exception 'Expenses leaked'; end if;
  if exists(select 1 from public.expense_receipts) then raise exception 'Receipts leaked'; end if;
  if exists(select 1 from public.audit_logs) then raise exception 'Audit leaked'; end if;
  if exists(select 1 from storage.objects where bucket_id='expense-receipts') then raise exception 'Receipt files leaked'; end if;
  if not exists(select 1 from public.bookings where amount > 0) then raise exception 'Visit prices unavailable'; end if;
  if not exists(select 1 from public.app_settings) then raise exception 'Operational settings unavailable'; end if;
  update public.app_settings set data=data;
  get diagnostics affected = row_count;
  if affected <> 0 then raise exception 'Worker can change settings'; end if;
  begin
    insert into public.cash_expenses(name,amount,expense_date,payment_method) values ('PERMISSION TEST',1,current_date,'cash');
    raise exception 'Worker can insert expenses';
  exception when insufficient_privilege then null;
  end;
end $$;
reset role;

select set_config('request.jwt.claims', json_build_object('sub', id, 'role', 'authenticated')::text, true)
from auth.users where email = 'andrew@soloway.local';
set local role authenticated;
do $$
begin
  if not crm_private.can_view_finance() then raise exception 'Owner lost finance access'; end if;
  if not exists(select 1 from public.cash_expenses) then raise exception 'Owner cannot view expenses'; end if;
  if not exists(select 1 from public.expense_receipts) then raise exception 'Owner cannot view receipts'; end if;
end $$;
reset role;
rollback;
