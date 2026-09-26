-- ============================================================================
-- Migration: 077_signup_trigger_privilege_fix
-- Security fix: SEC-01 (signup privilege escalation).
--
-- BEFORE: public.handle_new_auth_user() copied role_id and school_id from
-- new.raw_user_meta_data. That column is fully attacker-controlled — it is the
-- `options.data` payload of a public supabase.auth.signUp() call (anon key,
-- shipped in the frontend). A signup could therefore mint a super_admin or a
-- school_admin in any school, auto-approved.
--
-- AFTER: the trigger NEVER trusts client-supplied signup metadata for
-- privileged fields. Every newly-created auth user gets the safe default role
-- 'student' (id 5) and NO school. Only full_name (non-privileged) is taken
-- from user metadata.
--
-- The application's legitimate provisioning path sets the real role/school
-- authoritatively, server-side, immediately after creating the auth user —
-- see utils/provisionUser.ts, which updates public.users and public.user_roles
-- using the service role. (GoTrue applies admin-supplied app_metadata AFTER
-- this INSERT fires, so app_metadata is not reliably readable here either;
-- the authoritative server-side write is the robust mechanism.)
--
-- Net effect: signup metadata can no longer create a privileged or
-- cross-tenant account, or a privileged approved account. A raw public signup
-- (if enabled) yields only a school-less student.
--
-- PRODUCTION DEPENDENCY: this closes the metadata-injection vector. Whether an
-- anonymous person can create ANY account still depends on the Supabase
-- project's Auth setting "Allow new users to sign up". This app never uses
-- public GoTrue signup (all accounts are created server-side via provisionUser
-- / the /auth/register endpoints), so that setting SHOULD be disabled in
-- production. See audit/09-security-reproduction.md §10 (SEC-01).
--
-- Idempotent: create or replace.
-- ============================================================================

create or replace function public.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Safe defaults only. role_id/school_id are NEVER read from client-controlled
  -- metadata; the backend assigns them authoritatively after creation.
  insert into public.users (id, school_id, role_id, full_name, email)
  values (
    new.id,
    null,
    5, -- student
    coalesce(new.raw_user_meta_data ->> 'full_name', new.email),
    new.email
  );

  insert into public.user_roles (user_id, role_id, school_id)
  values (new.id, 5, null)
  on conflict (user_id, role_id, school_id) do nothing;

  return new;
end;
$$;
