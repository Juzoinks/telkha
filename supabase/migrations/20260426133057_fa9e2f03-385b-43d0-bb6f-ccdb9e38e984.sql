ALTER TABLE public.schools ADD COLUMN IF NOT EXISTS ruijie_site_id text;
ALTER TABLE public.devices ADD COLUMN IF NOT EXISTS ruijie_device_id text;
ALTER TABLE public.devices ADD COLUMN IF NOT EXISTS mac_address text;

CREATE UNIQUE INDEX IF NOT EXISTS schools_ruijie_site_id_key
  ON public.schools (ruijie_site_id) WHERE ruijie_site_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS devices_ruijie_device_id_key
  ON public.devices (ruijie_device_id) WHERE ruijie_device_id IS NOT NULL;