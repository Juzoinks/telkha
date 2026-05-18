
-- 1. Move pg_net to extensions schema (requires drop+create)
CREATE SCHEMA IF NOT EXISTS extensions;
GRANT USAGE ON SCHEMA extensions TO postgres, authenticated, service_role;
DROP EXTENSION IF EXISTS pg_net;
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

-- 2. RLS helpers as SECURITY INVOKER (called with auth.uid(); self-reads on user_roles/user_school_access already permitted)
CREATE OR REPLACE FUNCTION public.is_staff(_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY INVOKER SET search_path TO 'public' AS $$
  select exists (select 1 from public.user_roles where user_id = _user_id and role in ('admin','technician'));
$$;

CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean LANGUAGE sql STABLE SECURITY INVOKER SET search_path TO 'public' AS $$
  select exists (select 1 from public.user_roles where user_id = _user_id and role = _role);
$$;

CREATE OR REPLACE FUNCTION public.can_manage_school(_user_id uuid, _school_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY INVOKER SET search_path TO 'public' AS $$
  select public.has_role(_user_id, 'admin')
    or (public.has_role(_user_id, 'technician')
        and exists (select 1 from public.user_school_access usa
                    where usa.user_id = _user_id and usa.school_id = _school_id));
$$;

CREATE OR REPLACE FUNCTION public.can_manage_ticket(_user_id uuid, _school_ids uuid[])
RETURNS boolean LANGUAGE sql STABLE SECURITY INVOKER SET search_path TO 'public' AS $$
  select public.has_role(_user_id, 'admin')
    or (public.has_role(_user_id, 'technician')
        and exists (select 1 from public.user_school_access usa
                    where usa.user_id = _user_id
                      and usa.school_id = any(coalesce(_school_ids, '{}'::uuid[]))));
$$;

CREATE OR REPLACE FUNCTION public.can_access_ticket(_user_id uuid, _ticket_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY INVOKER SET search_path TO 'public' AS $$
  select exists (select 1 from public.tickets t
                 where t.id = _ticket_id and public.can_manage_ticket(_user_id, t.school_ids));
$$;

-- 3. Move privileged helpers into private schema, expose INVOKER wrappers in public
CREATE SCHEMA IF NOT EXISTS private;
REVOKE ALL ON SCHEMA private FROM PUBLIC, anon, authenticated;
GRANT USAGE ON SCHEMA private TO postgres, service_role;

CREATE OR REPLACE FUNCTION private.admin_exists()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  select exists (select 1 from public.user_roles where role = 'admin');
$$;
REVOKE ALL ON FUNCTION private.admin_exists() FROM PUBLIC, anon, authenticated;

DROP FUNCTION IF EXISTS public.admin_exists();
CREATE OR REPLACE FUNCTION public.admin_exists()
RETURNS boolean LANGUAGE sql STABLE SECURITY INVOKER SET search_path TO 'public' AS $$
  select private.admin_exists();
$$;
GRANT EXECUTE ON FUNCTION public.admin_exists() TO authenticated, anon;

CREATE OR REPLACE FUNCTION private.bootstrap_first_admin(_user_id uuid)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE exists_admin boolean;
BEGIN
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE role = 'admin') INTO exists_admin;
  IF exists_admin THEN RETURN false; END IF;
  INSERT INTO public.user_roles (user_id, role) VALUES (_user_id, 'admin')
    ON CONFLICT (user_id, role) DO NOTHING;
  RETURN true;
END; $$;
REVOKE ALL ON FUNCTION private.bootstrap_first_admin(uuid) FROM PUBLIC, anon, authenticated;

DROP FUNCTION IF EXISTS public.bootstrap_first_admin(uuid);
CREATE OR REPLACE FUNCTION public.bootstrap_first_admin(_user_id uuid)
RETURNS boolean LANGUAGE plpgsql SECURITY INVOKER SET search_path TO 'public' AS $$
BEGIN
  IF _user_id IS NULL OR auth.uid() IS DISTINCT FROM _user_id THEN
    RAISE EXCEPTION 'Not allowed';
  END IF;
  RETURN private.bootstrap_first_admin(_user_id);
END; $$;
GRANT EXECUTE ON FUNCTION public.bootstrap_first_admin(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION private.list_reportable_schools()
RETURNS TABLE(id uuid, name text, region text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  select s.id, s.name, s.region from public.schools s order by s.name;
$$;
REVOKE ALL ON FUNCTION private.list_reportable_schools() FROM PUBLIC, anon, authenticated;

DROP FUNCTION IF EXISTS public.list_reportable_schools();
CREATE OR REPLACE FUNCTION public.list_reportable_schools()
RETURNS TABLE(id uuid, name text, region text)
LANGUAGE plpgsql STABLE SECURITY INVOKER SET search_path TO 'public' AS $$
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  RETURN QUERY SELECT * FROM private.list_reportable_schools();
END; $$;
GRANT EXECUTE ON FUNCTION public.list_reportable_schools() TO authenticated;

CREATE OR REPLACE FUNCTION private.list_users_with_roles()
RETURNS TABLE(id uuid, email text, full_name text, created_at timestamp with time zone, last_sign_in_at timestamp with time zone, roles public.app_role[])
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  select p.id, p.email, p.full_name, p.created_at, u.last_sign_in_at,
    coalesce(array_agg(ur.role order by ur.role) filter (where ur.role is not null), '{}'::public.app_role[]) as roles
  from public.profiles p
  left join auth.users u on u.id = p.id
  left join public.user_roles ur on ur.user_id = p.id
  group by p.id, p.email, p.full_name, p.created_at, u.last_sign_in_at
  order by p.created_at desc;
$$;
REVOKE ALL ON FUNCTION private.list_users_with_roles() FROM PUBLIC, anon, authenticated;

DROP FUNCTION IF EXISTS public.list_users_with_roles();
CREATE OR REPLACE FUNCTION public.list_users_with_roles()
RETURNS TABLE(id uuid, email text, full_name text, created_at timestamp with time zone, last_sign_in_at timestamp with time zone, roles public.app_role[])
LANGUAGE plpgsql STABLE SECURITY INVOKER SET search_path TO 'public' AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Not allowed';
  END IF;
  RETURN QUERY SELECT * FROM private.list_users_with_roles();
END; $$;
GRANT EXECUTE ON FUNCTION public.list_users_with_roles() TO authenticated;

-- handle_new_user remains SECURITY DEFINER (trigger only, no API exposure)
REVOKE ALL ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
