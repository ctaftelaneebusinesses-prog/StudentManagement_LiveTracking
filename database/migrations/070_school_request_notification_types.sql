-- ============================================================================
-- Migration: 070_school_request_notification_types
-- Run AFTER 069_platform_notifications.sql.
--
-- Adds 'school_request_submitted', 'school_request_approved',
-- 'school_request_rejected' to notifications_type_check — the school-
-- creation-request workflow (068_school_creation_requests.sql) notifies
-- super_admin on submission and the requesting school_admin on the decision;
-- without this, those inserts fail the same silent way 065's note describes.
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
    'registration_submitted', 'registration_approved', 'registration_rejected',
    'school_request_submitted', 'school_request_approved', 'school_request_rejected'
  ]::text[]));
