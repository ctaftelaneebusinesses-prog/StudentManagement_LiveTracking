-- ============================================================================
-- Phase 40 — Extracurricular Staff Module (core)
-- Run AFTER 039_extracurricular_staff_role.sql.
--
-- Adds the core entities for Extracurricular Staff Management:
--   - activities: a shared master list backing both the "Staff Type"
--     dropdown (staff_title) and "Assign Activities" multi-select (name).
--     Global presets (school_id null) are seeded once below; a school adds
--     its own "Other" entry as a normal is_custom=true row rather than a
--     parallel free-text column, keeping one consistent, queryable list.
--   - extracurricular_staff: 1:1 extension of public.users, mirrors
--     public.teachers exactly (full_name/email/phone/avatar_url/is_active
--     stay on users).
--   - extracurricular_staff_activities: many-to-many "Assign Activities".
--   - extracurricular_batches / extracurricular_batch_students: "Assign
--     Classes" (academic year + class/section, either the entire class or a
--     hand-picked subset of students). batch_students is only ever populated
--     when scope = 'selected_students'; that invariant is enforced in the
--     backend service layer (backend/src/services/extracurricularStaff.service.ts),
--     the same way teacher.service.ts enforces "only one homeroom teacher"
--     in code rather than a DB constraint.
--   - next_extracurricular_staff_code(): atomic per-school staff-code
--     generator (ECS-{YY}-{0001}), since — unlike teachers.employee_id,
--     which is admin-entered — this feature explicitly requires
--     auto-generated Staff IDs.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. activities — shared master list.
-- ----------------------------------------------------------------------------
create table if not exists public.activities (
  id           uuid primary key default gen_random_uuid(),
  school_id    uuid references public.schools(id) on delete cascade, -- null = global preset, visible to every school
  name         text not null,              -- e.g. "Dance" — used in Assign Activities
  staff_title  text not null,              -- e.g. "Dance Teacher" — used in the Staff Type dropdown
  category     text,                       -- optional grouping, e.g. "Performing Arts" / "Sports" / "Music"
  is_custom    boolean not null default false, -- true for a school's own "Other" entry
  is_active    boolean not null default true,
  created_by   uuid references public.users(id) on delete set null,
  created_at   timestamptz not null default now(),
  unique (school_id, name)
);

create index if not exists idx_activities_school_id on public.activities(school_id);

alter table public.activities enable row level security;

-- Readable by any authenticated user in-school (or a global preset) —
-- extracurricular staff themselves need to read this list for dropdowns,
-- not just admin/principal.
create policy activities_select on public.activities
  for select
  using (school_id is null or school_id = public.current_school_id());

-- Seed global presets (school_id null) — the 16 spec staff types.
insert into public.activities (school_id, name, staff_title, category) values
  (null, 'Dance',          'Dance Teacher',          'Performing Arts'),
  (null, 'Yoga',           'Yoga Instructor',        'Fitness'),
  (null, 'PT',             'PT Teacher',             'Sports'),
  (null, 'Karate',         'Karate Coach',           'Martial Arts'),
  (null, 'Music',          'Music Teacher',          'Music'),
  (null, 'Singing',        'Singing Teacher',        'Music'),
  (null, 'Violin',         'Violin Instructor',      'Music'),
  (null, 'Keyboard',       'Keyboard Instructor',    'Music'),
  (null, 'Guitar',         'Guitar Instructor',      'Music'),
  (null, 'Drawing',        'Drawing Teacher',        'Visual Arts'),
  (null, 'Painting',       'Painting Teacher',       'Visual Arts'),
  (null, 'Chess',          'Chess Coach',            'Mind Sports'),
  (null, 'Skating',        'Skating Coach',          'Sports'),
  (null, 'Drama',          'Drama Instructor',       'Performing Arts'),
  (null, 'Spoken English', 'Spoken English Trainer', 'Language'),
  (null, 'Martial Arts',   'Martial Arts Coach',     'Martial Arts')
on conflict (school_id, name) do nothing;

-- ----------------------------------------------------------------------------
-- 2. extracurricular_staff — 1:1 extension of users, mirrors public.teachers.
-- ----------------------------------------------------------------------------
create table if not exists public.extracurricular_staff (
  id                     uuid primary key references public.users(id) on delete cascade,
  school_id              uuid not null references public.schools(id) on delete cascade,
  staff_code             text not null,
  staff_type_activity_id uuid not null references public.activities(id) on delete restrict,
  gender                 text check (gender in ('male', 'female', 'other')),
  date_of_birth          date,
  address                text,
  joining_date           date not null default current_date,
  qualification          text,
  experience_years       int check (experience_years is null or experience_years >= 0),
  bio                    text,
  created_at             timestamptz not null default now(),
  updated_at             timestamptz not null default now(),
  unique (school_id, staff_code)
);

create index if not exists idx_ec_staff_school_id on public.extracurricular_staff(school_id);
create index if not exists idx_ec_staff_type_activity on public.extracurricular_staff(staff_type_activity_id);

alter table public.extracurricular_staff enable row level security;

create policy ec_staff_select_staff on public.extracurricular_staff
  for select
  using (public.is_staff() and school_id = public.current_school_id());

create policy ec_staff_select_self on public.extracurricular_staff
  for select
  using (id = auth.uid());

-- ----------------------------------------------------------------------------
-- 3. extracurricular_staff_activities — many-to-many "Assign Activities".
-- ----------------------------------------------------------------------------
create table if not exists public.extracurricular_staff_activities (
  id           uuid primary key default gen_random_uuid(),
  school_id    uuid not null references public.schools(id) on delete cascade,
  staff_id     uuid not null references public.extracurricular_staff(id) on delete cascade,
  activity_id  uuid not null references public.activities(id) on delete restrict,
  assigned_at  timestamptz not null default now(),
  assigned_by  uuid references public.users(id) on delete set null,
  unique (staff_id, activity_id)
);

create index if not exists idx_ec_staff_activities_staff on public.extracurricular_staff_activities(staff_id);
create index if not exists idx_ec_staff_activities_school on public.extracurricular_staff_activities(school_id);

alter table public.extracurricular_staff_activities enable row level security;

create policy ec_staff_activities_select_staff on public.extracurricular_staff_activities
  for select
  using (public.is_staff() and school_id = public.current_school_id());

create policy ec_staff_activities_select_self on public.extracurricular_staff_activities
  for select
  using (staff_id = auth.uid());

-- ----------------------------------------------------------------------------
-- 4. extracurricular_batches — "Assign Classes" (academic year + class, and
--    whether the whole class or a selected subset of students trains).
-- ----------------------------------------------------------------------------
create table if not exists public.extracurricular_batches (
  id                uuid primary key default gen_random_uuid(),
  school_id         uuid not null references public.schools(id) on delete cascade,
  staff_id          uuid not null references public.extracurricular_staff(id) on delete cascade,
  activity_id       uuid not null references public.activities(id) on delete restrict,
  academic_year_id  uuid not null references public.academic_years(id) on delete cascade,
  class_id          uuid not null references public.classes(id) on delete cascade,
  scope             text not null check (scope in ('entire_class', 'selected_students')),
  name              text,
  created_by        uuid references public.users(id) on delete set null,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  unique (staff_id, activity_id, class_id, academic_year_id)
);

create index if not exists idx_ec_batches_school_id on public.extracurricular_batches(school_id);
create index if not exists idx_ec_batches_staff_id on public.extracurricular_batches(staff_id);
create index if not exists idx_ec_batches_class_id on public.extracurricular_batches(class_id);

alter table public.extracurricular_batches enable row level security;

create policy ec_batches_select_staff on public.extracurricular_batches
  for select
  using (public.is_staff() and school_id = public.current_school_id());

create policy ec_batches_select_self on public.extracurricular_batches
  for select
  using (staff_id = auth.uid());

-- ----------------------------------------------------------------------------
-- 5. extracurricular_batch_students — populated only when
--    extracurricular_batches.scope = 'selected_students'.
-- ----------------------------------------------------------------------------
create table if not exists public.extracurricular_batch_students (
  id          uuid primary key default gen_random_uuid(),
  batch_id    uuid not null references public.extracurricular_batches(id) on delete cascade,
  student_id  uuid not null references public.students(id) on delete cascade,
  added_at    timestamptz not null default now(),
  unique (batch_id, student_id)
);

create index if not exists idx_ec_batch_students_batch on public.extracurricular_batch_students(batch_id);
create index if not exists idx_ec_batch_students_student on public.extracurricular_batch_students(student_id);

alter table public.extracurricular_batch_students enable row level security;

create policy ec_batch_students_select_staff on public.extracurricular_batch_students
  for select
  using (
    public.is_staff()
    and exists (
      select 1 from public.extracurricular_batches b
      where b.id = batch_id and b.school_id = public.current_school_id()
    )
  );

create policy ec_batch_students_select_self on public.extracurricular_batch_students
  for select
  using (
    exists (
      select 1 from public.extracurricular_batches b
      where b.id = batch_id and b.staff_id = auth.uid()
    )
  );

-- ----------------------------------------------------------------------------
-- 6. next_extracurricular_staff_code — atomic per-school staff-code counter.
--    Uses a single insert..on conflict do update..returning statement so the
--    row lock makes concurrent creates safe, unlike an app-layer count(*)+1.
-- ----------------------------------------------------------------------------
create table if not exists public.extracurricular_staff_code_seq (
  school_id  uuid primary key references public.schools(id) on delete cascade,
  next_seq   int not null default 1
);

create or replace function public.next_extracurricular_staff_code(p_school_id uuid)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_seq  int;
  v_year text := to_char(current_date, 'YY');
begin
  insert into public.extracurricular_staff_code_seq (school_id, next_seq)
  values (p_school_id, 2)
  on conflict (school_id) do update set next_seq = extracurricular_staff_code_seq.next_seq + 1
  returning next_seq - 1 into v_seq;

  return 'ECS-' || v_year || '-' || lpad(v_seq::text, 4, '0');
end;
$$;
