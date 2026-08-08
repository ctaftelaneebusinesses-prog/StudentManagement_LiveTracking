-- ============================================================================
-- Migration: 048_activity_assignment_tracking
-- Run AFTER 040_extracurricular_staff_module.sql and
-- 042_student_profile_change_requests.sql.
--
-- Turns "assign a staff member to an activity" into a trackable task: adds
-- a status (assigned/completed) plus completion metadata to
-- extracurricular_staff_activities, and two new notification types so the
-- assigned staff member is notified when assigned, and the assigner is
-- notified back when the staff member marks it complete.
-- ============================================================================

alter table public.extracurricular_staff_activities
  add column if not exists status text not null default 'assigned' check (status in ('assigned', 'completed')),
  add column if not exists completed_at timestamptz,
  add column if not exists completed_by uuid references public.users(id) on delete set null;

-- Extends notifications_type_check (042) with two activity-assignment types.
-- Mirrors 036/042's "drop every check constraint, then recreate all four"
-- approach rather than targeting one constraint by name, since Postgres
-- auto-generates constraint names that can drift.
do $$
declare
  c record;
begin
  for c in
    select conname from pg_constraint
    where conrelid = 'public.notifications'::regclass and contype = 'c'
  loop
    execute format('alter table public.notifications drop constraint %I', c.conname);
  end loop;
end $$;

alter table public.notifications
  add constraint notifications_audience_scope_check
    check (audience_scope in ('school', 'class', 'student', 'role', 'user')),
  add constraint notifications_type_check
    check (type in (
      'attendance', 'homework', 'marks', 'van', 'announcement', 'emergency',
      'student_leave_submitted', 'student_leave_approved', 'student_leave_rejected',
      'teacher_leave_submitted', 'teacher_leave_approved', 'teacher_leave_rejected',
      'principal_leave_submitted', 'principal_leave_approved', 'principal_leave_rejected',
      'timetable_change_suggested',
      'profile_change_submitted', 'profile_change_approved', 'profile_change_rejected',
      'activity_assigned', 'activity_completed'
    )),
  add constraint notifications_priority_check
    check (priority in ('normal', 'high', 'critical')),
  add constraint notifications_audience_shape_check
    check (
      (audience_scope = 'school' and audience_class_id is null and audience_user_id is null and audience_role is null) or
      (audience_scope = 'class' and audience_class_id is not null) or
      (audience_scope = 'student' and audience_user_id is not null) or
      (audience_scope = 'role' and audience_role is not null) or
      (audience_scope = 'user' and audience_user_id is not null)
    );
