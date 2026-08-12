-- ----------------------------------------------------------------------------
-- vehicle_locations_select_staff_driver_student (064_remove_parent_role.sql)
-- let a student read every GPS ping for their assigned vehicle regardless of
-- trip status, relying entirely on the frontend's client-side "activeTrip"
-- filter to hide stale/completed-trip positions. That's fine for the app's
-- own UI, but a student's own Supabase JS client authenticates with the
-- student's own JWT for the Realtime subscription (PortalTransportPage.tsx),
-- so this RLS policy is the actual authorization boundary for direct table
-- reads. Tighten the student branch so a completed/cancelled trip's location
-- rows stop being selectable the moment the driver ends the trip — staff and
-- driver branches are left unrestricted since they need full trip history.
-- ----------------------------------------------------------------------------
drop policy if exists vehicle_locations_select_staff_driver_student on public.vehicle_locations;
create policy vehicle_locations_select_staff_driver_student on public.vehicle_locations for select
  using (
    school_id = current_school_id()
    and (
      is_staff()
      or driver_id = auth.uid()
      or (
        exists (
          select 1 from student_pickup_points spp
          join pickup_points pp on pp.id = spp.pickup_point_id
          join routes r on r.id = pp.route_id
          where spp.student_id = auth.uid() and r.vehicle_id = vehicle_locations.vehicle_id and spp.is_active
        )
        and exists (
          select 1 from trips t where t.id = vehicle_locations.trip_id and t.status = 'in_progress'
        )
      )
    )
  );
