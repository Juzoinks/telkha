CREATE TABLE IF NOT EXISTS public.user_school_access (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  school_id uuid NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, school_id)
);

ALTER TABLE public.user_school_access ENABLE ROW LEVEL SECURITY;

CREATE POLICY "school access self read"
ON public.user_school_access
FOR SELECT
USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "school access admin manage"
ON public.user_school_access
FOR ALL
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE OR REPLACE FUNCTION public.can_manage_school(_user_id uuid, _school_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  select
    public.has_role(_user_id, 'admin')
    or (
      public.has_role(_user_id, 'technician')
      and exists (
        select 1
        from public.user_school_access usa
        where usa.user_id = _user_id
          and usa.school_id = _school_id
      )
    );
$$;

CREATE OR REPLACE FUNCTION public.can_manage_ticket(_user_id uuid, _school_ids uuid[])
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  select
    public.has_role(_user_id, 'admin')
    or (
      public.has_role(_user_id, 'technician')
      and exists (
        select 1
        from public.user_school_access usa
        where usa.user_id = _user_id
          and usa.school_id = any(coalesce(_school_ids, '{}'::uuid[]))
      )
    );
$$;

ALTER TABLE public.teacher_reports
  ADD COLUMN IF NOT EXISTS report_status text NOT NULL DEFAULT 'new',
  ADD COLUMN IF NOT EXISTS reviewed_by uuid,
  ADD COLUMN IF NOT EXISTS reviewed_at timestamptz,
  ADD COLUMN IF NOT EXISTS linked_ticket_id uuid,
  ADD COLUMN IF NOT EXISTS linked_ticket_number text;

ALTER TABLE public.teacher_reports
  DROP CONSTRAINT IF EXISTS teacher_reports_report_status_check;

ALTER TABLE public.teacher_reports
  ADD CONSTRAINT teacher_reports_report_status_check
  CHECK (report_status IN ('new', 'confirmed', 'closed'));

DROP POLICY IF EXISTS "devices read auth" ON public.devices;
CREATE POLICY "devices staff read"
ON public.devices
FOR SELECT
USING (public.can_manage_school(auth.uid(), school_id));

DROP POLICY IF EXISTS "tickets staff read" ON public.tickets;
CREATE POLICY "tickets scoped staff read"
ON public.tickets
FOR SELECT
USING (public.can_manage_ticket(auth.uid(), school_ids));

DROP POLICY IF EXISTS "tickets staff write" ON public.tickets;
CREATE POLICY "tickets scoped staff write"
ON public.tickets
FOR ALL
USING (public.can_manage_ticket(auth.uid(), school_ids))
WITH CHECK (public.can_manage_ticket(auth.uid(), school_ids));

DROP POLICY IF EXISTS "reports staff read" ON public.teacher_reports;
CREATE POLICY "reports scoped read"
ON public.teacher_reports
FOR SELECT
USING (
  reporter_id = auth.uid()
  OR public.can_manage_school(auth.uid(), school_id)
);

CREATE POLICY "reports scoped update"
ON public.teacher_reports
FOR UPDATE
USING (public.can_manage_school(auth.uid(), school_id))
WITH CHECK (public.can_manage_school(auth.uid(), school_id));