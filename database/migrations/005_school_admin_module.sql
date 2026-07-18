-- ============================================================================
-- Phase 3 — School Administration Module
-- Run AFTER 004_avatar_storage.sql.
--
-- Adds: school settings/branding columns, academic_years, branches, links
-- classes to branch/academic_year, and seeds the new permission codes this
-- module's endpoints check.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. School profile/settings
-- ----------------------------------------------------------------------------
alter table public.schools
  add column if not exists logo_url text,
  add column if not exists settings jsonb not null default '{}'::jsonb;

-- ----------------------------------------------------------------------------
-- 2. Academic years — one school can have many, exactly one "current".
-- ----------------------------------------------------------------------------
create table if not exists public.academic_years (
  id           uuid primary key default gen_random_uuid(),
  school_id    uuid not null references public.schools(id) on delete cascade,
  name         text not null,              -- e.g. "2026-2027"
  start_date   date not null,
  end_date     date not null,
  is_current   boolean not null default false,
  created_at   timestamptz not null default now(),
  unique (school_id, name),
  check (end_date > start_date)
);

create index if not exists idx_academic_years_school_id on public.academic_years(school_id);

-- Only one current academic year per school.
create unique index if not exists idx_academic_years_one_current
  on public.academic_years(school_id)
  where is_current;

-- ----------------------------------------------------------------------------
-- 3. Branches — a school may operate multiple physical campuses.
-- ----------------------------------------------------------------------------
create table if not exists public.branches (
  id           uuid primary key default gen_random_uuid(),
  school_id    uuid not null references public.schools(id) on delete cascade,
  name         text not null,
  address      text,
  is_main      boolean not null default false,
  is_active    boolean not null default true,
  created_at   timestamptz not null default now(),
  unique (school_id, name)
);

create index if not exists idx_branches_school_id on public.branches(school_id);

-- ----------------------------------------------------------------------------
-- 4. Link classes to branch + academic year (replacing the free-text
--    academic_year column from the Phase 1 schema — no production data
--    exists yet, so this is a clean cut rather than a backfill migration).
-- ----------------------------------------------------------------------------
alter table public.classes
  add column if not exists branch_id uuid references public.branches(id) on delete set null,
  add column if not exists academic_year_id uuid references public.academic_years(id) on delete restrict;

alter table public.classes drop constraint if exists classes_school_id_name_section_academic_year_key;
alter table public.classes drop column if exists academic_year;

create unique index if not exists idx_classes_unique_section
  on public.classes(school_id, name, section, academic_year_id);

create index if not exists idx_classes_branch_id on public.classes(branch_id);
create index if not exists idx_classes_academic_year_id on public.classes(academic_year_id);

-- ----------------------------------------------------------------------------
-- 5. Permissions for this module (school_admin gets all; principal gets the
--    academic ones; teacher gets read-only students, already seeded).
-- ----------------------------------------------------------------------------
insert into public.permissions (code, description) values
  ('branches.manage', 'Create and manage school branches/campuses'),
  ('academic_years.manage', 'Create and manage academic years')
on conflict (code) do nothing;

insert into public.role_permissions (role_id, permission_id)
select (select id from public.roles where name = 'school_admin'), id
from public.permissions
where code in ('branches.manage', 'academic_years.manage')
on conflict do nothing;

-- ----------------------------------------------------------------------------
-- 6. RLS for the new tables — same shape as existing school-scoped tables.
-- ----------------------------------------------------------------------------
alter table public.academic_years enable row level security;

create policy academic_years_select_same_school on public.academic_years
  for select
  using (public.is_super_admin() or school_id = public.current_school_id());

create policy academic_years_write_staff on public.academic_years
  for all
  using (public.is_super_admin() or (public.is_staff() and school_id = public.current_school_id()))
  with check (public.is_super_admin() or school_id = public.current_school_id());

alter table public.branches enable row level security;

create policy branches_select_same_school on public.branches
  for select
  using (public.is_super_admin() or school_id = public.current_school_id());

create policy branches_write_staff on public.branches
  for all
  using (public.is_super_admin() or (public.is_staff() and school_id = public.current_school_id()))
  with check (public.is_super_admin() or school_id = public.current_school_id());
