-- Phase 8 — live vehicle locations and immutable trip-event history.
create table if not exists public.vehicle_locations (
  id uuid primary key default gen_random_uuid(), school_id uuid not null references public.schools(id) on delete cascade,
  trip_id uuid not null references public.trips(id) on delete cascade, vehicle_id uuid not null references public.vehicles(id) on delete cascade,
  driver_id uuid not null references public.drivers(id) on delete restrict, latitude numeric(9,6) not null check (latitude between -90 and 90),
  longitude numeric(9,6) not null check (longitude between -180 and 180), accuracy_meters numeric(8,2), speed_mps numeric(8,2), heading numeric(6,2), recorded_at timestamptz not null default now(), created_at timestamptz not null default now()
);
create table if not exists public.trip_history (
  id uuid primary key default gen_random_uuid(), school_id uuid not null references public.schools(id) on delete cascade,
  trip_id uuid not null references public.trips(id) on delete cascade, event_type text not null check (event_type in ('started','location','completed','cancelled')),
  latitude numeric(9,6), longitude numeric(9,6), occurred_at timestamptz not null default now(), metadata jsonb not null default '{}'::jsonb
);
create index if not exists idx_vehicle_locations_trip_time on public.vehicle_locations(trip_id, recorded_at desc);
create index if not exists idx_vehicle_locations_vehicle_time on public.vehicle_locations(vehicle_id, recorded_at desc);
create index if not exists idx_trip_history_trip_time on public.trip_history(trip_id, occurred_at desc);
create unique index if not exists idx_active_trip_per_vehicle on public.trips(vehicle_id) where status = 'in_progress';
alter table public.vehicle_locations enable row level security; alter table public.trip_history enable row level security;
create policy vehicle_locations_select_staff_driver_parent on public.vehicle_locations for select using (
  school_id = public.current_school_id() and (public.is_staff() or driver_id = auth.uid() or exists (
    select 1 from public.student_parents sp join public.student_pickup_points spp on spp.student_id = sp.student_id join public.pickup_points pp on pp.id = spp.pickup_point_id join public.vehicles v on v.route_id = pp.route_id
    where sp.parent_id = auth.uid() and v.id = vehicle_locations.vehicle_id and spp.is_active
  ))
);
create policy vehicle_locations_insert_own_driver on public.vehicle_locations for insert with check (driver_id = auth.uid() and school_id = public.current_school_id() and exists (select 1 from public.trips t where t.id = vehicle_locations.trip_id and t.vehicle_id = vehicle_locations.vehicle_id and t.driver_id = auth.uid() and t.status = 'in_progress'));
create policy trip_history_select_staff_driver_parent on public.trip_history for select using (school_id = public.current_school_id() and (public.is_staff() or exists (select 1 from public.trips t where t.id = trip_history.trip_id and t.driver_id = auth.uid()) or exists (select 1 from public.student_parents sp join public.student_pickup_points spp on spp.student_id = sp.student_id join public.pickup_points pp on pp.id = spp.pickup_point_id join public.vehicles v on v.route_id = pp.route_id join public.trips t on t.vehicle_id = v.id where sp.parent_id = auth.uid() and t.id = trip_history.trip_id and spp.is_active)));
alter publication supabase_realtime add table public.vehicle_locations;
