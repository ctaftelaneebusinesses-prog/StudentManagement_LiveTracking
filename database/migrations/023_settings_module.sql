-- ============================================================================
-- Phase — Settings Module
-- Adds: departments, holiday calendar, login history, and a curated admin
-- activity log. Email/Notification/Backup/Working-Days settings reuse the
-- existing schools.settings jsonb column (added in 005) — no new tables
-- needed for those.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. Departments — groups subjects/teachers, optionally under a head teacher.
-- ----------------------------------------------------------------------------
create table if not exists public.departments (
  id              uuid primary key default gen_random_uuid(),
  school_id       uuid not null references public.schools(id) on delete cascade,
  name            text not null,
  description     text,
  head_teacher_id uuid references public.teachers(id) on delete set null,
  created_at      timestamptz not null default now(),
  unique (school_id, name)
);

create index if not exists idx_departments_school_id on public.departments(school_id);

-- ----------------------------------------------------------------------------
-- 2. Holidays — day-by-day calendar entries, optionally tied to an academic year.
-- ----------------------------------------------------------------------------
create table if not exists public.holidays (
  id                  uuid primary key default gen_random_uuid(),
  school_id           uuid not null references public.schools(id) on delete cascade,
  academic_year_id    uuid references public.academic_years(id) on delete set null,
  name                text not null,
  date                date not null,
  is_recurring_yearly boolean not null default false,
  created_at          timestamptz not null default now()
);

create index if not exists idx_holidays_school_id on public.holidays(school_id);
create index if not exists idx_holidays_date on public.holidays(date);

-- ----------------------------------------------------------------------------
-- 3. Login history — every login attempt (success or failure), written
--    server-side only (service-role client bypasses RLS; no insert policy
--    is needed since no client ever writes this table directly).
-- ----------------------------------------------------------------------------
create table if not exists public.login_history (
  id          uuid primary key default gen_random_uuid(),
  school_id   uuid references public.schools(id) on delete cascade,
  user_id     uuid references public.users(id) on delete set null,
  email       text not null,
  success     boolean not null,
  ip_address  text,
  user_agent  text,
  created_at  timestamptz not null default now()
);

create index if not exists idx_login_history_school_id on public.login_history(school_id);
create index if not exists idx_login_history_created_at on public.login_history(created_at desc);

-- ----------------------------------------------------------------------------
-- 4. Activity log — curated set of sensitive admin actions, also server-role
--    written only.
-- ----------------------------------------------------------------------------
create table if not exists public.activity_logs (
  id              uuid primary key default gen_random_uuid(),
  school_id       uuid not null references public.schools(id) on delete cascade,
  actor_user_id   uuid references public.users(id) on delete set null,
  action          text not null,
  target_type     text,
  target_id       uuid,
  metadata        jsonb not null default '{}'::jsonb,
  created_at      timestamptz not null default now()
);

create index if not exists idx_activity_logs_school_id on public.activity_logs(school_id);
create index if not exists idx_activity_logs_created_at on public.activity_logs(created_at desc);

-- ----------------------------------------------------------------------------
-- 5. Permissions.
-- ----------------------------------------------------------------------------
insert into public.permissions (code, description) values
  ('departments.manage',   'Create and manage academic departments'),
  ('calendar.manage',      'Manage the holiday calendar and working days'),
  ('security_logs.view',   'View login history and the admin activity log')
on conflict (code) do nothing;

insert into public.role_permissions (role_id, permission_id)
select (select id from public.roles where name = 'school_admin'), id
from public.permissions
where code in ('departments.manage', 'calendar.manage', 'security_logs.view')
on conflict do nothing;

insert into public.role_permissions (role_id, permission_id)
select (select id from public.roles where name = 'super_admin'), id
from public.permissions
where code in ('departments.manage', 'calendar.manage', 'security_logs.view')
on conflict do nothing;

-- ----------------------------------------------------------------------------
-- 6. RLS — same shape as branches/academic_years (003/005).
-- ----------------------------------------------------------------------------
alter table public.departments enable row level security;

create policy departments_select_same_school on public.departments
  for select
  using (public.is_super_admin() or school_id = public.current_school_id());

create policy departments_write_staff on public.departments
  for all
  using (public.is_super_admin() or (public.is_staff() and school_id = public.current_school_id()))
  with check (public.is_super_admin() or school_id = public.current_school_id());

alter table public.holidays enable row level security;

create policy holidays_select_same_school on public.holidays
  for select
  using (public.is_super_admin() or school_id = public.current_school_id());

create policy holidays_write_staff on public.holidays
  for all
  using (public.is_super_admin() or (public.is_staff() and school_id = public.current_school_id()))
  with check (public.is_super_admin() or school_id = public.current_school_id());

alter table public.login_history enable row level security;

create policy login_history_select_staff on public.login_history
  for select
  using (public.is_super_admin() or (public.is_staff() and school_id = public.current_school_id()));

alter table public.activity_logs enable row level security;

create policy activity_logs_select_staff on public.activity_logs
  for select
  using (public.is_super_admin() or (public.is_staff() and school_id = public.current_school_id()));
