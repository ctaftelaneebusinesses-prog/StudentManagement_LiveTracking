-- ============================================================================
-- Phase — Transport Module upgrade.
-- Run AFTER 010_realtime_van_tracking.sql.
--
-- 009_transport_module.sql / 010_realtime_van_tracking.sql shipped the
-- foundation (vehicles, drivers, routes, pickup_points, student_pickup_points,
-- trips, vehicle_locations, trip_history) with only create+list endpoints and
-- no maintenance concept. This migration adds:
--   1. A few genuinely useful "vehicle details" / "driver details" columns.
--   2. Drop points — reusing `pickup_points` with a `point_type` column
--      rather than a parallel table, since a drop point is structurally
--      identical to a pickup point (name/address/order/time/coordinates).
--   3. A drop_point_id on student_pickup_points, so one row still carries a
--      student's whole transport assignment (pickup + optional drop).
--   4. vehicle_maintenance_records — genuinely new, no prior schema.
-- No new permission codes: everything here is gated by the existing
-- `transport.manage` permission, same as every current transport route.
-- ============================================================================

alter table public.vehicles
  add column if not exists registration_number text,
  add column if not exists insurance_expiry date,
  add column if not exists fuel_type text check (fuel_type in ('petrol', 'diesel', 'cng', 'electric', 'other'));

alter table public.drivers
  add column if not exists address text,
  add column if not exists emergency_contact_phone text;

alter table public.pickup_points
  add column if not exists point_type text not null default 'pickup' check (point_type in ('pickup', 'drop'));

alter table public.student_pickup_points
  add column if not exists drop_point_id uuid references public.pickup_points(id) on delete set null;

create table if not exists public.vehicle_maintenance_records (
  id                 uuid primary key default gen_random_uuid(),
  school_id          uuid not null references public.schools(id) on delete cascade,
  vehicle_id         uuid not null references public.vehicles(id) on delete cascade,
  maintenance_type   text not null check (maintenance_type in
                       ('service', 'repair', 'inspection', 'tire_change', 'insurance_renewal', 'other')),
  description        text,
  cost               numeric(10, 2),
  performed_at       date not null default current_date,
  odometer_reading   numeric(10, 1),
  next_due_date      date,
  next_due_odometer  numeric(10, 1),
  performed_by       text,
  created_by         uuid references public.users(id) on delete set null,
  created_at         timestamptz not null default now()
);

create index if not exists idx_vehicle_maintenance_vehicle_id on public.vehicle_maintenance_records(vehicle_id);
create index if not exists idx_vehicle_maintenance_school_id on public.vehicle_maintenance_records(school_id);

alter table public.vehicle_maintenance_records enable row level security;

create policy vehicle_maintenance_select_staff on public.vehicle_maintenance_records
  for select
  using (public.is_staff() and school_id = public.current_school_id());

create policy vehicle_maintenance_write_staff on public.vehicle_maintenance_records
  for all
  using (public.is_staff() and school_id = public.current_school_id())
  with check (school_id = public.current_school_id());
