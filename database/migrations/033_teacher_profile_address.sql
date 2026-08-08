-- ============================================================================
-- Migration: 033_teacher_profile_address
-- Run AFTER 017_teacher_module_extras.sql.
--
-- The "My Profile" consolidation lets a teacher edit their own address from
-- the Teacher Portal, same as parents already can (`parents.address`,
-- schema.sql). Written through the backend's service-role client (teachers
-- have no self-write RLS policy on `public.teachers` — `teachers_write_staff`
-- in rls_policies.sql is staff-only by design), so no RLS change is needed
-- here.
-- ============================================================================

alter table public.teachers
  add column if not exists address text;
