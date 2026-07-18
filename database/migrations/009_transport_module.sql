-- Phase 7 — Transport Management. vehicles and drivers already exist in schema.sql.
create table if not exists public.routes (
  id uuid primary key default gen_random_uuid(), school_id uuid not null references public.schools(id) on delete cascade,
  name text not null, route_code text not null, description text, is_active boolean not null default true,
  created_at timestamptz not null default now(), unique (school_id, route_code)
);
alter table public.vehicles add column if not exists route_id uuid references public.routes(id) on delete set null;
alter table public.vehicles add column if not exists make_model text;
alter table public.vehicles add column if not exists gps_device_id text;
create table if not exists public.pickup_points (
  id uuid primary key default gen_random_uuid(), school_id uuid not null references public.schools(id) on delete cascade,
  route_id uuid not null references public.routes(id) on delete cascade, name text not null, address text,
  stop_order integer not null check (stop_order > 0), pickup_time time, latitude numeric(9,6), longitude numeric(9,6),
  created_at timestamptz not null default now(), unique (route_id, stop_order)
);
create table if not exists public.student_pickup_points (
  student_id uuid primary key references public.students(id) on delete cascade, pickup_point_id uuid not null references public.pickup_points(id) on delete restrict,
  school_id uuid not null references public.schools(id) on delete cascade, is_active boolean not null default true
);
create table if not exists public.trips (
  id uuid primary key default gen_random_uuid(), school_id uuid not null references public.schools(id) on delete cascade,
  vehicle_id uuid not null references public.vehicles(id) on delete cascade, driver_id uuid not null references public.drivers(id) on delete restrict,
  route_id uuid references public.routes(id) on delete set null, trip_date date not null default current_date,
  direction text not null default 'pickup' check (direction in ('pickup','drop')), status text not null default 'scheduled' check (status in ('scheduled','in_progress','completed','cancelled')),
  started_at timestamptz, completed_at timestamptz, last_latitude numeric(9,6), last_longitude numeric(9,6), last_location_at timestamptz, created_at timestamptz not null default now()
);
create index if not exists idx_routes_school on public.routes(school_id);
create index if not exists idx_pickup_points_route on public.pickup_points(route_id, stop_order);
create index if not exists idx_trips_vehicle_date on public.trips(vehicle_id, trip_date);
alter table public.routes enable row level security; alter table public.pickup_points enable row level security; alter table public.student_pickup_points enable row level security; alter table public.trips enable row level security;
create policy routes_select_staff_or_driver on public.routes for select using (school_id = public.current_school_id() and (public.is_staff() or public.has_role('driver')));
create policy routes_write_staff on public.routes for all using (public.is_staff() and school_id = public.current_school_id()) with check (public.is_staff() and school_id = public.current_school_id());
create policy pickup_points_select_staff_or_driver on public.pickup_points for select using (school_id = public.current_school_id() and (public.is_staff() or public.has_role('driver')));
create policy pickup_points_write_staff on public.pickup_points for all using (public.is_staff() and school_id = public.current_school_id()) with check (public.is_staff() and school_id = public.current_school_id());
create policy student_pickups_select_staff_parent on public.student_pickup_points for select using (school_id = public.current_school_id() and (public.is_staff() or exists (select 1 from public.student_parents sp where sp.parent_id = auth.uid() and sp.student_id = student_pickup_points.student_id)));
create policy student_pickups_write_staff on public.student_pickup_points for all using (public.is_staff() and school_id = public.current_school_id()) with check (public.is_staff() and school_id = public.current_school_id());
create policy trips_select_staff_driver on public.trips for select using (school_id = public.current_school_id() and (public.is_staff() or driver_id = auth.uid()));
create policy trips_update_own_driver on public.trips for update using (driver_id = auth.uid() and school_id = public.current_school_id()) with check (driver_id = auth.uid() and school_id = public.current_school_id());
create policy trips_write_staff on public.trips for all using (public.is_staff() and school_id = public.current_school_id()) with check (public.is_staff() and school_id = public.current_school_id());
