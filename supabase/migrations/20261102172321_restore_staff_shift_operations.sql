-- Expenses and receipt uploads are operational shift tasks for authenticated staff.
-- Existing authenticated staff policies and RLS stay enabled; owner-only settings
-- and audit-log reads remain restricted by the previous migration.
drop policy if exists "Finance access required" on public.cash_expenses;
drop policy if exists "Finance access required" on public.expense_receipts;
drop policy if exists "Finance access required for receipt files" on storage.objects;
