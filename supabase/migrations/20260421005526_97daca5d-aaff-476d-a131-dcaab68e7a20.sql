
create type public.app_role as enum ('admin', 'technician', 'teacher');

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  full_name text,
  created_at timestamptz not null default now()
);

create table public.user_roles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  role public.app_role not null,
  created_at timestamptz not null default now(),
  unique (user_id, role)
);

create or replace function public.has_role(_user_id uuid, _role public.app_role)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.user_roles where user_id = _user_id and role = _role);
$$;

create or replace function public.is_staff(_user_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.user_roles where user_id = _user_id and role in ('admin','technician'));
$$;

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, email, full_name)
  values (new.id, new.email, coalesce(new.raw_user_meta_data->>'full_name', new.email));
  insert into public.user_roles (user_id, role) values (new.id, 'teacher');
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

create table public.schools (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  region text not null,
  gateway_reachable boolean not null default true,
  internet_check_ok boolean not null default true,
  status text not null default 'operational',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.devices (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete cascade,
  name text not null,
  type text not null,
  status text not null default 'operational',
  last_seen timestamptz not null default now()
);
create index on public.devices (school_id);

create table public.teacher_reports (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete cascade,
  reporter_id uuid references auth.users(id) on delete set null,
  type text not null,
  message text,
  created_at timestamptz not null default now()
);
create index on public.teacher_reports (school_id);

create table public.cloud_status (
  id int primary key default 1,
  service text not null default 'Amazon LEO',
  status text not null default 'operational',
  latency_ms int not null default 42,
  last_check timestamptz not null default now(),
  check (id = 1)
);
insert into public.cloud_status (id) values (1);

create table public.tickets (
  id uuid primary key default gen_random_uuid(),
  ticket_number text not null unique,
  root_cause text not null,
  priority text not null,
  status text not null default 'open',
  title text not null,
  description text,
  school_ids uuid[] not null default '{}',
  device_ids uuid[] not null default '{}',
  report_ids uuid[] not null default '{}',
  assignee_id uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create sequence public.ticket_seq start 1000;

create table public.activity_log (
  id uuid primary key default gen_random_uuid(),
  kind text not null,
  message text not null,
  meta jsonb,
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;
alter table public.user_roles enable row level security;
alter table public.schools enable row level security;
alter table public.devices enable row level security;
alter table public.teacher_reports enable row level security;
alter table public.cloud_status enable row level security;
alter table public.tickets enable row level security;
alter table public.activity_log enable row level security;

create policy "profiles self select" on public.profiles for select using (auth.uid() = id or public.is_staff(auth.uid()));
create policy "profiles self update" on public.profiles for update using (auth.uid() = id);

create policy "roles self select" on public.user_roles for select using (auth.uid() = user_id or public.has_role(auth.uid(),'admin'));
create policy "roles admin insert" on public.user_roles for insert with check (public.has_role(auth.uid(),'admin'));
create policy "roles admin update" on public.user_roles for update using (public.has_role(auth.uid(),'admin'));
create policy "roles admin delete" on public.user_roles for delete using (public.has_role(auth.uid(),'admin'));

create policy "schools read auth" on public.schools for select to authenticated using (true);
create policy "schools staff write" on public.schools for all to authenticated using (public.is_staff(auth.uid())) with check (public.is_staff(auth.uid()));

create policy "devices read auth" on public.devices for select to authenticated using (true);
create policy "devices staff write" on public.devices for all to authenticated using (public.is_staff(auth.uid())) with check (public.is_staff(auth.uid()));

create policy "cloud read auth" on public.cloud_status for select to authenticated using (true);
create policy "cloud staff write" on public.cloud_status for all to authenticated using (public.is_staff(auth.uid())) with check (public.is_staff(auth.uid()));

create policy "reports staff read" on public.teacher_reports for select to authenticated using (public.is_staff(auth.uid()) or reporter_id = auth.uid());
create policy "reports auth insert" on public.teacher_reports for insert to authenticated with check (auth.uid() is not null);

create policy "tickets staff read" on public.tickets for select using (public.is_staff(auth.uid()));
create policy "tickets staff write" on public.tickets for all using (public.is_staff(auth.uid())) with check (public.is_staff(auth.uid()));

create policy "activity staff read" on public.activity_log for select using (public.is_staff(auth.uid()));
create policy "activity staff write" on public.activity_log for all using (public.is_staff(auth.uid())) with check (public.is_staff(auth.uid()));

alter publication supabase_realtime add table public.tickets;
alter publication supabase_realtime add table public.schools;
alter publication supabase_realtime add table public.devices;
alter publication supabase_realtime add table public.cloud_status;
alter publication supabase_realtime add table public.activity_log;
alter publication supabase_realtime add table public.teacher_reports;

-- Seed one deletable demo school + 3 devices
with s as (
  insert into public.schools (name, region, status)
  values ('Demo School (delete me)', 'Demo Region', 'operational')
  returning id
)
insert into public.devices (school_id, name, type, status)
select s.id, x.name, x.type, 'operational'
from s, (values ('Gateway-01','gateway'),('Switch-01','switch'),('AP-01','ap')) as x(name, type);
