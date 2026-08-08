-- ============================================================================
-- Migration: 049_student_specific_fee_items
-- Run AFTER 016_student_management_extras.sql and
-- 048_activity_assignment_tracking.sql.
--
-- Lets admin add a fee to one specific student (e.g. a one-off "Books Fee"
-- of ₹10,000) instead of only ever assigning fees to a whole class.
-- fee_structures.class_id becomes optional; a row now targets either a
-- class (existing behavior, student_id null) or one student (class_id may
-- be null). Also adds a 'fee_due' notification type so admin adding/updating
-- a fee (regular or transport) can notify the affected student + parent.
-- ============================================================================

alter table public.fee_structures
  alter column class_id drop not null,
  add column if not exists student_id uuid references public.students(id) on delete cascade;

create index if not exists idx_fee_structures_student_id on public.fee_structures(student_id);

alter table public.fee_structures
  add constraint fee_structures_target_check check (class_id is not null or student_id is not null),
  add constraint fee_structures_student_term_unique unique (student_id, academic_year_id, term);

-- The existing fee_structures_select_student/_parent policies (016) only
-- match on class_id, so they'd miss a per-student row — add the direct-match
-- equivalents, mirroring notifications_select_direct's shape (006).
create policy fee_structures_select_student_direct on public.fee_structures
  for select
  using (student_id = auth.uid());

create policy fee_structures_select_parent_direct on public.fee_structures
  for select
  using (
    exists (
      select 1 from public.student_parents sp
      where sp.parent_id = auth.uid() and sp.student_id = fee_structures.student_id
    )
  );

-- Extends notifications_type_check (048) with 'fee_due'. Mirrors 036/042/048's
-- "drop every check constraint, then recreate all four" approach rather than
-- targeting one constraint by name, since Postgres auto-generates constraint
-- names that can drift.
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
      'fee_due'
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
