DROP POLICY IF EXISTS "schools read auth" ON public.schools;
CREATE POLICY "schools scoped read"
ON public.schools
FOR SELECT
USING (
  public.has_role(auth.uid(), 'admin')
  OR public.can_manage_school(auth.uid(), id)
);

CREATE OR REPLACE FUNCTION public.list_reportable_schools()
RETURNS TABLE (
  id uuid,
  name text,
  region text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  select s.id, s.name, s.region
  from public.schools s
  order by s.name;
$$;