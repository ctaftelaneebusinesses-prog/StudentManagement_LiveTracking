-- ============================================================================
-- Migration: 058_student_documents_teacher_write
-- Run AFTER 057_teacher_student_management_parity.sql.
--
-- Migration 057 granted teachers `students.manage`, scoped at the route
-- level (utils/teacherAccess.ts::requireStudentManageAccess) to students in
-- their own class. That unlocked POST /students/:id/documents, but the
-- frontend uploads the file straight to the private `student-documents`
-- storage bucket BEFORE calling that backend endpoint (see
-- studentDocuments.service.ts::uploadDocument) — and the bucket's only
-- insert policy (student_documents_write_staff, 006) requires
-- `public.is_staff()`, so a teacher's direct upload would still be rejected
-- by storage RLS even though the backend now allows the metadata write.
--
-- Adds a teacher-scoped insert policy mirroring avatars_write_teacher (037):
-- same class/subject ownership rule assertTeacherOwnsClass enforces
-- app-side (homeroom via classes.class_teacher_id, or class_subjects). No
-- update/delete policy needed — delete goes through the backend's
-- supabaseAdmin (service-role) client, which bypasses RLS entirely.
-- ============================================================================

drop policy if exists student_documents_write_teacher on storage.objects;
create policy student_documents_write_teacher on storage.objects
  for insert
  with check (
    bucket_id = 'student-documents'
    and public.has_role('teacher')
    and (storage.foldername(name))[1] = public.current_school_id()::text
    and exists (
      select 1 from public.students s
      where s.id::text = (storage.foldername(name))[2]
        and s.school_id = public.current_school_id()
        and (
          exists (select 1 from public.classes c where c.id = s.class_id and c.class_teacher_id = auth.uid())
          or exists (select 1 from public.class_subjects cs where cs.class_id = s.class_id and cs.teacher_id = auth.uid())
        )
    )
  );
