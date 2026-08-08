-- ============================================================================
-- Adds a 9th fixed role: Accountant — a finance-focused staff role that can
-- manage fee structures/payments and view financial reports, but has none of
-- the academic/student-management permissions a school_admin has. Modeled on
-- 023_support_staff_role.sql's pattern for adding a role after the initial set.
-- ============================================================================

insert into public.roles (id, name) values (9, 'accountant')
on conflict (id) do nothing;

insert into public.role_permissions (role_id, permission_id)
select 9, id from public.permissions
where code in ('fees.view', 'fees.manage', 'reports.view', 'profile.edit_self')
on conflict do nothing;
