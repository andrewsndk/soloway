alter table public.clients
  add column if not exists phone_normalized text;

alter table public.bookings
  add column if not exists phone_normalized text;

update public.clients
set phone_normalized = case
  when regexp_replace(coalesce(phone, ''), '\D', '', 'g') like '380_________' then regexp_replace(coalesce(phone, ''), '\D', '', 'g')
  when regexp_replace(coalesce(phone, ''), '\D', '', 'g') like '80_________' then '3' || regexp_replace(coalesce(phone, ''), '\D', '', 'g')
  when regexp_replace(coalesce(phone, ''), '\D', '', 'g') like '0_________' then '38' || regexp_replace(coalesce(phone, ''), '\D', '', 'g')
  when length(regexp_replace(coalesce(phone, ''), '\D', '', 'g')) = 9 then '380' || regexp_replace(coalesce(phone, ''), '\D', '', 'g')
  else nullif(regexp_replace(coalesce(phone, ''), '\D', '', 'g'), '')
end
where phone_normalized is null and nullif(regexp_replace(coalesce(phone, ''), '\D', '', 'g'), '') is not null;

update public.bookings
set phone_normalized = case
  when regexp_replace(coalesce(phone, ''), '\D', '', 'g') like '380_________' then regexp_replace(coalesce(phone, ''), '\D', '', 'g')
  when regexp_replace(coalesce(phone, ''), '\D', '', 'g') like '80_________' then '3' || regexp_replace(coalesce(phone, ''), '\D', '', 'g')
  when regexp_replace(coalesce(phone, ''), '\D', '', 'g') like '0_________' then '38' || regexp_replace(coalesce(phone, ''), '\D', '', 'g')
  when length(regexp_replace(coalesce(phone, ''), '\D', '', 'g')) = 9 then '380' || regexp_replace(coalesce(phone, ''), '\D', '', 'g')
  else nullif(regexp_replace(coalesce(phone, ''), '\D', '', 'g'), '')
end
where phone_normalized is null and nullif(regexp_replace(coalesce(phone, ''), '\D', '', 'g'), '') is not null;

create index if not exists clients_phone_normalized_idx on public.clients(phone_normalized);
create index if not exists bookings_phone_normalized_idx on public.bookings(phone_normalized);
