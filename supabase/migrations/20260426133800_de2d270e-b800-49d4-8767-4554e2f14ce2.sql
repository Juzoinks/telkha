ALTER TABLE public.schools ADD COLUMN IF NOT EXISTS last_synced_at timestamp with time zone;
ALTER TABLE public.devices ADD COLUMN IF NOT EXISTS last_status_check_at timestamp with time zone;