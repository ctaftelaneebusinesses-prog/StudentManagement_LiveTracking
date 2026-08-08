-- ============================================================================
-- Phase 39 — Extracurricular Staff role
--
-- Adds a 10th fixed role for non-academic instructors (dance, yoga, karate,
-- music, art, etc.) who need their own login/portal and a management
-- workflow distinct from the Teacher module — they don't teach academic
-- subjects, aren't tied to class_subjects, and get their own permission set.
-- Modeled on 023_support_staff_role.sql / 029_accountant_role.sql's pattern
-- for adding a role after the initial set.
-- ============================================================================

insert into public.roles (id, name) values (10, 'extracurricular_staff')
on conflict (id) do nothing;

insert into public.permissions (code, description) values
  ('extracurricular_staff.manage', 'Create, update, deactivate extracurricular staff and their activity/class assignments'),
  ('activities.manage',            'Manage the master list of extracurricular activities')
on conflict (code) do nothing;

-- super_admin: explicit grant (the blanket "every permission" insert in
-- 002_rbac_permissions.sql already ran and won't retroactively pick up
-- permissions added afterward — see 022_reports_module.sql for precedent).
insert into public.role_permissions (role_id, permission_id)
select (select id from public.roles where name = 'super_admin'), id
from public.permissions
where code in ('extracurricular_staff.manage', 'activities.manage')
on conflict do nothing;

insert into public.role_permissions (role_id, permission_id)
select r.id, p.id
from public.roles r
cross join public.permissions p
where r.name in ('school_admin', 'principal')
  and p.code in ('extracurricular_staff.manage', 'activities.manage')
on conflict do nothing;

-- extracurricular_staff role itself: self-service only, matching the
-- support_staff/accountant precedent. The self-service portal API is gated
-- by requireAuth + ownership checks in code, not a permission code.
insert into public.role_permissions (role_id, permission_id)
select 10, id from public.permissions where code = 'profile.edit_self'
on conflict do nothing;
