CREATE OR REPLACE FUNCTION public.list_users_with_roles()
RETURNS TABLE (
  id uuid,
  email text,
  full_name text,
  created_at timestamptz,
  roles public.app_role[]
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Not allowed';
  END IF;

  RETURN QUERY
  select
    p.id,
    p.email,
    p.full_name,
    p.created_at,
    coalesce(array_agg(ur.role order by ur.role) filter (where ur.role is not null), '{}'::public.app_role[]) as roles
  from public.profiles p
  left join public.user_roles ur on ur.user_id = p.id
  group by p.id, p.email, p.full_name, p.created_at
  order by p.created_at desc;
END;
$$;