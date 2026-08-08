-- ============================================================================
-- Principal Module: reuse the Admin Module instead of building a separate one.
-- Grant principal every permission school_admin currently holds, EXCEPT
-- platform.manage_schools. That single omission is what keeps principal
-- locked to exactly one school: utils/tenant.ts::resolveSchoolId already
-- hard-locks any caller without platform.manage_schools to their own
-- users.school_id and ignores any school_id they try to pass — no backend
-- code change needed there. Selecting off school_admin's live grant set
-- (instead of hardcoding a permission-code list) keeps this correct as
-- future migrations add permissions to school_admin.
--
-- Principal is still blocked from managing principal/school_admin/super_admin
-- accounts despite holding users.manage/roles.manage now — that is enforced
-- at the application layer (backend/src/utils/userAccess.ts), not via a
-- permission split, since users.manage is all-or-nothing.
-- ============================================================================

insert into public.role_permissions (role_id, permission_id)
select (select id from public.roles where name = 'principal'), rp.permission_id
from public.role_permissions rp
join public.roles r on r.id = rp.role_id
join public.permissions p on p.id = rp.permission_id
where r.name = 'school_admin'
  and p.code <> 'platform.manage_schools'
on conflict do nothing;
