-- ============================================================================
-- Migration: 060_timetable_extracurricular_periods
-- Run AFTER 006_student_management_module.sql (timetable_periods) and
-- 040_extracurricular_staff_module.sql (activities).
--
-- Lets a timetable period be either an Academic Subject (existing behavior,
-- default) or an Extracurricular Activity. `teacher_id` is reused as-is for
-- the assigned instructor — extracurricular staff are 1:1 rows on
-- public.users just like teachers, so getWeeklyForTeacher/conflict-checking
-- work unchanged for either kind of period.
-- ============================================================================

alter table public.timetable_periods
  add column if not exists period_type text not null default 'academic' check (period_type in ('academic', 'extracurricular')),
  add column if not exists activity_id uuid references public.activities(id) on delete restrict;

alter table public.timetable_periods
  add constraint timetable_periods_type_shape_check
    check (
      (period_type = 'academic' and activity_id is null)
      or (period_type = 'extracurricular' and subject_id is null and activity_id is not null)
    );
