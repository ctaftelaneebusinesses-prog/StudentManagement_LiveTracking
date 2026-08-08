-- ============================================================================
-- Phase — Teacher Portal extras (Dashboard & Daily Workflow enhancement)
-- Run AFTER 019_exam_module_extras.sql, 017_teacher_module_extras.sql.
--
-- Adds what the teacher's self-service portal needs that nothing else laid
-- down: single-subject "assessment" fields on `exams` (a teacher creating a
-- quick class test doesn't need the full multi-subject exam-event flow the
-- admin Exams module uses — it just fans out one `exams` row same as today,
-- now optionally carrying its own subject/max marks/instructions), plus a
-- default leave policy on the existing `schools.settings` jsonb column (no
-- new table — mirrors how email/notification/backup settings already live
-- there per 023_settings_module.sql).
-- ============================================================================

alter table public.exams
  add column if not exists subject_id   uuid references public.subjects(id) on delete set null,
  add column if not exists max_marks    numeric,
  add column if not exists instructions text,
  add column if not exists created_by   uuid references public.users(id) on delete set null;

create index if not exists idx_exams_subject_id on public.exams(subject_id);

-- ----------------------------------------------------------------------------
-- leave_requests.leave_type — lets the teacher self-service "Apply for
-- leave" flow (and the balance/used/remaining breakdown on the Leave
-- Management screen) categorize each request the same way admin settings
-- express the entitlement (casual / sick / other). Existing rows default to
-- 'other' so this backfills cleanly.
-- ----------------------------------------------------------------------------
alter table public.leave_requests
  add column if not exists leave_type text not null default 'other'
    check (leave_type in ('casual', 'sick', 'other'));
