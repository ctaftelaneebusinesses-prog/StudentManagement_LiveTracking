-- ============================================================================
-- Migration: 079_remove_student_fees_view
-- Security fix: SEC-04 (student fee-data exposure).
--
-- BEFORE: the 'student' role was granted 'fees.view' (016_student_management_
-- extras.sql). The school-wide fee endpoints (/fees/students, /fees/payments,
-- /fees/dashboard, /fees/analytics, /fees/reports/*, …) are gated ONLY by
-- requirePermission('fees.view'), so any student could read the whole school's
-- fee roster — guardian names, contact numbers and balances — plus payment
-- history. (016's comment said "restricted to their own records by RLS", but
-- the backend uses the service-role key and bypasses RLS.)
--
-- AFTER: 'fees.view' is removed from the student role. A student's OWN fee page
-- (GET /students/:id/fees/*) does not need it — utils/studentAccess.ts
-- ::assertStudentFeeAccess authorizes the self case (user.id === studentId)
-- before it ever checks fees.view. Finance/admin roles (accountant,
-- school_admin, principal, super_admin) keep fees.view and thus retain full
-- access. This enforces the restriction at the permission/authorization
-- boundary, not in the frontend.
--
-- Idempotent: delete is a no-op if the grant is already absent.
-- ============================================================================

delete from public.role_permissions
where role_id = (select id from public.roles where name = 'student')
  and permission_id = (select id from public.permissions where code = 'fees.view');
