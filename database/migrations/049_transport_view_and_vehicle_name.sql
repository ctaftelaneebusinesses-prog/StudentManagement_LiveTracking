-- ============================================================================
-- Migration: 049_transport_view_and_vehicle_name
-- Run AFTER 048_activity_assignment_tracking.sql.
--
-- Two independent, low-risk additions ahead of the larger transport
-- enhancement (pickup/absent tracking, ETA notifications, monitoring page):
--   1. A read-only `transport.view` permission, distinct from the existing
--      staff-only `transport.manage`, so a teacher can be granted visibility
--      into live vehicles/trips for their own students without also gaining
--      vehicle/driver/route management rights.
--   2. `vehicles.name` — an optional friendly display name (e.g. "Bus 1 —
--      Yellow Route"), distinct from `make_model` (free-text make/model,
--      e.g. "Tata Winger") and `vehicle_number` (the required registration-
--      style identifier).
-- ============================================================================

insert into public.permissions (code, description) values
  ('transport.view', 'View live vehicle/trip status and transport monitoring (read-only)')
on conflict (code) do nothing;

insert into public.role_permissions (role_id, permission_id)
select r.id, p.id
from public.roles r
cross join public.permissions p
where r.name in ('teacher', 'principal', 'school_admin', 'super_admin')
  and p.code = 'transport.view'
on conflict do nothing;

alter table public.vehicles add column if not exists name text;
