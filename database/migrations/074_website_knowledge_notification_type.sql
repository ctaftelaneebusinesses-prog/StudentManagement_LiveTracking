-- ============================================================================
-- Migration: 074_website_knowledge_notification_type
-- Run AFTER 073_learning_games.sql.
--
-- Adds 'website_knowledge_completed' to notifications_type_check.
--
-- 071_website_knowledge_assessment.sql added the completion fan-out
-- (websiteKnowledgeNotify.service.ts -> notifyUsers with
-- type: 'website_knowledge_completed') but never extended the CHECK
-- constraint — the same omission 065 and 070 had to repair for the
-- registration and school-request workflows.
--
-- The failure mode was worse here than a silently-dropped notification:
-- completeAttempt() marks the attempt completed FIRST and notifies after, so
-- the constraint violation threw an ApiError.internal *after* the row was
-- already saved. The student's quiz was scored and stored, but the request
-- 500'd and the UI reported "Could not submit your assessment", leaving the
-- player stuck on the last question with no way forward.
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
    'school_request_submitted', 'school_request_approved', 'school_request_rejected',
    'website_knowledge_completed'
  ]::text[]));
