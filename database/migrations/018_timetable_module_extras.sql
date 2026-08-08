-- ============================================================================
-- Phase — Timetable Module extras
-- Run AFTER 006_student_management_module.sql.
--
-- Adds room assignment to timetable periods. Teacher/room double-booking
-- conflict detection is intentionally NOT a DB constraint here — a teacher
-- or room can legitimately be double-booked across two different classes
-- whose actual clock times don't overlap even though `period_no` differs
-- between them, so a plain unique index can't express it. That check is
-- done in the application layer (backend/src/services/timetable.service.ts)
-- with a real time-range overlap query instead.
-- ============================================================================

alter table public.timetable_periods
  add column if not exists room_number text;
