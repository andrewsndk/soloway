ALTER TABLE public.bookings
ADD COLUMN IF NOT EXISTS parent_summary TEXT;
