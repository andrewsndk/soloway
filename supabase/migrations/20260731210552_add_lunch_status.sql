alter table public.bookings
  add column if not exists lunch_status text;

alter table public.bookings
  drop constraint if exists bookings_lunch_status_check;

alter table public.bookings
  add constraint bookings_lunch_status_check
  check (lunch_status is null or lunch_status in ('not_taken', 'unpaid', 'paid'));
