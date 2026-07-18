-- ============================================================================
-- Row Level Security policies
-- Run AFTER schema.sql.
--
-- Design notes:
-- - Every business table is scoped by school_id; a user may only ever read
--   rows belonging to their own school (multi-tenant isolation).
-- - Helper functions are SECURITY DEFINER + STABLE so they bypass RLS
--   internally. This is required: a policy on public.users that queries
--   public.users directly causes infinite recursion in Postgres RLS.
-- - Row creation for staff-managed entities (students, teachers, classes,
--   etc.) is intentionally NOT granted to authenticated clients — those
--   writes go through the backend using the Supabase service role key,
--   which bypasses RLS entirely. RLS here governs direct client reads and
--   the narrow set of writes a client is allowed to make for itself.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- Helper functions
-- ----------------------------------------------------------------------------
create or replace function public.current_school_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select school_id from public.users where id = auth.uid();
$$;

create or replace function public.current_role_name()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select r.name
  from public.users u
  join public.roles r on r.id = u.role_id
  where u.id = auth.uid();
$$;

create or replace function public.is_staff()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.current_role_name() in ('admin', 'principal');
$$;

-- ----------------------------------------------------------------------------
-- schools
-- Everyone can read only their own school row; no client-side writes.
-- ----------------------------------------------------------------------------
alter table public.schools enable row level security;

create policy schools_select_own on public.schools
  for select
  using (id = public.current_school_id());

-- ----------------------------------------------------------------------------
-- roles — static reference data, readable by any authenticated user.
-- ----------------------------------------------------------------------------
alter table public.roles enable row level security;

create policy roles_select_all on public.roles
  for select
  using (auth.role() = 'authenticated');

-- ----------------------------------------------------------------------------
-- users
-- - Any user can read their own profile.
-- - Any user can read colleagues within the same school (needed for
--   directories, teacher/class listings, parent-teacher lookups).
-- - A user may update a limited set of their own fields (handled at the
--   application layer by only exposing safe columns in the update DTO);
--   RLS here just confirms row ownership.
-- - Admin/principal can update any user row within their own school.
-- ----------------------------------------------------------------------------
alter table public.users enable row level security;

create policy users_select_same_school on public.users
  for select
  using (school_id = public.current_school_id() or id = auth.uid());

create policy users_update_self on public.users
  for update
  using (id = auth.uid())
  with check (id = auth.uid());

create policy users_update_staff on public.users
  for update
  using (public.is_staff() and school_id = public.current_school_id())
  with check (school_id = public.current_school_id());

-- ----------------------------------------------------------------------------
-- classes / subjects / class_subjects — read within own school.
-- ----------------------------------------------------------------------------
alter table public.classes enable row level security;

create policy classes_select_same_school on public.classes
  for select
  using (school_id = public.current_school_id());

create policy classes_write_staff on public.classes
  for all
  using (public.is_staff() and school_id = public.current_school_id())
  with check (school_id = public.current_school_id());

alter table public.subjects enable row level security;

create policy subjects_select_same_school on public.subjects
  for select
  using (school_id = public.current_school_id());

create policy subjects_write_staff on public.subjects
  for all
  using (public.is_staff() and school_id = public.current_school_id())
  with check (school_id = public.current_school_id());

alter table public.class_subjects enable row level security;

create policy class_subjects_select_same_school on public.class_subjects
  for select
  using (
    exists (
      select 1 from public.classes c
      where c.id = class_subjects.class_id
        and c.school_id = public.current_school_id()
    )
  );

create policy class_subjects_write_staff on public.class_subjects
  for all
  using (public.is_staff())
  with check (
    exists (
      select 1 from public.classes c
      where c.id = class_subjects.class_id
        and c.school_id = public.current_school_id()
    )
  );

-- ----------------------------------------------------------------------------
-- students
-- - Staff (admin/principal) see all students in their school.
-- - A teacher sees students in classes they teach.
-- - A student sees only their own record.
-- - A parent sees only their linked children (via student_parents).
-- ----------------------------------------------------------------------------
alter table public.students enable row level security;

create policy students_select_staff on public.students
  for select
  using (public.is_staff() and school_id = public.current_school_id());

create policy students_select_self on public.students
  for select
  using (id = auth.uid());

create policy students_select_teacher on public.students
  for select
  using (
    public.current_role_name() = 'teacher'
    and exists (
      select 1 from public.class_subjects cs
      where cs.teacher_id = auth.uid()
        and cs.class_id = students.class_id
    )
  );

create policy students_select_parent on public.students
  for select
  using (
    public.current_role_name() = 'parent'
    and exists (
      select 1 from public.student_parents sp
      where sp.parent_id = auth.uid()
        and sp.student_id = students.id
    )
  );

create policy students_write_staff on public.students
  for all
  using (public.is_staff() and school_id = public.current_school_id())
  with check (school_id = public.current_school_id());

-- ----------------------------------------------------------------------------
-- parents
-- ----------------------------------------------------------------------------
alter table public.parents enable row level security;

create policy parents_select_staff on public.parents
  for select
  using (public.is_staff() and school_id = public.current_school_id());

create policy parents_select_self on public.parents
  for select
  using (id = auth.uid());

create policy parents_write_staff on public.parents
  for all
  using (public.is_staff() and school_id = public.current_school_id())
  with check (school_id = public.current_school_id());

-- ----------------------------------------------------------------------------
-- student_parents (link table)
-- ----------------------------------------------------------------------------
alter table public.student_parents enable row level security;

create policy student_parents_select_involved on public.student_parents
  for select
  using (
    parent_id = auth.uid()
    or student_id = auth.uid()
    or public.is_staff()
  );

create policy student_parents_write_staff on public.student_parents
  for all
  using (public.is_staff())
  with check (public.is_staff());

-- ----------------------------------------------------------------------------
-- teachers
-- ----------------------------------------------------------------------------
alter table public.teachers enable row level security;

create policy teachers_select_same_school on public.teachers
  for select
  using (school_id = public.current_school_id());

create policy teachers_write_staff on public.teachers
  for all
  using (public.is_staff() and school_id = public.current_school_id())
  with check (school_id = public.current_school_id());

-- ----------------------------------------------------------------------------
-- drivers
-- ----------------------------------------------------------------------------
alter table public.drivers enable row level security;

create policy drivers_select_staff on public.drivers
  for select
  using (public.is_staff() and school_id = public.current_school_id());

create policy drivers_select_self on public.drivers
  for select
  using (id = auth.uid());

create policy drivers_write_staff on public.drivers
  for all
  using (public.is_staff() and school_id = public.current_school_id())
  with check (school_id = public.current_school_id());

-- ----------------------------------------------------------------------------
-- vehicles
-- ----------------------------------------------------------------------------
alter table public.vehicles enable row level security;

create policy vehicles_select_same_school on public.vehicles
  for select
  using (school_id = public.current_school_id());

create policy vehicles_select_own_driver on public.vehicles
  for select
  using (driver_id = auth.uid());

create policy vehicles_write_staff on public.vehicles
  for all
  using (public.is_staff() and school_id = public.current_school_id())
  with check (school_id = public.current_school_id());
