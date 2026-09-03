create table if not exists public.cash_expenses (
  id uuid primary key default gen_random_uuid(),
  expense_date date not null,
  name text not null,
  amount numeric not null check (amount >= 0),
  payment_method text not null default 'cash' check (payment_method in ('cash', 'card')),
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists cash_expenses_date_idx
  on public.cash_expenses (expense_date desc, created_at desc);

grant select, insert, update, delete on public.cash_expenses to authenticated;
grant all on public.cash_expenses to service_role;

alter table public.cash_expenses enable row level security;

drop policy if exists "Staff can view cash expenses" on public.cash_expenses;
create policy "Staff can view cash expenses"
  on public.cash_expenses for select to authenticated using (true);

drop policy if exists "Staff can insert cash expenses" on public.cash_expenses;
create policy "Staff can insert cash expenses"
  on public.cash_expenses for insert to authenticated with check (true);

drop policy if exists "Staff can update cash expenses" on public.cash_expenses;
create policy "Staff can update cash expenses"
  on public.cash_expenses for update to authenticated using (true) with check (true);

drop policy if exists "Staff can delete cash expenses" on public.cash_expenses;
create policy "Staff can delete cash expenses"
  on public.cash_expenses for delete to authenticated using (true);
