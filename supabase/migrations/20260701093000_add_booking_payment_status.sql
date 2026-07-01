alter table public.bookings
  add column if not exists payment_status text not null default 'не оплачено';
