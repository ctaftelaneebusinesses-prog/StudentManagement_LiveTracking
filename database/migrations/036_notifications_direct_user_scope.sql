-- ============================================================================
-- Migration: 036_notifications_direct_user_scope
-- Run AFTER 020_announcement_module.sql.
--
-- Adds a `'user'` audience_scope: a notification addressed to exactly one
-- specific person and nobody else (no parent fan-out, unlike `'student'`;
-- no whole-role broadcast, unlike `'role'`). Needed for the new leave
-- workflow — notifying one specific class teacher about a student's leave
-- request, or notifying a teacher/principal back once their own leave is
-- resolved — none of which fit the three existing scopes.
-- ============================================================================

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
      'timetable_change_suggested'
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

create policy notifications_select_direct_user on public.notifications
  for select
  using (audience_scope = 'user' and audience_user_id = auth.uid());
