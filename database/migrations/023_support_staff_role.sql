-- ============================================================================
-- Phase 23 — Support Staff role
--
-- Adds an 8th fixed role for non-teaching staff (cleaners, peons, security
-- guards, "ayya", etc.) who need a directory record and possibly a login,
-- but no module-specific permissions — just the same self-service profile
-- access already granted to parent/student/driver. The actual job title
-- ("Cleaner", "Ayya", ...) is free text on `users.designation` rather than
-- its own role, since the set of real-world titles is open-ended and
-- doesn't need its own permission set.
-- ============================================================================

insert into public.roles (id, name) values (8, 'support_staff')
on conflict (id) do nothing;

alter table public.users
  add column if not exists designation text;

insert into public.role_permissions (role_id, permission_id)
select 8, id from public.permissions where code = 'profile.edit_self'
on conflict do nothing;
