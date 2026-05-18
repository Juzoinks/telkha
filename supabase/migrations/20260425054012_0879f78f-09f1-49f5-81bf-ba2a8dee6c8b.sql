-- New tables
create table if not exists public.site_notes (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null,
  author_id uuid,
  content text not null,
  created_at timestamptz not null default now()
);
alter table public.site_notes enable row level security;

create table if not exists public.maintenance_windows (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null,
  start_at timestamptz not null default now(),
  end_at timestamptz not null,
  reason text,
  created_by uuid,
  created_at timestamptz not null default now()
);
alter table public.maintenance_windows enable row level security;

create table if not exists public.ticket_comments (
  id uuid primary key default gen_random_uuid(),
  ticket_id uuid not null,
  author_id uuid,
  content text not null,
  created_at timestamptz not null default now()
);
alter table public.ticket_comments enable row level security;

create table if not exists public.ticket_attachments (
  id uuid primary key default gen_random_uuid(),
  ticket_id uuid not null,
  file_url text not null,
  file_name text not null,
  file_size integer,
  uploaded_by uuid,
  created_at timestamptz not null default now()
);
alter table public.ticket_attachments enable row level security;

create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  type text not null,
  title text not null,
  body text,
  payload jsonb default '{}'::jsonb,
  read boolean not null default false,
  created_at timestamptz not null default now()
);
alter table public.notifications enable row level security;
create index if not exists notifications_user_idx on public.notifications(user_id, created_at desc);

create table if not exists public.audit_log (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid,
  action text not null,
  target_type text not null,
  target_id text,
  diff jsonb default '{}'::jsonb,
  created_at timestamptz not null default now()
);
alter table public.audit_log enable row level security;

create table if not exists public.analytics_snapshots (
  id uuid primary key default gen_random_uuid(),
  snapshot_at timestamptz not null default now(),
  online_count integer not null default 0,
  offline_count integer not null default 0,
  degraded_count integer not null default 0,
  open_tickets integer not null default 0
);
alter table public.analytics_snapshots enable row level security;

create table if not exists public.notification_preferences (
  user_id uuid primary key,
  ticket_assigned boolean not null default true,
  sla_breached boolean not null default true,
  report_review boolean not null default true,
  outage_simulation boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.notification_preferences enable row level security;

create table if not exists public.user_settings (
  user_id uuid primary key,
  theme text not null default 'dark',
  alert_threshold_pct integer not null default 10,
  updated_at timestamptz not null default now()
);
alter table public.user_settings enable row level security;

-- Field additions
alter table public.schools add column if not exists province text;
alter table public.schools add column if not exists isp_type text;
alter table public.schools add column if not exists last_visit_at timestamptz;

alter table public.tickets add column if not exists sla_due_at timestamptz;
alter table public.tickets add column if not exists resolution_notes text;
alter table public.tickets add column if not exists confidence integer default 80;
alter table public.tickets add column if not exists closed_at timestamptz;

alter table public.devices add column if not exists uptime_pct numeric(5,2) default 99.5;
alter table public.devices add column if not exists config_hash text;

alter table public.profiles add column if not exists is_active boolean not null default true;

-- Helper
create or replace function public.can_access_ticket(_user_id uuid, _ticket_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.tickets t
    where t.id = _ticket_id and public.can_manage_ticket(_user_id, t.school_ids)
  );
$$;

-- RLS policies
drop policy if exists "site_notes read" on public.site_notes;
create policy "site_notes read" on public.site_notes for select using (public.can_manage_school(auth.uid(), school_id));
drop policy if exists "site_notes write" on public.site_notes;
create policy "site_notes write" on public.site_notes for all using (public.can_manage_school(auth.uid(), school_id)) with check (public.can_manage_school(auth.uid(), school_id));

drop policy if exists "mw read" on public.maintenance_windows;
create policy "mw read" on public.maintenance_windows for select using (auth.uid() is not null);
drop policy if exists "mw write" on public.maintenance_windows;
create policy "mw write" on public.maintenance_windows for all using (public.can_manage_school(auth.uid(), school_id)) with check (public.can_manage_school(auth.uid(), school_id));

drop policy if exists "tc read" on public.ticket_comments;
create policy "tc read" on public.ticket_comments for select using (public.can_access_ticket(auth.uid(), ticket_id));
drop policy if exists "tc write" on public.ticket_comments;
create policy "tc write" on public.ticket_comments for all using (public.can_access_ticket(auth.uid(), ticket_id)) with check (public.can_access_ticket(auth.uid(), ticket_id));

drop policy if exists "ta read" on public.ticket_attachments;
create policy "ta read" on public.ticket_attachments for select using (public.can_access_ticket(auth.uid(), ticket_id));
drop policy if exists "ta write" on public.ticket_attachments;
create policy "ta write" on public.ticket_attachments for all using (public.can_access_ticket(auth.uid(), ticket_id)) with check (public.can_access_ticket(auth.uid(), ticket_id));

drop policy if exists "notif self read" on public.notifications;
create policy "notif self read" on public.notifications for select using (auth.uid() = user_id);
drop policy if exists "notif self update" on public.notifications;
create policy "notif self update" on public.notifications for update using (auth.uid() = user_id);
drop policy if exists "notif staff insert" on public.notifications;
create policy "notif staff insert" on public.notifications for insert with check (public.is_staff(auth.uid()) or auth.uid() = user_id);

drop policy if exists "audit admin read" on public.audit_log;
create policy "audit admin read" on public.audit_log for select using (public.has_role(auth.uid(), 'admin'));
drop policy if exists "audit auth insert" on public.audit_log;
create policy "audit auth insert" on public.audit_log for insert with check (auth.uid() is not null);

drop policy if exists "snap staff read" on public.analytics_snapshots;
create policy "snap staff read" on public.analytics_snapshots for select using (public.is_staff(auth.uid()));
drop policy if exists "snap staff write" on public.analytics_snapshots;
create policy "snap staff write" on public.analytics_snapshots for all using (public.is_staff(auth.uid())) with check (public.is_staff(auth.uid()));

drop policy if exists "np self all" on public.notification_preferences;
create policy "np self all" on public.notification_preferences for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "us self all" on public.user_settings;
create policy "us self all" on public.user_settings for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Realtime: only add if not already a member
do $$
declare
  t text;
begin
  for t in select unnest(array['notifications','ticket_comments','audit_log','site_notes','maintenance_windows','ticket_attachments','analytics_snapshots']) loop
    if not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = t
    ) then
      execute format('alter publication supabase_realtime add table public.%I', t);
    end if;
  end loop;
end $$;