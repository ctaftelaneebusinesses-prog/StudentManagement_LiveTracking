-- Teacher self check-in/check-out attendance.
-- Existing teacher_attendance table (017_teacher_module_extras.sql) already
-- has status/marked_by; this just adds the actual tap timestamps so admins
-- can see when a teacher checked in vs. what the auto-absent job later did.
alter table public.teacher_attendance
  add column if not exists check_in_at timestamptz,
  add column if not exists check_out_at timestamptz;
