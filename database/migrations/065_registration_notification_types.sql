-- ============================================================================
-- Migration: 065_registration_notification_types
-- Run AFTER 064_remove_parent_role.sql.
--
-- notification.service.ts::NotificationType added 'registration_submitted',
-- 'registration_approved', 'registration_rejected' (see 061_registration_
-- approval.sql), but the `notifications_type_check` CHECK constraint was
-- never extended to match — every insert of one of these three types has
-- been silently failing (caught by the fire-and-forget .catch(logger.error)
-- in registration.service.ts), so registration-submitted/approved/rejected
-- notifications were never actually created. Widens the constraint to match
-- the TS union.
-- ============================================================================

alter table public.notifications drop constraint if exists notifications_type_check;
alter table public.notifications add constraint notifications_type_check
  check (type = any (array[
    'attendance', 'homework', 'marks', 'van', 'announcement', 'emergency',
    'student_leave_submitted', 'student_leave_approved', 'student_leave_rejected',
    'teacher_leave_submitted', 'teacher_leave_approved', 'teacher_leave_rejected',
    'principal_leave_submitted', 'principal_leave_approved', 'principal_leave_rejected',
    'timetable_change_suggested',
    'profile_change_submitted', 'profile_change_approved', 'profile_change_rejected',
    'activity_assigned', 'activity_completed',
    'fee_due', 'fee_updated', 'fee_removed', 'payment_received',
    'activity_practice_scheduled', 'activity_practice_work_assigned',
    'activity_event', 'activity_certificate', 'activity_schedule_updated',
    'registration_submitted', 'registration_approved', 'registration_rejected'
  ]::text[]));
