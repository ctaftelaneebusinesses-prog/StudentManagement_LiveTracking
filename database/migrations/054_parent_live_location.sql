-- ============================================================================
-- Migration: 054_parent_live_location
-- Run AFTER 053_transport_route_ownership.sql.
--
-- One row per student (upserted), holding the last known GPS position of
-- whoever currently has that student's Transport page open (parent or the
-- student themself) — not a full ping history like vehicle_locations, since
-- only the latest position is ever needed to personalize ETA/threshold
-- notifications to the viewer's actual live location instead of the
-- student's registered (fixed) stop.
-- ============================================================================

create table if not exists public.parent_locations (
  student_id       uuid primary key references public.students(id) on delete cascade,
  school_id        uuid not null references public.schools(id) on delete cascade,
  latitude         numeric(9,6) not null check (latitude between -90 and 90),
  longitude        numeric(9,6) not null check (longitude between -180 and 180),
  accuracy_meters  numeric(8,2),
  recorded_at      timestamptz not null default now(),
  updated_by       uuid references public.users(id) on delete set null
);

create index if not exists idx_parent_locations_school_id on public.parent_locations(school_id);

alter table public.parent_locations enable row level security;

-- Writes always go through the backend (service-role supabaseAdmin) after an
-- assertStudentAccess check, matching every other transport write in this
-- codebase — this is defense-in-depth staff visibility only.
create policy parent_locations_select_staff on public.parent_locations
  for select
  using (public.is_staff() and school_id = public.current_school_id());
