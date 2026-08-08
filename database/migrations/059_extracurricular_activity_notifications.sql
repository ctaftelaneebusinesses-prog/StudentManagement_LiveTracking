-- ============================================================================
-- Migration: 059_extracurricular_activity_notifications
-- Run AFTER 052_accountant_module_enhancements.sql.
--
-- Adds 5 notification types so students are automatically notified whenever
-- extracurricular staff run a practice session, assign practice work, create
-- an event/competition, award a certificate, or change a schedule slot.
-- ============================================================================

-- Extends notifications_type_check (052) with 5 extracurricular-activity
-- types. Mirrors 036/042/048/049/052's "drop every check constraint, then
-- recreate all four" approach rather than targeting one constraint by name,
-- since Postgres auto-generates constraint names that can drift.
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
      'activity_assigned', 'activity_completed',
      'fee_due', 'fee_updated', 'fee_removed', 'payment_received',
      'activity_practice_scheduled', 'activity_practice_work_assigned', 'activity_event',
      'activity_certificate', 'activity_schedule_updated'
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
