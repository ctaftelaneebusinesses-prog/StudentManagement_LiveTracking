-- ============================================================================
-- Question papers: write-in-browser option + explicit per-document publish
--
-- Two fixes to the teacher-facing "Question Papers" surface added in 039:
-- 1. A teacher can now compose a question paper directly (rich text, stored
--    as HTML in `content`) instead of only uploading a file — storage_path/
--    file_name become optional, `content` is the alternative.
-- 2. Visibility to students was previously (wrongly) tied to `exams.is_published`,
--    which actually means "marks have been released" — completely unrelated
--    to whether it's safe to hand out the question paper. Each exam_documents
--    row now carries its own explicit is_published/published_at/published_by,
--    defaulting to false (private) until the class teacher (or staff)
--    deliberately publishes it.
-- ============================================================================

alter table public.exam_documents alter column file_name drop not null;
alter table public.exam_documents alter column storage_path drop not null;
alter table public.exam_documents add column if not exists content text;
alter table public.exam_documents add column if not exists is_published boolean not null default false;
alter table public.exam_documents add column if not exists published_at timestamptz;
alter table public.exam_documents add column if not exists published_by uuid references public.users(id) on delete set null;

alter table public.exam_documents drop constraint if exists exam_documents_has_body;
alter table public.exam_documents add constraint exam_documents_has_body
  check (storage_path is not null or content is not null);

-- ----------------------------------------------------------------------------
-- RLS: gate student/parent visibility on is_published too (defense in depth
-- — the backend service layer, see exam.service.ts, is the primary gate).
-- ----------------------------------------------------------------------------
drop policy if exists exam_documents_select_student on public.exam_documents;
create policy exam_documents_select_student on public.exam_documents
  for select
  using (
    is_published = true
    and exists (
      select 1 from public.exams e
      join public.students s on s.class_id = e.class_id
      where e.id = exam_documents.exam_id and s.id = auth.uid()
    )
  );

drop policy if exists exam_documents_select_parent on public.exam_documents;
create policy exam_documents_select_parent on public.exam_documents
  for select
  using (
    is_published = true
    and exists (
      select 1 from public.exams e
      join public.students s on s.class_id = e.class_id
      join public.student_parents sp on sp.student_id = s.id
      where e.id = exam_documents.exam_id and sp.parent_id = auth.uid()
    )
  );

-- Storage-level read policy: same is_published gate, joined by storage path
-- (a student/parent may only fetch a stored file once its metadata row says
-- it's published; staff keep unconditional access).
drop policy if exists exam_documents_select on storage.objects;
create policy exam_documents_select on storage.objects
  for select
  using (
    bucket_id = 'exam-documents'
    and (
      public.is_staff()
      or exists (
        select 1 from public.exam_documents ed
        join public.exams e on e.id = ed.exam_id
        join public.students s on s.class_id = e.class_id
        where ed.storage_path = storage.objects.name and ed.is_published = true and s.id = auth.uid()
      )
      or exists (
        select 1 from public.exam_documents ed
        join public.exams e on e.id = ed.exam_id
        join public.students s on s.class_id = e.class_id
        join public.student_parents sp on sp.student_id = s.id
        where ed.storage_path = storage.objects.name and ed.is_published = true and sp.parent_id = auth.uid()
      )
    )
  );
