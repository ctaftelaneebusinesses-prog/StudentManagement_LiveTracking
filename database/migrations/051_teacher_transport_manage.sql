-- Grant teachers the same transport.manage permission admin/principal hold,
-- so a teacher can create/edit routes, pickup & drop points, vehicles,
-- drivers, and transport fees from the Admin Console's Transport page
-- (frontend route /dashboard/admin/transport, now also allowed for the
-- "teacher" role — see AppRoutes.tsx).
insert into public.role_permissions (role_id, permission_id)
select (select id from public.roles where name = 'teacher'), p.id
from public.permissions p
where p.code = 'transport.manage'
on conflict do nothing;
