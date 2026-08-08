-- ============================================================================
-- Phase — Reports Module
-- Adds a single new permission for the cross-module Reports console
-- (Attendance/Student/Teacher/Fee/Transport/Exam reports). Pure read
-- aggregation over existing tables/views — no schema changes.
-- ============================================================================

insert into public.permissions (code, description) values
  ('reports.view', 'View cross-module reports and analytics')
on conflict (code) do nothing;

-- super_admin: explicit grant (the blanket "every permission" insert in
-- 002_rbac_permissions.sql already ran and won't retroactively pick up
-- permissions added afterward).
insert into public.role_permissions (role_id, permission_id)
select (select id from public.roles where name = 'super_admin'), id
from public.permissions
where code = 'reports.view'
on conflict do nothing;

insert into public.role_permissions (role_id, permission_id)
select r.id, (select id from public.permissions where code = 'reports.view')
from public.roles r
where r.name in ('school_admin', 'principal')
on conflict do nothing;
