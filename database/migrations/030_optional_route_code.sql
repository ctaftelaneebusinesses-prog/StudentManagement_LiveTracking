-- ============================================================================
-- Route Code should be optional — schools that don't use route codes
-- shouldn't be blocked from creating a route. Postgres unique constraints
-- treat NULL as distinct from every other value (including other NULLs), so
-- multiple routes with no code can coexist without violating the existing
-- unique (school_id, route_code) constraint.
-- ============================================================================

alter table public.routes alter column route_code drop not null;
