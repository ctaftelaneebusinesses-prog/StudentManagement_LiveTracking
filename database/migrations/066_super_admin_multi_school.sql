-- ============================================================================
-- Migration: 066_super_admin_multi_school
-- Run AFTER 065_registration_notification_types.sql.
--
-- Re-tiers super_admin above school_admin and makes multi-school assignment
-- explicit. Migration 027_equalize_admin_roles.sql deliberately flattened the
-- two roles into one "admin tier" (identical permissions, both able to see
-- every school). That is exactly what this phase reverses:
--
--   SUPER ADMIN          platform-wide: every school, school-admin lifecycle,
--                        audit log. The only role with platform.* permissions.
--     |
--   SCHOOL ADMIN         only the schools explicitly assigned to them via the
--     |                  new school_admin_schools table. Cannot see, name, or
--     |                  reach any other school.
--   SCHOOL -> PRINCIPAL -> TEACHERS/ACCOUNTANT/DRIVERS/EC STAFF -> STUDENTS
--
-- Nothing is deleted anywhere in this migration or in the cascade flows it
-- enables: deactivation only ever flips access flags (users.is_active,
-- schools.is_active). Student/teacher/attendance/fee/exam/transport history
-- all stays exactly where it is.
--
-- Sections:
--   1. school_admin_schools      — the many-to-many assignment table
--   2. cascade_suspended flags   — so reactivation can restore *only* the
--                                  accounts a cascade switched off, leaving
--                                  individually-suspended accounts alone
--   3. platform_audit_logs       — cross-school audit trail (activity_logs
--                                  can't be reused: its school_id is NOT NULL)
--   4. has_school_access()       — one RLS helper for "may this caller touch
--                                  this school", assignment-aware
--   5. permission re-tiering     — revoke platform.* from school_admin,
--                                  add the new platform.* permissions
--   6. backfill                  — existing school_admins keep their own school
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. school_admin_schools — which schools a school_admin may manage.
--
-- A super_admin never has rows here: they reach every school by role, not by
-- assignment (see has_school_access() below). users.school_id stays as-is and
-- remains the "home"/default school for the selector; this table is purely
-- additive so no existing single-school query changes meaning.
-- ----------------------------------------------------------------------------
create table if not exists public.school_admin_schools (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references public.users(id) on delete cascade,
  school_id   uuid not null references public.schools(id) on delete cascade,
  assigned_by uuid references public.users(id) on delete set null,
  assigned_at timestamptz not null default now(),
  unique (user_id, school_id)
);

create index if not exists idx_school_admin_schools_user on public.school_admin_schools(user_id);
create index if not exists idx_school_admin_schools_school on public.school_admin_schools(school_id);

-- ----------------------------------------------------------------------------
-- 2. Cascade bookkeeping.
--
-- Deactivating a school switches off every account in it; deactivating a
-- school_admin switches off every school they manage (and, transitively,
-- those schools' users). Reactivation must NOT blanket-restore everyone —
-- a teacher an admin suspended individually last week has to stay suspended.
--
-- These flags record "this row was switched off BY a cascade, not by a
-- human acting on it directly", which is precisely the set reactivation may
-- restore. A direct deactivation always leaves the flag false.
-- ----------------------------------------------------------------------------
alter table public.users
  add column if not exists cascade_suspended boolean not null default false;

alter table public.schools
  add column if not exists cascade_suspended boolean not null default false;

create index if not exists idx_users_cascade_suspended
  on public.users(school_id) where cascade_suspended;

comment on column public.users.cascade_suspended is
  'True when is_active was set false by a school/school-admin cascade rather than by a direct action on this user. Only these rows are restored on reactivation.';
comment on column public.schools.cascade_suspended is
  'True when is_active was set false by a school-admin deactivation cascade rather than by deactivating this school directly.';

-- ----------------------------------------------------------------------------
-- 3. platform_audit_logs — super_admin's cross-school audit trail.
--
-- Separate from activity_logs (023_settings_module.sql) because that table is
-- per-tenant: school_id is NOT NULL and every read filters by it, so a
-- platform action spanning three schools has no single row it belongs to.
-- Actor/target/school labels are denormalised so an entry stays readable
-- after the school or user it refers to is renamed or removed.
-- ----------------------------------------------------------------------------
create table if not exists public.platform_audit_logs (
  id             uuid primary key default gen_random_uuid(),
  actor_user_id  uuid references public.users(id) on delete set null,
  actor_name     text,
  actor_email    text,
  action         text not null,
  target_type    text check (target_type in ('school', 'school_admin', 'user', 'assignment')),
  target_id      uuid,
  target_label   text,
  school_id      uuid references public.schools(id) on delete set null,
  school_name    text,
  status         text not null default 'success' check (status in ('success', 'failed')),
  metadata       jsonb not null default '{}'::jsonb,
  created_at     timestamptz not null default now()
);

create index if not exists idx_platform_audit_logs_created on public.platform_audit_logs(created_at desc);
create index if not exists idx_platform_audit_logs_action on public.platform_audit_logs(action);
create index if not exists idx_platform_audit_logs_school on public.platform_audit_logs(school_id);

-- ----------------------------------------------------------------------------
-- 4. has_school_access(uuid) — the single "may this caller touch this school"
--    predicate, used by RLS below and mirrored by the backend's
--    resolveSchoolId (utils/tenant.ts).
--
-- SECURITY DEFINER + STABLE for the same reason as current_school_id(): a
-- policy on public.users that reads public.users would recurse.
-- ----------------------------------------------------------------------------
create or replace function public.has_school_access(p_school_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    p_school_id is not null
    and (
      public.is_super_admin()
      or p_school_id = public.current_school_id()
      or exists (
        select 1 from public.school_admin_schools sas
        where sas.user_id = auth.uid() and sas.school_id = p_school_id
      )
    );
$$;

/** Every school id the caller may act on. Super admins get all of them. */
create or replace function public.accessible_school_ids()
returns setof uuid
language sql
stable
security definer
set search_path = public
as $$
  select id from public.schools where public.is_super_admin()
  union
  select school_id from public.users where id = auth.uid() and school_id is not null
  union
  select school_id from public.school_admin_schools where user_id = auth.uid();
$$;

-- schools: replace 003_rbac_rls_policies.sql's `schools_select`
-- (is_super_admin() or id = current_school_id()) with the assignment-aware
-- predicate, so a school_admin reads exactly their assigned schools and a
-- principal still reads only their own.
drop policy if exists schools_select on public.schools;
drop policy if exists schools_select_own on public.schools;
create policy schools_select on public.schools
  for select
  using (public.has_school_access(id));

-- Writes to schools stay super_admin-only (unchanged from 003's
-- schools_write_super_admin, restated so the intent is explicit now that
-- school_admin no longer holds platform.manage_schools).
drop policy if exists schools_write_super_admin on public.schools;
create policy schools_write_super_admin on public.schools
  for all
  using (public.is_super_admin())
  with check (public.is_super_admin());

-- users: a school_admin managing several schools must be able to read the
-- staff/student profiles of every school they are assigned to, not just the
-- one in their own users.school_id.
drop policy if exists users_select_same_school on public.users;
create policy users_select_same_school on public.users
  for select
  using (
    id = auth.uid()
    or public.has_school_access(school_id)
  );

alter table public.school_admin_schools enable row level security;

-- A school_admin may read their own assignment rows (that's what powers their
-- school selector); only a super_admin may create or remove assignments.
create policy school_admin_schools_select_self on public.school_admin_schools
  for select
  using (public.is_super_admin() or user_id = auth.uid());

create policy school_admin_schools_write_super_admin on public.school_admin_schools
  for all
  using (public.is_super_admin())
  with check (public.is_super_admin());

alter table public.platform_audit_logs enable row level security;

create policy platform_audit_logs_super_admin on public.platform_audit_logs
  for select
  using (public.is_super_admin());

-- ----------------------------------------------------------------------------
-- 5. Permission re-tiering.
--
-- This is the deliberate reversal of 027_equalize_admin_roles.sql. After this
-- runs, platform.* belongs to super_admin alone; school_admin keeps every
-- school-level permission it has today (fees, attendance, marks, homework,
-- timetable, branches, academic_years, users, ...) and simply loses the
-- ability to reach schools it was not assigned.
-- ----------------------------------------------------------------------------
insert into public.permissions (code, description) values
  ('platform.manage_school_admins', 'Create, update, assign schools to, and deactivate School Admin accounts'),
  ('platform.view_audit_log',       'View the platform-wide administrative audit log'),
  ('schools.view_assigned',         'List the schools assigned to the caller (powers the school selector)')
on conflict (code) do nothing;

-- super_admin holds every permission in the system, including the three above.
insert into public.role_permissions (role_id, permission_id)
select (select id from public.roles where name = 'super_admin'), id
from public.permissions
on conflict do nothing;

-- school_admin: gains only the ability to enumerate its own assignments...
insert into public.role_permissions (role_id, permission_id)
select (select id from public.roles where name = 'school_admin'), id
from public.permissions
where code = 'schools.view_assigned'
on conflict do nothing;

-- ...and loses platform-wide reach (granted by 027). Everything else stays.
delete from public.role_permissions
where role_id = (select id from public.roles where name = 'school_admin')
  and permission_id in (
    select id from public.permissions
    where code in ('platform.manage_schools', 'platform.manage_school_admins', 'platform.view_audit_log')
  );

-- principal must never hold these either (defensive — it never did).
delete from public.role_permissions
where role_id = (select id from public.roles where name = 'principal')
  and permission_id in (
    select id from public.permissions where code like 'platform.%'
  );

-- ----------------------------------------------------------------------------
-- 6. Backfill — every existing school_admin keeps exactly the school they are
--    already attached to via users.school_id, so no live account loses access
--    to the school it was actually working in. A super_admin can widen an
--    assignment afterwards from the School Admins screen.
-- ----------------------------------------------------------------------------
insert into public.school_admin_schools (user_id, school_id)
select distinct u.id, u.school_id
from public.users u
join public.user_roles ur on ur.user_id = u.id
join public.roles r on r.id = ur.role_id
where r.name = 'school_admin'
  and u.school_id is not null
on conflict (user_id, school_id) do nothing;

-- ----------------------------------------------------------------------------
-- 7. Guard: only accounts that actually hold the school_admin role may be
--    assigned schools here, so a stray insert can't silently widen a
--    teacher's or principal's reach.
-- ----------------------------------------------------------------------------
create or replace function public.assert_assignee_is_school_admin()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if not exists (
    select 1
    from public.user_roles ur
    join public.roles r on r.id = ur.role_id
    where ur.user_id = new.user_id and r.name in ('school_admin', 'super_admin')
  ) then
    raise exception 'User % does not hold the school_admin role and cannot be assigned schools', new.user_id
      using errcode = 'check_violation';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_school_admin_schools_role_check on public.school_admin_schools;
create trigger trg_school_admin_schools_role_check
  before insert or update on public.school_admin_schools
  for each row execute function public.assert_assignee_is_school_admin();
