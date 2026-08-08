-- ============================================================================
-- Migration: 044_evaluated_papers
-- Run AFTER 040_question_paper_compose_and_publish.sql.
--
-- "Evaluated Papers" (Phase 2 of the Student/Parent Portal): a teacher
-- uploads one student's own corrected/graded answer sheet for one exam
-- subject, and that student + their linked parents can view/download it.
-- Genuinely distinct from `exam_documents` (040) — those are class-wide
-- broadcasts (question papers, hall tickets, circulars) authored once and
-- shown to every student in the class; an evaluated paper is inherently
-- per-student, so it needs its own table rather than reusing exam_documents'
-- doc_type enum. Table shape and storage-bucket policies mirror
-- student_documents (006_student_management_module.sql) closely, with the
-- write grant scoped to a teacher of the student's class (mirrors
-- avatars_write_teacher, 037) instead of "any staff".
-- ============================================================================

create table if not exists public.evaluated_papers (
  id            uuid primary key default gen_random_uuid(),
  school_id     uuid not null references public.schools(id) on delete cascade,
  student_id    uuid not null references public.students(id) on delete cascade,
  exam_id       uuid not null references public.exams(id) on delete cascade,
  subject_id    uuid not null references public.subjects(id) on delete cascade,
  file_name     text not null,
  storage_path  text not null,
  notes         text,
  uploaded_by   uuid references public.users(id) on delete set null,
  uploaded_at   timestamptz not null default now()
);

create index if not exists idx_evaluated_papers_student on public.evaluated_papers(student_id, uploaded_at desc);
create index if not exists idx_evaluated_papers_exam on public.evaluated_papers(exam_id);

alter table public.evaluated_papers enable row level security;

create policy evaluated_papers_select_self on public.evaluated_papers
  for select
  using (student_id = auth.uid());

create policy evaluated_papers_select_parent on public.evaluated_papers
  for select
  using (
    exists (
      select 1 from public.student_parents sp
      where sp.parent_id = auth.uid() and sp.student_id = evaluated_papers.student_id
    )
  );

create policy evaluated_papers_select_staff on public.evaluated_papers
  for select
  using (public.is_staff() and school_id = public.current_school_id());

create policy evaluated_papers_select_teacher on public.evaluated_papers
  for select
  using (
    exists (
      select 1 from public.students s
      where s.id = evaluated_papers.student_id
        and (
          exists (select 1 from public.classes c where c.id = s.class_id and c.class_teacher_id = auth.uid())
          or exists (select 1 from public.class_subjects cs where cs.class_id = s.class_id and cs.teacher_id = auth.uid())
        )
    )
  );

-- No RLS insert/update/delete policy: writes go through the service-role
-- client only (evaluatedPaper.service.ts), gated by assertTeacherOwnsStudent
-- app-side — same "app layer decides, RLS is the read-side backstop" split
-- already used throughout this schema.

-- ----------------------------------------------------------------------------
-- evaluated-papers storage bucket — private; files keyed
-- `{school_id}/{student_id}/{filename}`, mirrors student-documents (006).
-- ----------------------------------------------------------------------------
insert into storage.buckets (id, name, public)
values ('evaluated-papers', 'evaluated-papers', false)
on conflict (id) do nothing;

drop policy if exists evaluated_papers_storage_select on storage.objects;
create policy evaluated_papers_storage_select on storage.objects
  for select
  using (
    bucket_id = 'evaluated-papers'
    and (
      public.is_staff()
      or (storage.foldername(name))[2] = auth.uid()::text
      or exists (
        select 1 from public.student_parents sp
        where sp.parent_id = auth.uid()
          and sp.student_id::text = (storage.foldername(name))[2]
      )
      or exists (
        select 1 from public.students s
        where s.id::text = (storage.foldername(name))[2]
          and (
            exists (select 1 from public.classes c where c.id = s.class_id and c.class_teacher_id = auth.uid())
            or exists (select 1 from public.class_subjects cs where cs.class_id = s.class_id and cs.teacher_id = auth.uid())
          )
      )
    )
  );

drop policy if exists evaluated_papers_storage_write on storage.objects;
create policy evaluated_papers_storage_write on storage.objects
  for insert
  with check (
    bucket_id = 'evaluated-papers'
    and (
      public.is_staff()
      or exists (
        select 1 from public.students s
        where s.id::text = (storage.foldername(name))[2]
          and s.school_id = public.current_school_id()
          and (
            exists (select 1 from public.classes c where c.id = s.class_id and c.class_teacher_id = auth.uid())
            or exists (select 1 from public.class_subjects cs where cs.class_id = s.class_id and cs.teacher_id = auth.uid())
          )
      )
    )
  );

drop policy if exists evaluated_papers_storage_delete on storage.objects;
create policy evaluated_papers_storage_delete on storage.objects
  for delete
  using (
    bucket_id = 'evaluated-papers'
    and (
      public.is_staff()
      or exists (
        select 1 from public.students s
        where s.id::text = (storage.foldername(name))[2]
          and s.school_id = public.current_school_id()
          and (
            exists (select 1 from public.classes c where c.id = s.class_id and c.class_teacher_id = auth.uid())
            or exists (select 1 from public.class_subjects cs where cs.class_id = s.class_id and cs.teacher_id = auth.uid())
          )
      )
    )
  );

insert into public.permissions (code, description) values
  ('evaluated_papers.manage', 'Upload evaluated/corrected answer sheets for students')
on conflict (code) do nothing;

-- super_admin explicitly included — migration 002 only grants super_admin
-- "every permission that existed at the time", so any later-added permission
-- (like this one) needs its own backfill or super_admin silently lacks it
-- (the same gap 012_notification_system.sql had to backfill for
-- notifications.view/manage).
insert into public.role_permissions (role_id, permission_id)
select r.id, p.id
from public.roles r
cross join public.permissions p
where r.name in ('school_admin', 'super_admin', 'principal', 'teacher')
  and p.code = 'evaluated_papers.manage'
on conflict do nothing;
