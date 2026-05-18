
-- Revoke EXECUTE on all SECURITY DEFINER functions from public/anon.
-- Grant only to the roles that legitimately need to call them.

-- RLS helper functions: needed by authenticated (called inside RLS policies)
REVOKE EXECUTE ON FUNCTION public.is_staff(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.can_manage_school(uuid, uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.can_manage_ticket(uuid, uuid[]) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.can_access_ticket(uuid, uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.admin_exists() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_staff(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated;
GRANT EXECUTE ON FUNCTION public.can_manage_school(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.can_manage_ticket(uuid, uuid[]) TO authenticated;
GRANT EXECUTE ON FUNCTION public.can_access_ticket(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_exists() TO authenticated;

-- App RPCs only callable by authenticated users
REVOKE EXECUTE ON FUNCTION public.list_reportable_schools() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.bootstrap_first_admin(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.list_users_with_roles() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.list_reportable_schools() TO authenticated;
GRANT EXECUTE ON FUNCTION public.bootstrap_first_admin(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.list_users_with_roles() TO authenticated;

-- Trigger function: not callable from PostgREST API at all
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
