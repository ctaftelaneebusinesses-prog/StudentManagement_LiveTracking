-- ============================================================================
-- Migration: 035_student_leave_requests_self_service
-- Run AFTER 008_parent_module.sql.
--
-- `student_leave_requests` only ever let a parent file on their child's
-- behalf (`requested_by` FK'd to `parents(id)`) and had no reviewer path at
-- all despite `student_leave_requests_update_staff` existing since 008.
-- Adds genuine student self-service (the student's own account can now file
-- for themselves) and lets the class teacher review — not just staff.
--
-- `requested_by` is re-pointed from `parents(id)` to `users(id)` (same
-- shared-PK reasoning as leave_requests, migration 034): a student has no
-- `parents` row to satisfy the old FK.
-- ============================================================================

alter table public.student_leave_requests
  drop constraint if exists student_leave_requests_requested_by_fkey;

alter table public.student_leave_requests
  add constraint student_leave_requests_requested_by_fkey
    foreign key (requested_by) references public.users(id) on delete cascade;

alter table public.student_leave_requests
  add column if not exists requester_role text not null default 'parent'
    check (requester_role in ('student', 'parent'));

create policy student_leave_requests_insert_student on public.student_leave_requests
  for insert
  with check (
    requester_role = 'student'
    and requested_by = auth.uid()
    and student_id = auth.uid()
  );

-- Staff can already select every row in the school (student_leave_requests_
-- select_staff, 008); a class teacher additionally needs to see (and, via
-- the backend's service-role client, review) requests from students in the
-- one class they're homeroom teacher of.
create policy student_leave_requests_select_class_teacher on public.student_leave_requests
  for select
  using (
    exists (
      select 1 from public.students s
      join public.classes c on c.id = s.class_id
      where s.id = student_leave_requests.student_id
        and c.class_teacher_id = auth.uid()
    )
  );
