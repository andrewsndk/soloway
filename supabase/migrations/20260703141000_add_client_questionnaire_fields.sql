alter table public.clients
  add column if not exists preferred_name text,
  add column if not exists food_allergies text,
  add column if not exists other_allergies text,
  add column if not exists snack_consent text,
  add column if not exists toilet_habits text,
  add column if not exists hygiene_notes text,
  add column if not exists adaptation_notes text,
  add column if not exists calming_notes text,
  add column if not exists interests text,
  add column if not exists physical_restrictions text,
  add column if not exists photo_consent text,
  add column if not exists important_notes text;
