-- ============================================================================
-- Migration: 062_syllabus_module
-- Run AFTER 061_registration_approval.sql.
--
-- Adds the Syllabus module: Admin/Principal have full CRUD across the
-- school, Teachers may only upload/edit for classes+subjects they're
-- actually assigned to teach (class_subjects), Students/Parents only ever
-- see published syllabus for their own class. `class_id` already pins one
-- specific academic-year+class+section row (classes.unique(school_id, name,
-- section, academic_year)) — same scoping convention as every other
-- class-scoped feature (homework, exams, timetable), so no separate
-- `section` column is needed.
--
-- Storage/RLS pattern mirrors exam_documents (019/040_question_paper_
-- compose_and_publish) for the is_published gate, and student_documents
-- (006/037/058) for the teacher-ownership write policy.
-- ============================================================================

create table if not exists public.syllabus (
  id               uuid primary key default gen_random_uuid(),
  school_id        uuid not null references public.schools(id) on delete cascade,
  academic_year    text not null,
  class_id         uuid not null references public.classes(id) on delete cascade,
  subject_id       uuid not null references public.subjects(id) on delete cascade,
  title            text not null,
  description      text,
  storage_path     text not null,
  file_name        text not null,
  is_published     boolean not null default false,
  published_at     timestamptz,
  published_by     uuid references public.users(id) on delete set null,
  uploaded_by      uuid references public.users(id) on delete set null,
  created_by_role  text not null check (created_by_role in ('admin', 'principal', 'teacher')),
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

create index if not exists idx_syllabus_school_id on public.syllabus(school_id);
create index if not exists idx_syllabus_class_subject on public.syllabus(class_id, subject_id);

drop trigger if exists trg_syllabus_updated_at on public.syllabus;
create trigger trg_syllabus_updated_at
  before update on public.syllabus
  for each row execute function public.fn_touch_updated_at();

alter table public.syllabus enable row level security;

-- Staff (admin/principal/teacher) — full read access within their school;
-- real write authorization (teacher's class/subject ownership check) is
-- enforced in syllabus.service.ts using supabaseAdmin, these policies are
-- defense-in-depth only.
create policy syllabus_select_staff on public.syllabus
  for select
  using (public.is_staff() and school_id = public.current_school_id());

create policy syllabus_select_student on public.syllabus
  for select
  using (
    is_published = true
    and exists (
      select 1 from public.students s
      where s.class_id = syllabus.class_id and s.id = auth.uid()
    )
  );

create policy syllabus_select_parent on public.syllabus
  for select
  using (
    is_published = true
    and exists (
      select 1 from public.students s
      join public.student_parents sp on sp.student_id = s.id
      where s.class_id = syllabus.class_id and sp.parent_id = auth.uid()
    )
  );

-- ----------------------------------------------------------------------------
-- Storage: private "syllabus-documents" bucket, path convention
-- `{school_id}/{class_id}/{subject_id}/{timestamp}-{filename}`.
-- ----------------------------------------------------------------------------
insert into storage.buckets (id, name, public)
values ('syllabus-documents', 'syllabus-documents', false)
on conflict (id) do nothing;

drop policy if exists syllabus_documents_write_staff on storage.objects;
create policy syllabus_documents_write_staff on storage.objects
  for insert
  with check (
    bucket_id = 'syllabus-documents'
    and public.is_staff()
    and (storage.foldername(name))[1] = public.current_school_id()::text
  );

drop policy if exists syllabus_documents_write_teacher on storage.objects;
create policy syllabus_documents_write_teacher on storage.objects
  for insert
  with check (
    bucket_id = 'syllabus-documents'
    and public.has_role('teacher')
    and (storage.foldername(name))[1] = public.current_school_id()::text
    and exists (
      select 1 from public.class_subjects cs
      where cs.class_id::text = (storage.foldername(name))[2]
        and cs.subject_id::text = (storage.foldername(name))[3]
        and cs.teacher_id = auth.uid()
    )
  );

drop policy if exists syllabus_documents_select on storage.objects;
create policy syllabus_documents_select on storage.objects
  for select
  using (
    bucket_id = 'syllabus-documents'
    and (
      public.is_staff()
      or exists (
        select 1 from public.syllabus sy
        join public.students s on s.class_id = sy.class_id
        where sy.storage_path = storage.objects.name and sy.is_published = true and s.id = auth.uid()
      )
      or exists (
        select 1 from public.syllabus sy
        join public.students s on s.class_id = sy.class_id
        join public.student_parents sp on sp.student_id = s.id
        where sy.storage_path = storage.objects.name and sy.is_published = true and sp.parent_id = auth.uid()
      )
    )
  );

drop policy if exists syllabus_documents_delete_staff on storage.objects;
create policy syllabus_documents_delete_staff on storage.objects
  for delete
  using (bucket_id = 'syllabus-documents' and public.is_staff());
