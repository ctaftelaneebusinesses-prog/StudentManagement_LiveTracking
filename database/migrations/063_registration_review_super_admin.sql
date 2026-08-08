-- ============================================================================
-- Migration: 063_registration_review_super_admin
-- Run AFTER 062_syllabus_module.sql.
--
-- 061 granted the new `registration.review` permission to principal only.
-- super_admin is meant to hold every permission in the system (see
-- 002_rbac_permissions.sql's "super_admin: every permission" seed, which ran
-- once and doesn't retroactively pick up permissions added later) — grant it
-- here so a platform operator keeps full oversight/backstop capability
-- consistent with every other permission in the system.
-- ============================================================================

insert into public.role_permissions (role_id, permission_id)
select (select id from public.roles where name = 'super_admin'), id
from public.permissions
where code = 'registration.review'
on conflict do nothing;
