alter table public.client_subscriptions
  alter column client_id drop not null;

alter table public.client_subscriptions
  drop constraint if exists client_subscriptions_client_id_fkey;

alter table public.client_subscriptions
  add constraint client_subscriptions_client_id_fkey
  foreign key (client_id) references public.clients(id) on delete set null;
