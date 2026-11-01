-- Individual booking and subscription amounts remain available to operational staff.
-- Aggregate finance, expense files and configuration writes require owner access.
create schema if not exists crm_private;
revoke all on schema crm_private from public, anon;
grant usage on schema crm_private to authenticated;

create or replace function crm_private.can_view_finance()
returns boolean
language sql stable security definer
set search_path = ''
as $$
  select exists (
    select 1 from auth.users u
    where u.id = (select auth.uid())
      and lower(u.email) in ('yulia@soloway.local', 'olena@soloway.local', 'andrew@soloway.local')
      and u.deleted_at is null
  );
$$;
revoke all on function crm_private.can_view_finance() from public, anon;
grant execute on function crm_private.can_view_finance() to authenticated;

-- Restrictive policies also constrain the existing permissive staff policies.
create policy "Finance access required" on public.cash_expenses
as restrictive for all to authenticated
using ((select crm_private.can_view_finance()))
with check ((select crm_private.can_view_finance()));

create policy "Finance access required" on public.expense_receipts
as restrictive for all to authenticated
using ((select crm_private.can_view_finance()))
with check ((select crm_private.can_view_finance()));

create policy "Finance access required for audit" on public.audit_logs
as restrictive for select to authenticated
using ((select crm_private.can_view_finance()));

create policy "Finance access required to insert settings" on public.app_settings
as restrictive for insert to authenticated
with check ((select crm_private.can_view_finance()));
create policy "Finance access required to update settings" on public.app_settings
as restrictive for update to authenticated
using ((select crm_private.can_view_finance()))
with check ((select crm_private.can_view_finance()));
create policy "Finance access required to delete settings" on public.app_settings
as restrictive for delete to authenticated
using ((select crm_private.can_view_finance()));

create policy "Finance access required for receipt files" on storage.objects
as restrictive for all to authenticated
using (bucket_id <> 'expense-receipts' or (select crm_private.can_view_finance()))
with check (bucket_id <> 'expense-receipts' or (select crm_private.can_view_finance()));
