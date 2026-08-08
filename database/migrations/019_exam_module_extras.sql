-- ============================================================================
-- Phase 19 — Examination Module extras
-- Run AFTER 006_student_management_module.sql (defines exams/exam_marks).
--
-- 006 laid down a bare-bones gradebook (exams + exam_marks). This adds what
-- the admin-facing Examination Module needs: a publish workflow for results
-- (marks exist in exam_marks the moment a teacher enters them, but parents/
-- students should only see them once the exam is explicitly published), a
-- per-subject exam schedule ("Subject Schedule" / "Exam Timetable" are the
-- same underlying data — one row per subject sat within an exam), and a
-- document store for exam PDFs (question papers, hall tickets, result
-- sheets) following the same private-bucket + signed-URL pattern already
-- used for student-documents and teacher-documents.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. exams — publish workflow.
-- ----------------------------------------------------------------------------
alter table public.exams
  add column if not exists is_published boolean not null default false,
  add column if not exists published_at timestamptz,
  add column if not exists published_by uuid references public.users(id) on delete set null,
  add column if not exists updated_at timestamptz not null default now();

-- ----------------------------------------------------------------------------
-- 2. exam_schedule — one row per subject sat within an exam. Renders as
--    both the "Subject Schedule" editor and the "Exam Timetable" view/export.
-- ----------------------------------------------------------------------------
create table if not exists public.exam_schedule (
  id           uuid primary key default gen_random_uuid(),
  school_id    uuid not null references public.schools(id) on delete cascade,
  exam_id      uuid not null references public.exams(id) on delete cascade,
  subject_id   uuid not null references public.subjects(id) on delete cascade,
  exam_date    date not null,
  start_time   time not null,
  end_time     time not null,
  room         text,
  max_marks    numeric(6, 2) not null default 100 check (max_marks > 0),
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  unique (exam_id, subject_id),
  check (end_time > start_time)
);

create index if not exists idx_exam_schedule_school_id on public.exam_schedule(school_id);
create index if not exists idx_exam_schedule_exam_id on public.exam_schedule(exam_id);

-- ----------------------------------------------------------------------------
-- 3. exam_documents — metadata for files uploaded to the private
--    "exam-documents" storage bucket (see section 5), keyed as
--    `{school_id}/{exam_id}/{filename}`.
-- ----------------------------------------------------------------------------
create table if not exists public.exam_documents (
  id            uuid primary key default gen_random_uuid(),
  school_id     uuid not null references public.schools(id) on delete cascade,
  exam_id       uuid not null references public.exams(id) on delete cascade,
  doc_type      text not null check (doc_type in
                  ('question_paper', 'answer_key', 'hall_ticket', 'result_sheet', 'circular', 'other')),
  file_name     text not null,
  storage_path  text not null,
  notes         text,
  uploaded_by   uuid references public.users(id) on delete set null,
  uploaded_at   timestamptz not null default now()
);

create index if not exists idx_exam_documents_school_id on public.exam_documents(school_id);
create index if not exists idx_exam_documents_exam_id on public.exam_documents(exam_id);

-- ----------------------------------------------------------------------------
-- 4. Trigger: keep exams.updated_at current on every edit (mirrors the
--    attendance module's pattern from 015_attendance_reporting.sql).
-- ----------------------------------------------------------------------------
create or replace function public.fn_touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists trg_exams_touch_updated_at on public.exams;
create trigger trg_exams_touch_updated_at
  before update on public.exams
  for each row
  execute function public.fn_touch_updated_at();

drop trigger if exists trg_exam_schedule_touch_updated_at on public.exam_schedule;
create trigger trg_exam_schedule_touch_updated_at
  before update on public.exam_schedule
  for each row
  execute function public.fn_touch_updated_at();

-- ----------------------------------------------------------------------------
-- 5. exam-documents storage bucket — private, signed-URL reads only.
-- ----------------------------------------------------------------------------
insert into storage.buckets (id, name, public)
values ('exam-documents', 'exam-documents', false)
on conflict (id) do nothing;

drop policy if exists exam_documents_select on storage.objects;
create policy exam_documents_select on storage.objects
  for select
  using (
    bucket_id = 'exam-documents'
    and (
      public.is_staff()
      or exists (
        select 1 from public.exams e
        join public.students s on s.class_id = e.class_id
        where e.id::text = (storage.foldername(name))[2] and s.id = auth.uid()
      )
      or exists (
        select 1 from public.exams e
        join public.student_parents sp on true
        join public.students s on s.id = sp.student_id and s.class_id = e.class_id
        where e.id::text = (storage.foldername(name))[2] and sp.parent_id = auth.uid()
      )
    )
  );

drop policy if exists exam_documents_write_staff on storage.objects;
create policy exam_documents_write_staff on storage.objects
  for insert
  with check (
    bucket_id = 'exam-documents'
    and public.is_staff()
    and (storage.foldername(name))[1] = public.current_school_id()::text
  );

drop policy if exists exam_documents_update_staff on storage.objects;
create policy exam_documents_update_staff on storage.objects
  for update
  using (
    bucket_id = 'exam-documents'
    and public.is_staff()
    and (storage.foldername(name))[1] = public.current_school_id()::text
  );

drop policy if exists exam_documents_delete_staff on storage.objects;
create policy exam_documents_delete_staff on storage.objects
  for delete
  using (
    bucket_id = 'exam-documents'
    and public.is_staff()
    and (storage.foldername(name))[1] = public.current_school_id()::text
  );

-- ----------------------------------------------------------------------------
-- 6. RLS — exam_schedule and exam_documents.
-- ----------------------------------------------------------------------------
alter table public.exam_schedule enable row level security;

drop policy if exists exam_schedule_select_same_school on public.exam_schedule;
create policy exam_schedule_select_same_school on public.exam_schedule
  for select
  using (school_id = public.current_school_id());

drop policy if exists exam_schedule_write_staff_or_teacher on public.exam_schedule;
create policy exam_schedule_write_staff_or_teacher on public.exam_schedule
  for all
  using (
    (public.is_staff() and school_id = public.current_school_id())
    or (
      public.has_role('teacher')
      and exists (
        select 1 from public.exams e
        join public.class_subjects cs on cs.class_id = e.class_id
        where e.id = exam_schedule.exam_id and cs.teacher_id = auth.uid()
      )
    )
  )
  with check (school_id = public.current_school_id());

alter table public.exam_documents enable row level security;

drop policy if exists exam_documents_select_staff on public.exam_documents;
create policy exam_documents_select_staff on public.exam_documents
  for select
  using (public.is_staff() and school_id = public.current_school_id());

drop policy if exists exam_documents_select_student on public.exam_documents;
create policy exam_documents_select_student on public.exam_documents
  for select
  using (
    exists (
      select 1 from public.exams e
      join public.students s on s.class_id = e.class_id
      where e.id = exam_documents.exam_id and s.id = auth.uid()
    )
  );

drop policy if exists exam_documents_select_parent on public.exam_documents;
create policy exam_documents_select_parent on public.exam_documents
  for select
  using (
    exists (
      select 1 from public.exams e
      join public.students s on s.class_id = e.class_id
      join public.student_parents sp on sp.student_id = s.id
      where e.id = exam_documents.exam_id and sp.parent_id = auth.uid()
    )
  );

drop policy if exists exam_documents_write_staff_or_teacher on public.exam_documents;
create policy exam_documents_write_staff_or_teacher on public.exam_documents
  for all
  using (
    (public.is_staff() and school_id = public.current_school_id())
    or (
      public.has_role('teacher')
      and exists (
        select 1 from public.exams e
        join public.class_subjects cs on cs.class_id = e.class_id
        where e.id = exam_documents.exam_id and cs.teacher_id = auth.uid()
      )
    )
  )
  with check (school_id = public.current_school_id());
