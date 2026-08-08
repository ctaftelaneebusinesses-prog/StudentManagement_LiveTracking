-- ============================================================================
-- Migration: 061_registration_approval
-- Run AFTER 060_timetable_extracurricular_periods.sql.
--
-- Adds self-registration + approval-workflow support:
--   1. users.status — the real login gate (checked by backend requireAuth,
--      see auth.middleware.ts). Defaults to 'approved' so every existing
--      admin-created account is completely unaffected; only accounts created
--      through the new POST /auth/register endpoint are inserted as
--      'pending'.
--   2. registration_requests — one central approval queue for all six
--      self-registration roles (Principal/Teacher/Accountant/Driver/
--      Extracurricular Staff/Student-Parent), rather than bolting a status
--      column onto six different extension tables. reviewer_type +
--      assigned_reviewer_id encode who may act on a given row:
--        - 'admin'         -> any School Admin/Super Admin (Principal requests,
--                              or a Student/Parent request whose chosen class
--                              currently has no class teacher assigned)
--        - 'principal'     -> any Principal (Teacher/Accountant/Driver/
--                              Extracurricular Staff requests)
--        - 'class_teacher' -> exactly assigned_reviewer_id (Student/Parent
--                              requests, resolved from classes.class_teacher_id
--                              at submit time)
--      `payload` carries proposal data that must NOT be applied to live
--      tables until approval (e.g. a teacher's proposed homeroom/subject
--      assignments — see registration.service.ts).
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. users.status — authoritative login gate.
-- ----------------------------------------------------------------------------
alter table public.users
  add column if not exists status text not null default 'approved'
    check (status in ('pending', 'approved', 'rejected'));

alter table public.users add column if not exists approval_reviewed_by uuid references public.users(id) on delete set null;
alter table public.users add column if not exists approval_reviewed_at timestamptz;
alter table public.users add column if not exists approval_reviewer_notes text;

create index if not exists idx_users_status on public.users(status);

-- ----------------------------------------------------------------------------
-- 2. registration_requests
-- ----------------------------------------------------------------------------
create table if not exists public.registration_requests (
  id                   uuid primary key default gen_random_uuid(),
  school_id            uuid not null references public.schools(id) on delete cascade,
  user_id              uuid not null references public.users(id) on delete cascade,
  role_id              smallint not null references public.roles(id),
  reviewer_type        text not null check (reviewer_type in ('admin', 'principal', 'class_teacher')),
  assigned_reviewer_id uuid references public.users(id) on delete set null,
  status               text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  reviewed_by          uuid references public.users(id) on delete set null,
  reviewed_at          timestamptz,
  reviewer_notes       text,
  payload              jsonb not null default '{}'::jsonb,
  created_at           timestamptz not null default now(),
  unique (user_id)
);

create index if not exists idx_registration_requests_school_status on public.registration_requests(school_id, reviewer_type, status);
create index if not exists idx_registration_requests_reviewer on public.registration_requests(assigned_reviewer_id, status);

alter table public.registration_requests enable row level security;

-- Real enforcement lives in the backend service layer (supabaseAdmin,
-- service-role) — these policies are defense-in-depth only, mirroring
-- timetable_change_requests (038).
create policy registration_requests_select_staff on public.registration_requests
  for select
  using (public.is_staff() and school_id = public.current_school_id());

create policy registration_requests_select_assigned_teacher on public.registration_requests
  for select
  using (assigned_reviewer_id = auth.uid());

-- ----------------------------------------------------------------------------
-- 3. registration.review permission — granted to Principal only, matching
--    the spec's "goes only to the Principal" workflow for Teacher/Accountant/
--    Driver/Extracurricular Staff requests. Admin's review of Principal
--    requests reuses the existing users.manage permission (school_admin/
--    super_admin already hold it); class-teacher review needs no permission
--    row at all — it's gated by row ownership (assigned_reviewer_id), same
--    as student_leave_requests.
-- ----------------------------------------------------------------------------
insert into public.permissions (code, description) values
  ('registration.review', 'Review and approve/reject self-registration requests routed to the Principal')
on conflict (code) do nothing;

insert into public.role_permissions (role_id, permission_id)
select (select id from public.roles where name = 'principal'), id
from public.permissions
where code = 'registration.review'
on conflict do nothing;
