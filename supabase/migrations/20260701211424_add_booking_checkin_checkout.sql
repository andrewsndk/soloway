alter table public.bookings
  add column if not exists check_in_at timestamptz,
  add column if not exists check_out_at timestamptz;

create index if not exists bookings_check_in_idx on public.bookings(check_in_at);
create index if not exists bookings_check_out_idx on public.bookings(check_out_at);
