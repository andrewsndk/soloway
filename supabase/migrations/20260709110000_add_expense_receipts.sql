create table if not exists public.expense_receipts (
  id uuid primary key default gen_random_uuid(),
  receipt_date date not null,
  file_path text not null,
  file_name text not null,
  file_type text,
  file_size bigint,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists expense_receipts_date_idx
  on public.expense_receipts (receipt_date desc, created_at desc);

grant select, insert, delete on public.expense_receipts to authenticated;
grant all on public.expense_receipts to service_role;

alter table public.expense_receipts enable row level security;

drop policy if exists "Staff can view expense receipts" on public.expense_receipts;
create policy "Staff can view expense receipts"
  on public.expense_receipts
  for select
  to authenticated
  using (true);

drop policy if exists "Staff can insert expense receipts" on public.expense_receipts;
create policy "Staff can insert expense receipts"
  on public.expense_receipts
  for insert
  to authenticated
  with check (true);

drop policy if exists "Staff can delete expense receipts" on public.expense_receipts;
create policy "Staff can delete expense receipts"
  on public.expense_receipts
  for delete
  to authenticated
  using (true);

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'expense-receipts',
  'expense-receipts',
  false,
  10485760,
  array['image/jpeg', 'image/png', 'image/webp', 'application/pdf']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "Staff can view expense receipt files" on storage.objects;
create policy "Staff can view expense receipt files"
  on storage.objects
  for select
  to authenticated
  using (bucket_id = 'expense-receipts');

drop policy if exists "Staff can upload expense receipt files" on storage.objects;
create policy "Staff can upload expense receipt files"
  on storage.objects
  for insert
  to authenticated
  with check (bucket_id = 'expense-receipts');

drop policy if exists "Staff can delete expense receipt files" on storage.objects;
create policy "Staff can delete expense receipt files"
  on storage.objects
  for delete
  to authenticated
  using (bucket_id = 'expense-receipts');
