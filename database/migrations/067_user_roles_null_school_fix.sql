-- ============================================================================
-- Migration: 067_user_roles_null_school_fix
-- Run AFTER 066_super_admin_multi_school.sql.
--
-- user_roles' existing unique constraint is `unique (user_id, role_id,
-- school_id)`. Postgres never treats two NULLs as equal for uniqueness, so
-- that constraint does NOT stop duplicate rows when school_id is null — the
-- only case that happens in, a platform-level super_admin account with no
-- home school (introduced in 066). Found live: creating one such account
-- produced two identical (user_id, 7, null) rows, because
-- handle_new_auth_user()'s own `insert ... on conflict (user_id, role_id,
-- school_id) do nothing` silently failed to dedupe against a second insert
-- for the same reason.
--
-- A partial unique index (scoped to school_id is null) closes the gap for
-- exactly that case without touching the general (user_id, role_id,
-- school_id) constraint used everywhere else.
-- ============================================================================

create unique index if not exists idx_user_roles_unique_null_school
  on public.user_roles(user_id, role_id)
  where school_id is null;
