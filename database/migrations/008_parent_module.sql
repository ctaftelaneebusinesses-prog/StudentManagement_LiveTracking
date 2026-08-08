-- Phase 6 — Parent Module: leave-request workflow and direct-client RLS.
--
-- Named `student_leave_requests` (not `leave_requests`) because
-- 017_teacher_module_extras.sql separately defines `public.leave_requests`
-- for teachers requesting their own leave — a different, incompatible shape
-- (teacher_id/created_by vs. this table's student_id/requested_by). Both
-- features are real and both are used by backend/src/services
-- (parentPortal.service.ts vs. leaveRequest.service.ts), so they need
-- distinct tables rather than colliding on the same name.
create table if not exists public.student_leave_requests (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete cascade,
  student_id uuid not null references public.students(id) on delete cascade,
  requested_by uuid not null references public.parents(id) on delete cascade,
  start_date date not null,
  end_date date not null,
  reason text not null check (char_length(reason) between 5 and 1000),
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected', 'cancelled')),
  reviewer_notes text,
  reviewed_by uuid references public.users(id) on delete set null,
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (end_date >= start_date)
);
create index if not exists idx_student_leave_requests_parent on public.student_leave_requests(requested_by, created_at desc);
create index if not exists idx_student_leave_requests_student on public.student_leave_requests(student_id, start_date);

alter table public.student_leave_requests enable row level security;
create policy student_leave_requests_select_parent on public.student_leave_requests for select
  using (requested_by = auth.uid() and school_id = public.current_school_id());
create policy student_leave_requests_insert_parent on public.student_leave_requests for insert
  with check (
    requested_by = auth.uid()
    and school_id = public.current_school_id()
    and exists (select 1 from public.student_parents sp where sp.parent_id = auth.uid() and sp.student_id = student_leave_requests.student_id)
  );
create policy student_leave_requests_select_staff on public.student_leave_requests for select
  using (public.is_staff() and school_id = public.current_school_id());
create policy student_leave_requests_update_staff on public.student_leave_requests for update
  using (public.is_staff() and school_id = public.current_school_id())
  with check (public.is_staff() and school_id = public.current_school_id());
