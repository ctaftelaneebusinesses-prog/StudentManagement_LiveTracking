-- ============================================================================
-- Migration: 078_protect_user_authorization_columns
-- Security fix: SEC-02 (user authorization-field modification).
--
-- BEFORE: RLS policy users_update_self allowed `using(id=auth.uid())
-- with check(id=auth.uid())` — it constrains WHICH ROW a user may update but
-- not WHICH COLUMNS, and `authenticated` holds UPDATE on the whole table. A
-- normal user could therefore PATCH their own row over PostgREST (anon key +
-- their own JWT) and set status='approved', is_active=true, or move their own
-- school_id into another tenant (school_id drives resolveSchoolId).
--
-- AFTER: a BEFORE UPDATE trigger rejects any change to the authorization
-- columns (role_id, status, is_active, school_id) when the effective database
-- role is a client role (authenticated/anon). The backend performs all
-- legitimate authorization changes through the service_role key (which
-- PostgREST runs as the `service_role` DB role), and migrations run as
-- postgres/supabase_admin — none of those are blocked. Ordinary profile
-- self-edits (full_name, phone, avatar_url, …) are unaffected.
--
-- This is enforced server/database side and cannot be bypassed from the
-- frontend or a hand-crafted REST call.
--
-- Idempotent: create or replace + drop/create trigger.
-- ============================================================================

create or replace function public.enforce_users_privileged_columns()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
  -- current_user reflects the role PostgREST SET for the request:
  --   'authenticated' (a logged-in user), 'anon' (no session).
  -- The backend's service-role key runs as 'service_role'; migrations run as
  -- 'postgres'/'supabase_admin'. Only client roles are restricted here.
  if current_user in ('authenticated', 'anon') then
    if new.role_id   is distinct from old.role_id
       or new.status is distinct from old.status
       or new.is_active is distinct from old.is_active
       or new.school_id is distinct from old.school_id then
      raise exception 'Not authorized to modify privileged user fields (role_id, status, is_active, school_id)'
        using errcode = '42501';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_enforce_users_privileged_columns on public.users;
create trigger trg_enforce_users_privileged_columns
  before update on public.users
  for each row
  execute function public.enforce_users_privileged_columns();
