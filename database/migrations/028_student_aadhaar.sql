-- ============================================================================
-- Adds an optional Aadhaar (Indian national ID) number to students, validated
-- as exactly 12 digits at the application layer (student.validator.ts) and
-- backstopped here at the DB level. Optional rather than mandatory: existing
-- rows and schools that haven't collected it yet shouldn't be blocked.
-- ============================================================================

alter table public.students
  add column if not exists aadhaar_number text;

alter table public.students
  drop constraint if exists students_aadhaar_number_format;

alter table public.students
  add constraint students_aadhaar_number_format
  check (aadhaar_number is null or aadhaar_number ~ '^\d{12}$');
