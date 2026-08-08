-- ============================================================================
-- Migration: 050_trip_student_status
-- Run AFTER 049_transport_view_and_vehicle_name.sql.
--
-- Per-student-per-trip pickup/absent tracking. Nothing in the existing
-- schema carries this: `student_pickup_points` is a standing assignment (PK
-- = student_id, reused across every trip), `trips` is vehicle/driver/route
-- level only, and `trip_history` is a vehicle-level event log with no
-- student_id column. A dedicated table is required.
--
-- Rows are created lazily by the backend when a trip starts (one row per
-- student assigned to that route+direction, status='pending') rather than
-- via a DB trigger, matching this codebase's "business logic lives in
-- *.service.ts" convention.
--
-- The notified_10min_at / notified_5min_at / notified_arrived_at columns are
-- dedup state for the ETA-threshold notifications added in a later phase —
-- co-located here since both are "has X already happened for this student
-- on this trip" facts, and an atomic `UPDATE ... WHERE notified_x_at IS NULL`
-- is what prevents a notification firing on every ~10s GPS ping.
-- ============================================================================

create table if not exists public.trip_student_status (
  id                    uuid primary key default gen_random_uuid(),
  school_id             uuid not null references public.schools(id) on delete cascade,
  trip_id               uuid not null references public.trips(id) on delete cascade,
  student_id            uuid not null references public.students(id) on delete cascade,
  pickup_point_id       uuid references public.pickup_points(id) on delete set null,
  status                text not null default 'pending' check (status in ('pending', 'picked_up', 'absent')),
  marked_at             timestamptz,
  marked_by             uuid references public.users(id) on delete set null,
  notified_10min_at     timestamptz,
  notified_5min_at      timestamptz,
  notified_arrived_at   timestamptz,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now(),
  unique (trip_id, student_id)
);

create index if not exists idx_trip_student_status_trip on public.trip_student_status(trip_id);
create index if not exists idx_trip_student_status_student on public.trip_student_status(student_id);
create index if not exists idx_trip_student_status_stop_pending
  on public.trip_student_status(trip_id, pickup_point_id) where status = 'pending';

alter table public.trip_student_status enable row level security;

-- Staff, the trip's own driver, the student themself, and a parent of the
-- student can read — mirrors vehicle_locations_select_staff_driver_parent
-- (010_realtime_van_tracking.sql), plus student self-access since this table
-- also backs the student/parent-portal transport-status view.
create policy trip_student_status_select on public.trip_student_status
  for select using (
    school_id = public.current_school_id() and (
      public.is_staff()
      or exists (select 1 from public.trips t where t.id = trip_student_status.trip_id and t.driver_id = auth.uid())
      or exists (select 1 from public.student_parents sp where sp.parent_id = auth.uid() and sp.student_id = trip_student_status.student_id)
      or trip_student_status.student_id = auth.uid()
    )
  );

-- Writes (creating pending rows at trip start, marking present/absent) are
-- staff or the trip's own driver — the backend always writes through
-- supabaseAdmin anyway, so this is defense-in-depth like every other
-- transport RLS policy in this codebase.
create policy trip_student_status_write_driver_or_staff on public.trip_student_status
  for all using (
    school_id = public.current_school_id() and (
      public.is_staff()
      or exists (select 1 from public.trips t where t.id = trip_student_status.trip_id and t.driver_id = auth.uid())
    )
  )
  with check (school_id = public.current_school_id());

alter publication supabase_realtime add table public.trip_student_status;
