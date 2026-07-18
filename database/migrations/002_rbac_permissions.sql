-- ============================================================================
-- Phase 2 — RBAC & Permissions
-- Run AFTER database/schema.sql and database/rls_policies.sql.
--
-- Changes:
--   1. Adds the "super_admin" role and renames "admin" -> "school_admin"
--      (a platform-level operator role distinct from a single school's admin).
--   2. Introduces a granular permission system: permissions, role_permissions.
--   3. Introduces user_roles — a many-to-many table so a single person can
--      hold more than one role (e.g. a teacher who is also a parent), scoped
--      per school. users.role_id is KEPT as the user's "primary" role, used
--      for the default post-login dashboard redirect; user_roles is the
--      authoritative source for permission checks.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. Roles: rename "admin" -> "school_admin", add "super_admin"
-- ----------------------------------------------------------------------------
update public.roles set name = 'school_admin' where name = 'admin';

insert into public.roles (id, name) values (7, 'super_admin')
on conflict (id) do nothing;

-- ----------------------------------------------------------------------------
-- 2. Permissions — fine-grained capability codes, independent of any role.
-- ----------------------------------------------------------------------------
create table if not exists public.permissions (
  id           serial primary key,
  code         text not null unique,   -- e.g. 'users.manage', 'students.view'
  description  text not null
);

insert into public.permissions (code, description) values
  ('platform.manage_schools',   'Create, update, or deactivate any school (platform-wide)'),
  ('school.manage_settings',    'Manage settings for one''s own school'),
  ('users.view',                'View user profiles within the school'),
  ('users.manage',              'Create, update, deactivate user accounts within the school'),
  ('roles.manage',              'Assign or revoke roles for users within the school'),
  ('classes.manage',            'Create and manage classes, sections, subjects'),
  ('students.view',             'View student records'),
  ('students.manage',           'Create and update student records'),
  ('teachers.manage',           'Create and update teacher records'),
  ('transport.manage',          'Manage vehicles, drivers, and routes'),
  ('profile.edit_self',         'Edit one''s own profile information')
on conflict (code) do nothing;

-- ----------------------------------------------------------------------------
-- 3. Role -> Permission mapping
-- ----------------------------------------------------------------------------
create table if not exists public.role_permissions (
  role_id        smallint not null references public.roles(id) on delete cascade,
  permission_id  int not null references public.permissions(id) on delete cascade,
  primary key (role_id, permission_id)
);

-- super_admin: every permission
insert into public.role_permissions (role_id, permission_id)
select (select id from public.roles where name = 'super_admin'), id from public.permissions
on conflict do nothing;

-- school_admin
insert into public.role_permissions (role_id, permission_id)
select (select id from public.roles where name = 'school_admin'), id
from public.permissions
where code in (
  'school.manage_settings', 'users.view', 'users.manage', 'roles.manage',
  'classes.manage', 'students.view', 'students.manage', 'teachers.manage',
  'transport.manage', 'profile.edit_self'
)
on conflict do nothing;

-- principal
insert into public.role_permissions (role_id, permission_id)
select (select id from public.roles where name = 'principal'), id
from public.permissions
where code in ('users.view', 'classes.manage', 'students.view', 'students.manage', 'teachers.manage', 'profile.edit_self')
on conflict do nothing;

-- teacher
insert into public.role_permissions (role_id, permission_id)
select (select id from public.roles where name = 'teacher'), id
from public.permissions
where code in ('students.view', 'profile.edit_self')
on conflict do nothing;

-- parent / student / driver: self-service only for now — expands as
-- attendance/marks/homework/transport modules are built.
insert into public.role_permissions (role_id, permission_id)
select r.id, (select id from public.permissions where code = 'profile.edit_self')
from public.roles r
where r.name in ('parent', 'student', 'driver')
on conflict do nothing;

-- ----------------------------------------------------------------------------
-- 4. user_roles — many-to-many, scoped per school (null school_id = platform
--    scope, used only for super_admin).
-- ----------------------------------------------------------------------------
create table if not exists public.user_roles (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references public.users(id) on delete cascade,
  role_id     smallint not null references public.roles(id) on delete cascade,
  school_id   uuid references public.schools(id) on delete cascade,
  created_at  timestamptz not null default now(),
  unique (user_id, role_id, school_id)
);

create index if not exists idx_user_roles_user_id on public.user_roles(user_id);
create index if not exists idx_user_roles_role_id on public.user_roles(role_id);

-- Backfill: every existing user gets their current primary role in user_roles.
insert into public.user_roles (user_id, role_id, school_id)
select id, role_id, school_id from public.users
on conflict (user_id, role_id, school_id) do nothing;

-- ----------------------------------------------------------------------------
-- 5. Keep user_roles in sync whenever a new auth user is provisioned.
--    (handle_new_auth_user already inserts into public.users; extend it here
--    rather than duplicating the trigger.)
-- ----------------------------------------------------------------------------
create or replace function public.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_school_id uuid;
  v_role_id   smallint;
begin
  v_school_id := nullif(new.raw_user_meta_data ->> 'school_id', '')::uuid;
  v_role_id   := coalesce((new.raw_user_meta_data ->> 'role_id')::smallint, 5); -- default: student

  insert into public.users (id, school_id, role_id, full_name, email)
  values (
    new.id,
    v_school_id,
    v_role_id,
    coalesce(new.raw_user_meta_data ->> 'full_name', new.email),
    new.email
  );

  insert into public.user_roles (user_id, role_id, school_id)
  values (new.id, v_role_id, v_school_id)
  on conflict (user_id, role_id, school_id) do nothing;

  return new;
end;
$$;
