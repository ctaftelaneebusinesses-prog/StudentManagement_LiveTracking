-- ============================================================================
-- Phase 6 — Student Profile enhancements: richer personal information,
-- mandatory quick-capture Father/Mother contacts, and sibling linking.
-- Run AFTER 024_school_logo_storage.sql.
--
-- Design notes:
--   1. Father/Mother fields are stored directly on `students` (not via the
--      `parents` + `student_parents` login-account system) because they are
--      a mandatory quick-capture at admission time with an OPTIONAL email —
--      the existing `parents` flow provisions a full Supabase Auth account
--      per parent and requires an email. Schools that also want a parent to
--      have portal access still use the existing "Add parent" / "Link
--      existing" flow on the Parents tab, untouched by this migration.
--   2. `student_siblings` is a new, standalone join table for manually
--      linking two students in the same school as siblings. It is stored
--      bidirectionally (one row per direction) so `where student_id = X`
--      always returns the full sibling list without a UNION.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. Personal information — free-text fields, same level of detail as the
--    existing address/medical fields.
-- ----------------------------------------------------------------------------
alter table public.students
  add column if not exists place_of_birth text,
  add column if not exists nationality    text,
  add column if not exists religion       text,
  add column if not exists category       text,
  add column if not exists city           text,
  add column if not exists district       text,
  add column if not exists state          text,
  add column if not exists pin_code       text;

-- ----------------------------------------------------------------------------
-- 2. Father / Mother quick-contact fields. At least one parent's name +
--    mobile number is required — enforced here as a DB-level backstop and in
--    the Zod validator (student.validator.ts) for a clean 400 response.
-- ----------------------------------------------------------------------------
alter table public.students
  add column if not exists father_name       text,
  add column if not exists father_phone      text,
  add column if not exists father_email      text,
  add column if not exists father_occupation text,
  add column if not exists mother_name       text,
  add column if not exists mother_phone      text,
  add column if not exists mother_email      text,
  add column if not exists mother_occupation text;

alter table public.students
  drop constraint if exists students_parent_contact_required;

alter table public.students
  add constraint students_parent_contact_required
  check (
    (father_name is not null and father_phone is not null)
    or (mother_name is not null and mother_phone is not null)
  ) not valid;

-- Existing rows (created before this migration) are not required to satisfy
-- the constraint retroactively; only newly inserted/updated rows are checked.
-- Run `alter table public.students validate constraint students_parent_contact_required;`
-- manually once historical data has been backfilled, if full enforcement is desired.

-- ----------------------------------------------------------------------------
-- 3. student_siblings — manual sibling linking within the same school.
-- ----------------------------------------------------------------------------
create table if not exists public.student_siblings (
  student_id  uuid not null references public.students(id) on delete cascade,
  sibling_id  uuid not null references public.students(id) on delete cascade,
  school_id   uuid not null references public.schools(id) on delete cascade,
  created_at  timestamptz not null default now(),
  primary key (student_id, sibling_id),
  check (student_id <> sibling_id)
);

create index if not exists idx_student_siblings_student_id on public.student_siblings(student_id);
create index if not exists idx_student_siblings_school_id on public.student_siblings(school_id);

alter table public.student_siblings enable row level security;

create policy student_siblings_select_staff on public.student_siblings
  for select
  using (public.is_staff() and school_id = public.current_school_id());

create policy student_siblings_select_self on public.student_siblings
  for select
  using (student_id = auth.uid());

create policy student_siblings_select_parent on public.student_siblings
  for select
  using (
    exists (
      select 1 from public.student_parents sp
      where sp.parent_id = auth.uid() and sp.student_id = student_siblings.student_id
    )
  );

create policy student_siblings_write_staff on public.student_siblings
  for all
  using (public.is_staff() and school_id = public.current_school_id())
  with check (school_id = public.current_school_id());
