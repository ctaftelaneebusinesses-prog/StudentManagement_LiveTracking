-- ============================================================================
-- Phase 41 — Extracurricular Staff Module extras
-- Run AFTER 040_extracurricular_staff_module.sql.
--
-- Adds what the Extracurricular Staff self-service portal needs: a weekly
-- schedule of recurring slots per batch, session-level student attendance
-- (distinct from teacher_attendance, which tracks a teacher's own daily
-- presence — this tracks students' attendance *in* an extracurricular
-- session), practice-work assignments (no submission table — the spec only
-- asks staff to assign, not students to submit), activity events, and an
-- achievements/certificates upload table + its private storage bucket.
--
-- Not built in this pass (flagged, not silently decided): no personal
-- attendance/leave table for extracurricular staff themselves — the spec
-- only asks them to mark attendance for their students.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. extracurricular_schedule_slots — Weekly Schedule. Overlap conflicts are
--    checked in the service layer (backend/src/services/extracurricularStaff.service.ts),
--    same approach as timetable.service.ts — no DB-level exclusion constraint.
-- ----------------------------------------------------------------------------
create table if not exists public.extracurricular_schedule_slots (
  id           uuid primary key default gen_random_uuid(),
  school_id    uuid not null references public.schools(id) on delete cascade,
  batch_id     uuid not null references public.extracurricular_batches(id) on delete cascade,
  staff_id     uuid not null references public.extracurricular_staff(id) on delete cascade, -- denormalized for fast "my weekly schedule" reads
  day_of_week  smallint not null check (day_of_week between 0 and 6), -- 0 = Sunday
  start_time   time not null,
  end_time     time not null,
  venue        text,
  created_at   timestamptz not null default now(),
  check (end_time > start_time)
);

create index if not exists idx_ec_schedule_staff_day on public.extracurricular_schedule_slots(staff_id, day_of_week);
create index if not exists idx_ec_schedule_batch on public.extracurricular_schedule_slots(batch_id);
create index if not exists idx_ec_schedule_school on public.extracurricular_schedule_slots(school_id);

alter table public.extracurricular_schedule_slots enable row level security;

create policy ec_schedule_select_staff on public.extracurricular_schedule_slots
  for select
  using (public.is_staff() and school_id = public.current_school_id());

create policy ec_schedule_select_self on public.extracurricular_schedule_slots
  for select
  using (staff_id = auth.uid());

-- ----------------------------------------------------------------------------
-- 2. extracurricular_attendance — student attendance within an
--    extracurricular session, one row per student/batch/date.
-- ----------------------------------------------------------------------------
create table if not exists public.extracurricular_attendance (
  id           uuid primary key default gen_random_uuid(),
  school_id    uuid not null references public.schools(id) on delete cascade,
  batch_id     uuid not null references public.extracurricular_batches(id) on delete cascade,
  staff_id     uuid not null references public.extracurricular_staff(id) on delete cascade,
  student_id   uuid not null references public.students(id) on delete cascade,
  session_date date not null,
  status       text not null check (status in ('present', 'absent', 'late', 'excused')),
  remarks      text,
  marked_by    uuid references public.users(id) on delete set null,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  unique (batch_id, student_id, session_date)
);

create index if not exists idx_ec_attendance_school on public.extracurricular_attendance(school_id);
create index if not exists idx_ec_attendance_batch_date on public.extracurricular_attendance(batch_id, session_date);
create index if not exists idx_ec_attendance_student on public.extracurricular_attendance(student_id);
create index if not exists idx_ec_attendance_staff on public.extracurricular_attendance(staff_id);

alter table public.extracurricular_attendance enable row level security;

create policy ec_attendance_select_staff on public.extracurricular_attendance
  for select
  using (public.is_staff() and school_id = public.current_school_id());

create policy ec_attendance_select_self on public.extracurricular_attendance
  for select
  using (staff_id = auth.uid());

-- ----------------------------------------------------------------------------
-- 3. extracurricular_practice_work — "Assign practice work" (mirrors
--    homework's shape; no submissions table).
-- ----------------------------------------------------------------------------
create table if not exists public.extracurricular_practice_work (
  id             uuid primary key default gen_random_uuid(),
  school_id      uuid not null references public.schools(id) on delete cascade,
  batch_id       uuid not null references public.extracurricular_batches(id) on delete cascade,
  staff_id       uuid not null references public.extracurricular_staff(id) on delete cascade,
  title          text not null,
  description    text,
  due_date       date,
  attachment_url text,
  created_at     timestamptz not null default now()
);

create index if not exists idx_ec_practice_work_batch on public.extracurricular_practice_work(batch_id);
create index if not exists idx_ec_practice_work_school on public.extracurricular_practice_work(school_id);
create index if not exists idx_ec_practice_work_staff on public.extracurricular_practice_work(staff_id);

alter table public.extracurricular_practice_work enable row level security;

create policy ec_practice_work_select_staff on public.extracurricular_practice_work
  for select
  using (public.is_staff() and school_id = public.current_school_id());

create policy ec_practice_work_select_self on public.extracurricular_practice_work
  for select
  using (staff_id = auth.uid());

-- ----------------------------------------------------------------------------
-- 4. extracurricular_events — "Create activity events".
-- ----------------------------------------------------------------------------
create table if not exists public.extracurricular_events (
  id           uuid primary key default gen_random_uuid(),
  school_id    uuid not null references public.schools(id) on delete cascade,
  staff_id     uuid not null references public.extracurricular_staff(id) on delete cascade,
  activity_id  uuid references public.activities(id) on delete set null,
  batch_id     uuid references public.extracurricular_batches(id) on delete set null,
  title        text not null,
  description  text,
  event_date   date not null,
  start_time   time,
  end_time     time,
  venue        text,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create index if not exists idx_ec_events_school on public.extracurricular_events(school_id);
create index if not exists idx_ec_events_staff on public.extracurricular_events(staff_id);
create index if not exists idx_ec_events_date on public.extracurricular_events(school_id, event_date);

alter table public.extracurricular_events enable row level security;

create policy ec_events_select_staff on public.extracurricular_events
  for select
  using (public.is_staff() and school_id = public.current_school_id());

create policy ec_events_select_self on public.extracurricular_events
  for select
  using (staff_id = auth.uid());

-- ----------------------------------------------------------------------------
-- 5. extracurricular_achievements — "Upload achievements/certificates".
--    student_id null means the staff member's own credential.
-- ----------------------------------------------------------------------------
create table if not exists public.extracurricular_achievements (
  id            uuid primary key default gen_random_uuid(),
  school_id     uuid not null references public.schools(id) on delete cascade,
  staff_id      uuid not null references public.extracurricular_staff(id) on delete cascade,
  activity_id   uuid references public.activities(id) on delete set null,
  student_id    uuid references public.students(id) on delete cascade,
  title         text not null,
  description   text,
  achieved_on   date,
  file_name     text not null,
  storage_path  text not null,
  uploaded_by   uuid references public.users(id) on delete set null,
  uploaded_at   timestamptz not null default now()
);

create index if not exists idx_ec_achievements_school on public.extracurricular_achievements(school_id);
create index if not exists idx_ec_achievements_staff on public.extracurricular_achievements(staff_id);
create index if not exists idx_ec_achievements_student on public.extracurricular_achievements(student_id);

alter table public.extracurricular_achievements enable row level security;

create policy ec_achievements_select_staff on public.extracurricular_achievements
  for select
  using (public.is_staff() and school_id = public.current_school_id());

create policy ec_achievements_select_self on public.extracurricular_achievements
  for select
  using (staff_id = auth.uid());

-- ----------------------------------------------------------------------------
-- 6. extracurricular-achievements storage bucket — private, same pattern as
--    teacher-documents (007_teacher_module.sql / 017_teacher_module_extras.sql).
--    Files keyed as `{school_id}/{staff_id}/{filename}`. Profile photos reuse
--    the existing `avatars` bucket (004_avatar_storage.sql /
--    016_student_management_extras.sql already grant staff-write + self-write
--    there) — no new bucket needed for photos.
-- ----------------------------------------------------------------------------
insert into storage.buckets (id, name, public)
values ('extracurricular-achievements', 'extracurricular-achievements', false)
on conflict (id) do nothing;

drop policy if exists ec_achievements_files_select on storage.objects;
create policy ec_achievements_files_select on storage.objects
  for select
  using (
    bucket_id = 'extracurricular-achievements'
    and (
      public.is_staff()
      or (storage.foldername(name))[2] = auth.uid()::text
    )
  );

drop policy if exists ec_achievements_files_write_staff on storage.objects;
create policy ec_achievements_files_write_staff on storage.objects
  for insert
  with check (
    bucket_id = 'extracurricular-achievements'
    and (public.is_staff() or public.has_role('extracurricular_staff'))
    and (storage.foldername(name))[1] = public.current_school_id()::text
  );

drop policy if exists ec_achievements_files_update_staff on storage.objects;
create policy ec_achievements_files_update_staff on storage.objects
  for update
  using (
    bucket_id = 'extracurricular-achievements'
    and (public.is_staff() or public.has_role('extracurricular_staff'))
    and (storage.foldername(name))[1] = public.current_school_id()::text
  );

drop policy if exists ec_achievements_files_delete_staff on storage.objects;
create policy ec_achievements_files_delete_staff on storage.objects
  for delete
  using (
    bucket_id = 'extracurricular-achievements'
    and (public.is_staff() or public.has_role('extracurricular_staff'))
    and (storage.foldername(name))[1] = public.current_school_id()::text
  );
