-- Grants teachers the same classroom/student-facing permissions admin and
-- principal hold, EXCLUDING fees (fees.manage, fees.view) and org-wide
-- administration (roles.manage, users.manage, branches.manage,
-- school.manage_settings, security_logs.view, calendar.manage,
-- teachers.manage, extracurricular_staff.manage, platform.manage_schools),
-- which stay admin/principal-only.
--
-- classes.manage and timetable.manage are deliberately NOT included here:
-- both are gated by a flat `requirePermission` with no per-class ownership
-- check (class.routes.ts, timetable.routes.ts), so granting them would let
-- any teacher create/delete/rename any class, delete from the school-wide
-- subject catalog, or edit another class's timetable — not just their own.
-- Teachers keep read-only timetable.view.
--
-- reports.view is also NOT included: it gates the whole Reports Hub
-- (routes/reports.routes.ts) as one flat permission, including
-- `/hub/fees` (a school-wide fee report) and unscoped whole-school
-- `/hub/students` / `/hub/teachers` reports — granting it would leak fee
-- data straight through the one thing this migration is meant to exclude.
-- Teachers already have their own `/teacher/class-performance` report via
-- requireRole, unaffected by this.
--
-- students.manage in particular lets a teacher edit a student's name and
-- other personal details (previously view-only), matching the existing
-- create/update ownership check in utils/teacherAccess.ts
-- (requireStudentWriteAccess / assertTeacherOwnsClass) that already scopes
-- POST/PATCH /students to a teacher's own class. The new sub-resource
-- endpoints this permission newly unlocks (parents, documents, siblings)
-- are scoped the same way at the route level via the new
-- requireStudentManageAccess guard — see routes/student.routes.ts.
insert into public.role_permissions (role_id, permission_id)
select (select id from public.roles where name = 'teacher'), p.id
from public.permissions p
where p.code in (
  'academic_years.manage',
  'activities.manage',
  'departments.manage',
  'students.manage'
)
on conflict do nothing;
