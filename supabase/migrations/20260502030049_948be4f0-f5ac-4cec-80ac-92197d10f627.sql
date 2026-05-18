ALTER TABLE public.schools
  ADD COLUMN IF NOT EXISTS latitude numeric,
  ADD COLUMN IF NOT EXISTS longitude numeric;

CREATE INDEX IF NOT EXISTS idx_schools_lat_lng ON public.schools (latitude, longitude);