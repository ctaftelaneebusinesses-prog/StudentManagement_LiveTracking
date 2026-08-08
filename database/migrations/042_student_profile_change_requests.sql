-- ============================================================================
-- Migration: 042_student_profile_change_requests
-- Run AFTER 036_notifications_direct_user_scope.sql and 037_avatars_teacher_write.sql.
--
-- Student/Parent Portal profile edits must never write straight to
-- `students`/`users` — a parent proposes a change, the student's class
-- teacher approves or rejects it, and only approval applies the patch (see
-- backend/src/services/studentProfileChangeRequest.service.ts). Table shape
-- and RLS mirror student_leave_requests (008_parent_module.sql +
-- 035_student_leave_requests_self_service.sql) almost exactly — same
-- propose/review split, same requester_role column, same "no RLS update
-- policy for teachers, reviews go through the service-role client" rule.
-- ============================================================================

create table if not exists public.student_profile_change_requests (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete cascade,
  student_id uuid not null references public.students(id) on delete cascade,
  requested_by uuid not null references public.users(id) on delete cascade,
  requester_role text not null default 'parent' check (requester_role in ('student', 'parent')),
  changes jsonb not null,
  reason text check (char_length(reason) between 5 and 1000),
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected', 'cancelled')),
  reviewer_notes text,
  reviewed_by uuid references public.users(id) on delete set null,
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_student_profile_change_requests_student
  on public.student_profile_change_requests(student_id, created_at desc);
create index if not exists idx_student_profile_change_requests_school_status
  on public.student_profile_change_requests(school_id, status);

alter table public.student_profile_change_requests enable row level security;

create policy student_profile_change_requests_select_own on public.student_profile_change_requests
  for select
  using (requested_by = auth.uid() and school_id = public.current_school_id());

create policy student_profile_change_requests_insert_own on public.student_profile_change_requests
  for insert
  with check (
    requested_by = auth.uid()
    and school_id = public.current_school_id()
    and (
      (requester_role = 'student' and student_id = auth.uid())
      or (
        requester_role = 'parent'
        and exists (
          select 1 from public.student_parents sp
          where sp.parent_id = auth.uid() and sp.student_id = student_profile_change_requests.student_id
        )
      )
    )
  );

create policy student_profile_change_requests_select_class_teacher on public.student_profile_change_requests
  for select
  using (
    exists (
      select 1 from public.students s
      join public.classes c on c.id = s.class_id
      where s.id = student_profile_change_requests.student_id
        and c.class_teacher_id = auth.uid()
    )
  );

create policy student_profile_change_requests_select_staff on public.student_profile_change_requests
  for select
  using (public.is_staff() and school_id = public.current_school_id());

-- ============================================================================
-- Extends notifications_type_check (036) for the three new profile-change
-- notification types. Mirrors 036's own "drop every check constraint, then
-- recreate all four" approach rather than targeting one constraint by name,
-- since Postgres auto-generates constraint names that can drift.
-- ============================================================================

do $$
declare
  c record;
begin
  for c in
    select conname from pg_constraint
    where conrelid = 'public.notifications'::regclass and contype = 'c'
  loop
    execute format('alter table public.notifications drop constraint %I', c.conname);
  end loop;
end $$;

alter table public.notifications
  add constraint notifications_audience_scope_check
    check (audience_scope in ('school', 'class', 'student', 'role', 'user')),
  add constraint notifications_type_check
    check (type in (
      'attendance', 'homework', 'marks', 'van', 'announcement', 'emergency',
      'student_leave_submitted', 'student_leave_approved', 'student_leave_rejected',
      'teacher_leave_submitted', 'teacher_leave_approved', 'teacher_leave_rejected',
      'principal_leave_submitted', 'principal_leave_approved', 'principal_leave_rejected',
      'timetable_change_suggested',
      'profile_change_submitted', 'profile_change_approved', 'profile_change_rejected'
    )),
  add constraint notifications_priority_check
    check (priority in ('normal', 'high', 'critical')),
  add constraint notifications_audience_shape_check
    check (
      (audience_scope = 'school' and audience_class_id is null and audience_user_id is null and audience_role is null) or
      (audience_scope = 'class' and audience_class_id is not null) or
      (audience_scope = 'student' and audience_user_id is not null) or
      (audience_scope = 'role' and audience_role is not null) or
      (audience_scope = 'user' and audience_user_id is not null)
    );

-- ============================================================================
-- Avatar photo edits are part of the editable-field allow-list for profile
-- change requests, but a parent uploading to `avatars/{student_id}/...` (the
-- student's own folder, not their own) satisfies neither avatars_write_own
-- (004) nor avatars_write_teacher (037) — only the student's linked parent(s)
-- are missing a write grant. Mirrors avatars_write_teacher's shape exactly,
-- scoped to student_parents instead of class ownership.
-- ============================================================================

drop policy if exists avatars_write_parent on storage.objects;
create policy avatars_write_parent on storage.objects
  for insert
  with check (
    bucket_id = 'avatars'
    and exists (
      select 1 from public.student_parents sp
      join public.students s on s.id = sp.student_id
      where sp.parent_id = auth.uid()
        and s.id::text = (storage.foldername(name))[1]
        and s.school_id = public.current_school_id()
    )
  );

drop policy if exists avatars_update_parent on storage.objects;
create policy avatars_update_parent on storage.objects
  for update
  using (
    bucket_id = 'avatars'
    and exists (
      select 1 from public.student_parents sp
      join public.students s on s.id = sp.student_id
      where sp.parent_id = auth.uid()
        and s.id::text = (storage.foldername(name))[1]
        and s.school_id = public.current_school_id()
    )
  );
