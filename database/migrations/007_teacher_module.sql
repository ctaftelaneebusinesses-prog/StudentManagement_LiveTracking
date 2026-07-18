-- ============================================================================
-- Phase 5 — Teacher Module
-- Run AFTER 006_student_management_module.sql.
--
-- The Teacher Module's dashboard/attendance/marks/homework/reports features
-- reuse the tables and RLS already laid down in 006 (attendance, exams,
-- exam_marks, homework, class_subjects) — no new tables are needed. The one
-- schema addition here is a storage bucket for homework file attachments
-- (homework.attachment_url already exists as a plain text column; this
-- bucket is where that URL points to).
--
-- Ownership scoping (a teacher may only mark attendance / enter marks /
-- assign homework for a class they actually teach, per class_subjects or
-- classes.class_teacher_id) is enforced in the application layer
-- (backend/src/utils/teacherAccess.ts) since the backend's supabaseAdmin
-- client bypasses RLS — the same approach already used for
-- utils/studentAccess.ts. The RLS policies from 006 remain in place as
-- defense-in-depth for any direct-client access.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- homework-attachments storage bucket — public read (worksheets/handouts are
-- not sensitive), write restricted to staff and teachers of the school.
-- Files are keyed as `{school_id}/{teacher_id}/{filename}`.
-- ----------------------------------------------------------------------------
insert into storage.buckets (id, name, public)
values ('homework-attachments', 'homework-attachments', true)
on conflict (id) do nothing;

drop policy if exists homework_attachments_read_public on storage.objects;
create policy homework_attachments_read_public on storage.objects
  for select
  using (bucket_id = 'homework-attachments');

drop policy if exists homework_attachments_write_staff_or_teacher on storage.objects;
create policy homework_attachments_write_staff_or_teacher on storage.objects
  for insert
  with check (
    bucket_id = 'homework-attachments'
    and (public.is_staff() or public.has_role('teacher'))
    and (storage.foldername(name))[1] = public.current_school_id()::text
  );

drop policy if exists homework_attachments_update_staff_or_teacher on storage.objects;
create policy homework_attachments_update_staff_or_teacher on storage.objects
  for update
  using (
    bucket_id = 'homework-attachments'
    and (public.is_staff() or public.has_role('teacher'))
    and (storage.foldername(name))[1] = public.current_school_id()::text
  );

drop policy if exists homework_attachments_delete_staff_or_teacher on storage.objects;
create policy homework_attachments_delete_staff_or_teacher on storage.objects
  for delete
  using (
    bucket_id = 'homework-attachments'
    and (public.is_staff() or public.has_role('teacher'))
    and (storage.foldername(name))[1] = public.current_school_id()::text
  );
