-- ============================================================================
-- Migration: 068_school_creation_requests
-- Run AFTER 067_user_roles_null_school_fix.sql.
--
-- Since 066_super_admin_multi_school.sql, only super_admin holds
-- platform.manage_schools and can create a school directly. This migration
-- gives school_admin a request-based path instead: they submit proposed
-- school details, a super_admin reviews and either approves (which creates
-- the real school and assigns it to the requester) or rejects it (nothing is
-- created). Mirrors the existing registration_requests approval-queue
-- pattern (061_registration_approval.sql) rather than inventing a new shape.
-- ============================================================================

create table if not exists public.school_creation_requests (
  id                 uuid primary key default gen_random_uuid(),
  requested_by       uuid not null references public.users(id) on delete cascade,
  status             text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  payload            jsonb not null,   -- proposed school fields (name, code, address, ... ) + requester_notes
  reviewed_by        uuid references public.users(id) on delete set null,
  reviewed_at        timestamptz,
  reviewer_notes     text,
  created_school_id  uuid references public.schools(id) on delete set null,
  created_at         timestamptz not null default now()
);

create index if not exists idx_school_creation_requests_requested_by on public.school_creation_requests(requested_by);
create index if not exists idx_school_creation_requests_status on public.school_creation_requests(status);

alter table public.school_creation_requests enable row level security;

-- Writes go through the backend service role only (createSchool/approve/reject
-- all run as supabaseAdmin) — same convention as every other request-queue
-- table in this app (see rls_policies.sql's header note). RLS here governs
-- direct client reads only: the requester sees their own requests, a
-- super_admin sees every request.
create policy school_creation_requests_select on public.school_creation_requests
  for select
  using (requested_by = auth.uid() or public.is_super_admin());

insert into public.permissions (code, description) values
  ('schools.request_creation', 'Submit a request to add a new school, for a super_admin to review')
on conflict (code) do nothing;

insert into public.role_permissions (role_id, permission_id)
select (select id from public.roles where name = 'school_admin'), id
from public.permissions
where code = 'schools.request_creation'
on conflict do nothing;

-- super_admin already holds every permission (see 066's blanket grant), no
-- extra insert needed — reviewing a request reuses platform.manage_schools,
-- the same capability that already governs direct school creation.
