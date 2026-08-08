-- ============================================================================
-- Migration: 034_leave_requests_dual_approval
-- Run AFTER 032_teacher_portal_extras.sql.
--
-- `leave_requests` (teacher leave) gets a real reviewer workflow: principals
-- can now apply for leave too (reviewed only by a true admin/super_admin,
-- never another principal — enforced in leaveRequest.service.ts, not here),
-- and a race-safe "first approval wins" review needs to know *which* role
-- acted, not just which user.
--
-- `teacher_id` keeps its name (touching every call site would be pure
-- churn) but is re-pointed from `teachers(id)` to `users(id)` — safe because
-- `teachers.id` already *is* `users.id` (shared-PK pattern, schema.sql), and
-- a principal has no `teachers` row to point to otherwise.
-- ============================================================================

alter table public.leave_requests
  drop constraint if exists leave_requests_teacher_id_fkey;

alter table public.leave_requests
  add constraint leave_requests_teacher_id_fkey
    foreign key (teacher_id) references public.users(id) on delete cascade;

alter table public.leave_requests
  add column if not exists applicant_role text not null default 'teacher'
    check (applicant_role in ('teacher', 'principal')),
  add column if not exists reviewed_by_role text;
