-- ============================================================================
-- Migration: 037_avatars_teacher_write
-- Run AFTER 016_student_management_extras.sql.
--
-- Teachers can now create/edit students in their own class (backend:
-- utils/teacherAccess.ts::requireStudentWriteAccess), including uploading a
-- profile photo — but the `avatars` bucket only has self-write
-- (avatars_write_own, 004) and staff-write (avatars_write_staff, 016)
-- policies; a teacher uploading to a *student's* `{student_id}/...` path
-- satisfies neither. Adds a teacher-scoped write policy mirroring the same
-- class/subject ownership rule assertTeacherOwnsClass already enforces
-- app-side (homeroom via classes.class_teacher_id, or class_subjects).
-- ============================================================================

drop policy if exists avatars_write_teacher on storage.objects;
create policy avatars_write_teacher on storage.objects
  for insert
  with check (
    bucket_id = 'avatars'
    and public.has_role('teacher')
    and exists (
      select 1 from public.students s
      where s.id::text = (storage.foldername(name))[1]
        and s.school_id = public.current_school_id()
        and (
          exists (select 1 from public.classes c where c.id = s.class_id and c.class_teacher_id = auth.uid())
          or exists (select 1 from public.class_subjects cs where cs.class_id = s.class_id and cs.teacher_id = auth.uid())
        )
    )
  );

drop policy if exists avatars_update_teacher on storage.objects;
create policy avatars_update_teacher on storage.objects
  for update
  using (
    bucket_id = 'avatars'
    and public.has_role('teacher')
    and exists (
      select 1 from public.students s
      where s.id::text = (storage.foldername(name))[1]
        and s.school_id = public.current_school_id()
        and (
          exists (select 1 from public.classes c where c.id = s.class_id and c.class_teacher_id = auth.uid())
          or exists (select 1 from public.class_subjects cs where cs.class_id = s.class_id and cs.teacher_id = auth.uid())
        )
    )
  );
