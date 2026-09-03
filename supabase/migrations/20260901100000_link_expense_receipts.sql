alter table public.expense_receipts
  add column if not exists expense_id uuid references public.cash_expenses(id) on delete set null;

create index if not exists expense_receipts_expense_idx
  on public.expense_receipts (expense_id);
