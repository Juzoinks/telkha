DROP FUNCTION IF EXISTS public.list_users_with_roles();

CREATE OR REPLACE FUNCTION public.list_users_with_roles()
 RETURNS TABLE(id uuid, email text, full_name text, created_at timestamp with time zone, last_sign_in_at timestamp with time zone, roles app_role[])
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
    u.last_sign_in_at,
    coalesce(array_agg(ur.role order by ur.role) filter (where ur.role is not null), '{}'::public.app_role[]) as roles
  from public.profiles p
  left join auth.users u on u.id = p.id
  left join public.user_roles ur on ur.user_id = p.id
  group by p.id, p.email, p.full_name, p.created_at, u.last_sign_in_at
  order by p.created_at desc;
END;
$function$;

CREATE OR REPLACE FUNCTION public.admin_exists()
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select exists (select 1 from public.user_roles where role = 'admin');
$function$;
GRANT EXECUTE ON FUNCTION public.admin_exists() TO anon, authenticated;