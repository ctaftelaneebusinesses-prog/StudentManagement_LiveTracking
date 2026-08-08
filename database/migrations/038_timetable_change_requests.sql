-- ============================================================================
-- Migration: 038_timetable_change_requests
-- Run AFTER 018_timetable_module_extras.sql.
--
-- Lets a teacher *suggest* a timetable change without ever writing to
-- `timetable_periods` directly — that table's writes go through
-- timetable.service.ts::upsertPeriod, which does real time-range conflict
-- detection (teacher and room double-booking) that a teacher-initiated write
-- would bypass. A suggestion is just a proposal + reason; only an admin
-- applying it through the existing (already-validated) admin Timetable page
-- ever actually changes a period. `period_id` is nullable — a teacher may be
-- proposing a brand new period, not just editing an existing one.
-- ============================================================================

create table if not exists public.timetable_change_requests (
  id               uuid primary key default gen_random_uuid(),
  school_id        uuid not null references public.schools(id) on delete cascade,
  class_id         uuid not null references public.classes(id) on delete cascade,
  period_id        uuid references public.timetable_periods(id) on delete set null,
  teacher_id       uuid not null references public.users(id) on delete cascade,
  day_of_week      smallint not null check (day_of_week between 0 and 6),
  period_no        smallint not null,
  proposed_change  jsonb not null,
  reason           text not null check (char_length(reason) between 5 and 1000),
  status           text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  reviewed_by      uuid references public.users(id) on delete set null,
  reviewed_at      timestamptz,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

create index if not exists idx_timetable_change_requests_school on public.timetable_change_requests(school_id, status);
create index if not exists idx_timetable_change_requests_teacher on public.timetable_change_requests(teacher_id, created_at desc);

alter table public.timetable_change_requests enable row level security;

create policy timetable_change_requests_select_staff on public.timetable_change_requests
  for select
  using (public.is_staff() and school_id = public.current_school_id());

create policy timetable_change_requests_select_self on public.timetable_change_requests
  for select
  using (teacher_id = auth.uid());

create policy timetable_change_requests_insert_self on public.timetable_change_requests
  for insert
  with check (teacher_id = auth.uid() and school_id = public.current_school_id());
