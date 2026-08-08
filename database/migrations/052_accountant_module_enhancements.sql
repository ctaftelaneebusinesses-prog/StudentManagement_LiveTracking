-- ============================================================================
-- Migration: 052_accountant_module_enhancements
-- Run AFTER 049_student_specific_fee_items.sql.
--
-- Supports the Accountant portal: per-fee discount/scholarship amounts (net
-- due = amount - discount_amount - scholarship_amount), and three new
-- notification types for payment-recorded / fee-updated / fee-removed events
-- (fee-added already reuses 'fee_due').
-- ============================================================================

alter table public.fee_structures
  add column if not exists discount_amount numeric(10, 2) not null default 0,
  add column if not exists scholarship_amount numeric(10, 2) not null default 0;

alter table public.fee_structures
  add constraint fee_structures_discount_nonnegative check (discount_amount >= 0),
  add constraint fee_structures_scholarship_nonnegative check (scholarship_amount >= 0);

-- Extends notifications_type_check (049) with 'fee_updated', 'fee_removed',
-- 'payment_received'. Mirrors 036/042/048/049's "drop every check
-- constraint, then recreate all four" approach rather than targeting one
-- constraint by name, since Postgres auto-generates constraint names that
-- can drift.
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
      'fee_due', 'fee_updated', 'fee_removed', 'payment_received'
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
