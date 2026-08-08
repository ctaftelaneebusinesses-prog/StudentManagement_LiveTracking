-- ============================================================================
-- The app treats school_admin and super_admin as the same "admin" tier —
-- there is no intentional tiering between them. Historically school_admin
-- accrued several module-specific permissions (fees, attendance, marks,
-- homework, timetable, branches, academic_years) that were never backfilled
-- to super_admin, while only super_admin had platform.manage_schools. Grant
-- each role whatever the other already has so both end up with the exact
-- same, full permission set.
-- ============================================================================

insert into public.role_permissions (role_id, permission_id)
select (select id from public.roles where name = 'school_admin'), id
from public.permissions
where code = 'platform.manage_schools'
on conflict do nothing;

insert into public.role_permissions (role_id, permission_id)
select (select id from public.roles where name = 'super_admin'), id
from public.permissions
where code in (
  'branches.manage', 'academic_years.manage',
  'fees.view', 'fees.manage',
  'attendance.view', 'attendance.manage',
  'marks.view', 'marks.manage',
  'homework.view', 'homework.manage',
  'timetable.view', 'timetable.manage'
)
on conflict do nothing;
