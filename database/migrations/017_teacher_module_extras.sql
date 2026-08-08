-- ============================================================================
-- Phase — Teacher Module extras
-- Run AFTER 007_teacher_module.sql, 015_attendance_reporting.sql.
--
-- Adds what the admin-facing Teacher Module needs that nothing else laid
-- down: a structured "years of experience" field, a teacher documents table
-- (mirrors student_documents), a teacher attendance table (mirrors the
-- student `attendance` table but keyed by teacher_id, entirely separate —
-- students and teachers are never mixed in one attendance table), and a
-- leave_requests table (apply/approve workflow; the admin console drives
-- both sides for now — a teacher-self-service "apply" UI is a future
-- module).
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. teachers.experience_years — single scalar field, matching how
--    `qualification` is already a single free-text column rather than a
--    structured history table.
-- ----------------------------------------------------------------------------
alter table public.teachers
  add column if not exists experience_years int check (experience_years is null or experience_years >= 0);

-- ----------------------------------------------------------------------------
-- 2. teacher_documents — mirrors student_documents exactly, own doc_type set.
-- ----------------------------------------------------------------------------
create table if not exists public.teacher_documents (
  id            uuid primary key default gen_random_uuid(),
  school_id     uuid not null references public.schools(id) on delete cascade,
  teacher_id    uuid not null references public.teachers(id) on delete cascade,
  doc_type      text not null check (doc_type in
                  ('resume', 'id_proof', 'degree_certificate', 'experience_letter', 'photo', 'other')),
  file_name     text not null,
  storage_path  text not null,
  notes         text,
  uploaded_by   uuid references public.users(id) on delete set null,
  uploaded_at   timestamptz not null default now()
);

create index if not exists idx_teacher_documents_teacher_id on public.teacher_documents(teacher_id);
create index if not exists idx_teacher_documents_school_id on public.teacher_documents(school_id);

alter table public.teacher_documents enable row level security;

create policy teacher_documents_select_staff on public.teacher_documents
  for select
  using (public.is_staff() and school_id = public.current_school_id());

create policy teacher_documents_select_self on public.teacher_documents
  for select
  using (teacher_id = auth.uid());

-- ----------------------------------------------------------------------------
-- 3. teacher_attendance — one row per teacher per day. Entirely separate
--    from the student `attendance` table (different subject, different FK).
-- ----------------------------------------------------------------------------
create table if not exists public.teacher_attendance (
  id          uuid primary key default gen_random_uuid(),
  school_id   uuid not null references public.schools(id) on delete cascade,
  teacher_id  uuid not null references public.teachers(id) on delete cascade,
  date        date not null,
  status      text not null check (status in ('present', 'absent', 'half_day', 'leave')),
  remarks     text,
  marked_by   uuid references public.users(id) on delete set null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  updated_by  uuid references public.users(id) on delete set null,
  unique (teacher_id, date)
);

create index if not exists idx_teacher_attendance_school_id on public.teacher_attendance(school_id);
create index if not exists idx_teacher_attendance_teacher_date on public.teacher_attendance(teacher_id, date);
create index if not exists idx_teacher_attendance_school_date on public.teacher_attendance(school_id, date);

alter table public.teacher_attendance enable row level security;

create policy teacher_attendance_select_staff on public.teacher_attendance
  for select
  using (public.is_staff() and school_id = public.current_school_id());

create policy teacher_attendance_select_self on public.teacher_attendance
  for select
  using (teacher_id = auth.uid());

-- ----------------------------------------------------------------------------
-- 4. leave_requests — apply/approve workflow for teacher leave.
-- ----------------------------------------------------------------------------
create table if not exists public.leave_requests (
  id            uuid primary key default gen_random_uuid(),
  school_id     uuid not null references public.schools(id) on delete cascade,
  teacher_id    uuid not null references public.teachers(id) on delete cascade,
  start_date    date not null,
  end_date      date not null,
  reason        text,
  status        text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  reviewed_by   uuid references public.users(id) on delete set null,
  reviewed_at   timestamptz,
  created_by    uuid references public.users(id) on delete set null,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  check (end_date >= start_date)
);

create index if not exists idx_leave_requests_school_id on public.leave_requests(school_id);
create index if not exists idx_leave_requests_teacher_id on public.leave_requests(teacher_id);
create index if not exists idx_leave_requests_status on public.leave_requests(school_id, status);

alter table public.leave_requests enable row level security;

create policy leave_requests_select_staff on public.leave_requests
  for select
  using (public.is_staff() and school_id = public.current_school_id());

create policy leave_requests_select_self on public.leave_requests
  for select
  using (teacher_id = auth.uid());

-- ----------------------------------------------------------------------------
-- 5. teacher-documents storage bucket — private, same pattern as
--    student-documents. Files keyed as `{school_id}/{teacher_id}/{filename}`.
-- ----------------------------------------------------------------------------
insert into storage.buckets (id, name, public)
values ('teacher-documents', 'teacher-documents', false)
on conflict (id) do nothing;

drop policy if exists teacher_documents_select on storage.objects;
create policy teacher_documents_select on storage.objects
  for select
  using (
    bucket_id = 'teacher-documents'
    and (
      public.is_staff()
      or (storage.foldername(name))[2] = auth.uid()::text
    )
  );

drop policy if exists teacher_documents_write_staff on storage.objects;
create policy teacher_documents_write_staff on storage.objects
  for insert
  with check (
    bucket_id = 'teacher-documents'
    and public.is_staff()
    and (storage.foldername(name))[1] = public.current_school_id()::text
  );

drop policy if exists teacher_documents_update_staff on storage.objects;
create policy teacher_documents_update_staff on storage.objects
  for update
  using (
    bucket_id = 'teacher-documents'
    and public.is_staff()
    and (storage.foldername(name))[1] = public.current_school_id()::text
  );

drop policy if exists teacher_documents_delete_staff on storage.objects;
create policy teacher_documents_delete_staff on storage.objects
  for delete
  using (
    bucket_id = 'teacher-documents'
    and public.is_staff()
    and (storage.foldername(name))[1] = public.current_school_id()::text
  );
