-- Admin-only management of schools & devices (in addition to existing staff read scoping)
-- Drop existing staff-write policies and replace with admin-only write
DROP POLICY IF EXISTS "schools staff write" ON public.schools;
DROP POLICY IF EXISTS "devices staff write" ON public.devices;

CREATE POLICY "schools admin write"
  ON public.schools
  FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "devices admin write"
  ON public.devices
  FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Index for MAC-based auto-binding lookups
CREATE INDEX IF NOT EXISTS idx_devices_mac_address ON public.devices (lower(mac_address)) WHERE mac_address IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_devices_ruijie_device_id ON public.devices (ruijie_device_id) WHERE ruijie_device_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_schools_ruijie_site_id ON public.schools (ruijie_site_id) WHERE ruijie_site_id IS NOT NULL;