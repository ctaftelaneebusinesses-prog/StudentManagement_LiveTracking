-- ============================================================================
-- Phase 2 — RLS updates for RBAC & Permissions
-- Run AFTER 002_rbac_permissions.sql.
--
-- - Adds is_super_admin(), has_role(), has_permission() helper functions.
-- - Redefines is_staff() to include super_admin and to check user_roles
--   (multi-role) instead of only the single users.role_id column.
-- - Grants super_admin a cross-school bypass on tenant-scoped tables.
-- - Enables RLS on the three new tables (permissions, role_permissions,
--   user_roles).
-- All helper functions remain SECURITY DEFINER + STABLE to avoid RLS
-- recursion, per the same reasoning as rls_policies.sql.
-- ============================================================================

create or replace function public.is_super_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.user_roles ur
    join public.roles r on r.id = ur.role_id
    where ur.user_id = auth.uid() and r.name = 'super_admin'
  );
$$;

create or replace function public.has_role(role_name_param text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.user_roles ur
    join public.roles r on r.id = ur.role_id
    where ur.user_id = auth.uid() and r.name = role_name_param
  );
$$;

create or replace function public.has_permission(permission_code text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.user_roles ur
    join public.role_permissions rp on rp.role_id = ur.role_id
    join public.permissions p on p.id = rp.permission_id
    where ur.user_id = auth.uid() and p.code = permission_code
  );
$$;

-- is_staff() now covers anyone with school_admin/principal/super_admin in
-- ANY of their assigned roles, not just their single primary role.
create or replace function public.is_staff()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    public.is_super_admin()
    or public.has_role('school_admin')
    or public.has_role('principal');
$$;

-- ----------------------------------------------------------------------------
-- RPC helpers the frontend calls directly (via supabase.rpc(...)) to read
-- its own roles/permissions — avoids fragile nested PostgREST joins across
-- three link tables and keeps the query list-of-strings, not row objects.
-- ----------------------------------------------------------------------------
create or replace function public.my_roles()
returns table(role_name text)
language sql
stable
security definer
set search_path = public
as $$
  select r.name
  from public.user_roles ur
  join public.roles r on r.id = ur.role_id
  where ur.user_id = auth.uid();
$$;

create or replace function public.my_permissions()
returns table(permission_code text)
language sql
stable
security definer
set search_path = public
as $$
  select distinct p.code
  from public.user_roles ur
  join public.role_permissions rp on rp.role_id = ur.role_id
  join public.permissions p on p.id = rp.permission_id
  where ur.user_id = auth.uid();
$$;

-- ----------------------------------------------------------------------------
-- super_admin cross-school bypass. Every existing "same school" policy is
-- of the form `school_id = current_school_id()`; is_staff() already now
-- includes super_admin for staff-only policies, but plain member-visibility
-- policies (e.g. schools_select_own, students_select_self) need an explicit
-- OR is_super_admin() so a platform operator isn't locked into one tenant.
-- ----------------------------------------------------------------------------
drop policy if exists schools_select_own on public.schools;
create policy schools_select on public.schools
  for select
  using (public.is_super_admin() or id = public.current_school_id());

create policy schools_write_super_admin on public.schools
  for all
  using (public.is_super_admin())
  with check (public.is_super_admin());

drop policy if exists users_select_same_school on public.users;
create policy users_select_same_school on public.users
  for select
  using (
    public.is_super_admin()
    or school_id = public.current_school_id()
    or id = auth.uid()
  );

-- ----------------------------------------------------------------------------
-- permissions / role_permissions — static reference data, readable by any
-- authenticated user (needed so the frontend can render permission-gated UI
-- without an extra staff-only round trip). No client writes.
-- ----------------------------------------------------------------------------
alter table public.permissions enable row level security;

create policy permissions_select_all on public.permissions
  for select
  using (auth.role() = 'authenticated');

alter table public.role_permissions enable row level security;

create policy role_permissions_select_all on public.role_permissions
  for select
  using (auth.role() = 'authenticated');

-- ----------------------------------------------------------------------------
-- user_roles
-- - A user can always read their own role assignments.
-- - Staff can read role assignments for anyone in their own school.
-- - Only staff with roles.manage permission (or super_admin) can write.
-- ----------------------------------------------------------------------------
alter table public.user_roles enable row level security;

create policy user_roles_select_self on public.user_roles
  for select
  using (user_id = auth.uid());

create policy user_roles_select_staff on public.user_roles
  for select
  using (
    public.is_super_admin()
    or (public.is_staff() and school_id = public.current_school_id())
  );

create policy user_roles_write_authorized on public.user_roles
  for all
  using (public.is_super_admin() or public.has_permission('roles.manage'))
  with check (public.is_super_admin() or public.has_permission('roles.manage'));
