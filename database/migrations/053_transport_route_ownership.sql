-- ============================================================================
-- Migration: 053_transport_route_ownership
-- Run AFTER 052_accountant_module_enhancements.sql.
--
-- Inverts transport assignment ownership: previously a vehicle carried
-- driver_id + route_id (one driver, one route, hardcoded on the vehicle
-- row). The new model has a route own its vehicle + up to two drivers,
-- assigned only while creating/editing the route (one vehicle <-> one
-- route, enforced by the unique partial index below).
--
-- Also: pickup_points.point_type ('pickup'/'drop') is dropped — stops
-- become one simple ordered list shared by both directions (the "Evening"
-- leg is always the Morning stop list reversed, computed client-side, not
-- stored). student_pickup_points gains transport_direction so a student's
-- single stop assignment can be scoped to morning/evening/both.
-- ============================================================================

alter table public.routes
  add column if not exists vehicle_id uuid references public.vehicles(id) on delete set null,
  add column if not exists primary_driver_id uuid references public.drivers(id) on delete set null,
  add column if not exists secondary_driver_id uuid references public.drivers(id) on delete set null,
  add column if not exists to_location text;

create unique index if not exists idx_routes_vehicle_id on public.routes(vehicle_id) where vehicle_id is not null;
create index if not exists idx_routes_primary_driver_id on public.routes(primary_driver_id);
create index if not exists idx_routes_secondary_driver_id on public.routes(secondary_driver_id);

-- Backfill existing vehicle-owned assignments onto their route before the
-- old columns are dropped below.
update public.routes r
set vehicle_id = v.id, primary_driver_id = v.driver_id
from public.vehicles v
where v.route_id = r.id;

-- ----------------------------------------------------------------------------
-- RLS policies that reference the soon-to-be-dropped vehicles.driver_id /
-- vehicles.route_id columns must be replaced first, or the column drops
-- below fail with a dependency error.
-- ----------------------------------------------------------------------------

drop policy if exists vehicles_select_own_driver on public.vehicles;
create policy vehicles_select_own_driver on public.vehicles
  for select
  using (
    exists (
      select 1 from public.routes r
      where r.vehicle_id = vehicles.id
        and (r.primary_driver_id = auth.uid() or r.secondary_driver_id = auth.uid())
    )
  );

drop policy if exists vehicle_locations_select_staff_driver_parent on public.vehicle_locations;
create policy vehicle_locations_select_staff_driver_parent on public.vehicle_locations for select using (
  school_id = public.current_school_id() and (public.is_staff() or driver_id = auth.uid() or exists (
    select 1 from public.student_parents sp
    join public.student_pickup_points spp on spp.student_id = sp.student_id
    join public.pickup_points pp on pp.id = spp.pickup_point_id
    join public.routes r on r.id = pp.route_id
    where sp.parent_id = auth.uid() and r.vehicle_id = vehicle_locations.vehicle_id and spp.is_active
  ))
);

drop policy if exists trip_history_select_staff_driver_parent on public.trip_history;
create policy trip_history_select_staff_driver_parent on public.trip_history for select using (
  school_id = public.current_school_id() and (
    public.is_staff()
    or exists (select 1 from public.trips t where t.id = trip_history.trip_id and t.driver_id = auth.uid())
    or exists (
      select 1 from public.student_parents sp
      join public.student_pickup_points spp on spp.student_id = sp.student_id
      join public.pickup_points pp on pp.id = spp.pickup_point_id
      join public.routes r on r.id = pp.route_id
      join public.trips t on t.vehicle_id = r.vehicle_id
      where sp.parent_id = auth.uid() and t.id = trip_history.trip_id and spp.is_active
    )
  )
);

alter table public.vehicles drop column if exists driver_id;
alter table public.vehicles drop column if exists route_id;
drop index if exists idx_vehicles_driver_id;

alter table public.pickup_points drop column if exists point_type;

alter table public.student_pickup_points
  add column if not exists transport_direction text not null default 'both'
    check (transport_direction in ('morning', 'evening', 'both'));
