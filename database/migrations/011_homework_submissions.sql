-- ============================================================================
-- Phase 11 — Homework Module: student submissions
-- Run AFTER 007_teacher_module.sql (homework, homework-attachments bucket).
--
-- Adds the student-facing half of the homework module: a submissions table
-- (one row per student per homework item, upsertable for resubmission) and a
-- dedicated "homework-submissions" storage bucket for the files students
-- attach. Teachers already assign/upload homework (Phase 5); this migration
-- lets students submit against it and parents monitor submission status.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. homework_submissions
-- ----------------------------------------------------------------------------
create table if not exists public.homework_submissions (
  id               uuid primary key default gen_random_uuid(),
  school_id        uuid not null references public.schools(id) on delete cascade,
  homework_id      uuid not null references public.homework(id) on delete cascade,
  student_id       uuid not null references public.students(id) on delete cascade,
  submission_text  text,
  attachment_url   text,
  submitted_at     timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  unique (homework_id, student_id)
);

create index if not exists idx_homework_submissions_school_id on public.homework_submissions(school_id);
create index if not exists idx_homework_submissions_homework_id on public.homework_submissions(homework_id);
create index if not exists idx_homework_submissions_student_id on public.homework_submissions(student_id);

-- ----------------------------------------------------------------------------
-- 2. Permission — students submit their own homework; view already granted
--    to student/parent by homework.view (006_student_management_module.sql).
-- ----------------------------------------------------------------------------
insert into public.permissions (code, description) values
  ('homework.submit', 'Submit or resubmit one''s own homework')
on conflict (code) do nothing;

insert into public.role_permissions (role_id, permission_id)
select (select id from public.roles where name = 'student'), id
from public.permissions
where code = 'homework.submit'
on conflict do nothing;

-- ----------------------------------------------------------------------------
-- 3. RLS — students see/manage only their own submission; staff see their
--    school's; a teacher sees submissions for homework in a class they
--    teach; a parent sees their linked child's. Mirrors the pattern already
--    used for public.homework in 006_student_management_module.sql. As with
--    other tables here, the backend's supabaseAdmin client bypasses RLS and
--    enforces the same scoping in the application layer
--    (backend/src/utils/teacherAccess.ts, services/homework.service.ts) — RLS
--    is defense-in-depth for any direct-client access.
-- ----------------------------------------------------------------------------
alter table public.homework_submissions enable row level security;

create policy homework_submissions_select_own on public.homework_submissions
  for select
  using (student_id = auth.uid());

create policy homework_submissions_select_staff on public.homework_submissions
  for select
  using (public.is_staff() and school_id = public.current_school_id());

create policy homework_submissions_select_parent on public.homework_submissions
  for select
  using (
    exists (
      select 1 from public.student_parents sp
      where sp.parent_id = auth.uid() and sp.student_id = homework_submissions.student_id
    )
  );

create policy homework_submissions_select_teacher on public.homework_submissions
  for select
  using (
    public.has_role('teacher')
    and exists (
      select 1
      from public.homework h
      join public.class_subjects cs on cs.class_id = h.class_id
      where h.id = homework_submissions.homework_id and cs.teacher_id = auth.uid()
    )
  );

create policy homework_submissions_write_own on public.homework_submissions
  for insert
  with check (student_id = auth.uid() and school_id = public.current_school_id());

create policy homework_submissions_update_own on public.homework_submissions
  for update
  using (student_id = auth.uid())
  with check (student_id = auth.uid());

-- ----------------------------------------------------------------------------
-- 4. homework-submissions storage bucket — public read (teachers/parents
--    need to open the file by URL without a signed-URL round trip; mirrors
--    homework-attachments' public bucket), write restricted to the owning
--    student. Files are keyed as `{student_user_id}/{filename}`, matching the
--    avatars bucket's owner-folder convention (004_avatar_storage.sql).
-- ----------------------------------------------------------------------------
insert into storage.buckets (id, name, public)
values ('homework-submissions', 'homework-submissions', true)
on conflict (id) do nothing;

drop policy if exists homework_submissions_read_public on storage.objects;
create policy homework_submissions_read_public on storage.objects
  for select
  using (bucket_id = 'homework-submissions');

drop policy if exists homework_submissions_write_own on storage.objects;
create policy homework_submissions_write_own on storage.objects
  for insert
  with check (
    bucket_id = 'homework-submissions'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists homework_submissions_update_own on storage.objects;
create policy homework_submissions_update_own on storage.objects
  for update
  using (
    bucket_id = 'homework-submissions'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists homework_submissions_delete_own on storage.objects;
create policy homework_submissions_delete_own on storage.objects
  for delete
  using (
    bucket_id = 'homework-submissions'
    and (storage.foldername(name))[1] = auth.uid()::text
  );
