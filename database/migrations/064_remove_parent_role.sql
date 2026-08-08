-- Removes the parent role and account system entirely. Parents now log in as
-- their child's own student account instead of a separate parent account —
-- the "combined Student/Parent Portal" turned out to share ~95% of its UI
-- between the two roles anyway, so the separate account system (parents,
-- student_parents, ~20 RLS policies, a child-switcher) wasn't earning its
-- keep. There were zero real parent accounts in production at the time of
-- this migration (verified by querying users.role_id = 4) — this is a pure
-- architecture removal, not a data migration.
--
-- A couple of tables/policies are *named* "parent" but are actually used by
-- students too (live-location tracking) — those are renamed/rewritten below
-- to preserve student capability, not dropped outright.

-- ----------------------------------------------------------------------------
-- role_permissions rows for the parent role (FK-blocks the roles delete below)
-- ----------------------------------------------------------------------------
delete from public.role_permissions where role_id = 4;

-- ----------------------------------------------------------------------------
-- Pure parent-only SELECT policies — drop outright (the survived tables all
-- already have a separate staff/self/teacher policy covering non-parent access).
-- ----------------------------------------------------------------------------
drop policy if exists attendance_select_parent on public.attendance;
drop policy if exists evaluated_papers_select_parent on public.evaluated_papers;
drop policy if exists exam_documents_select_parent on public.exam_documents;
drop policy if exists exam_marks_select_parent on public.exam_marks;
drop policy if exists fee_payments_select_parent on public.fee_payments;
drop policy if exists fee_structures_select_parent on public.fee_structures;
drop policy if exists fee_structures_select_parent_direct on public.fee_structures;
drop policy if exists homework_select_parent on public.homework;
drop policy if exists homework_submissions_select_parent on public.homework_submissions;
drop policy if exists student_documents_select_parent on public.student_documents;
drop policy if exists student_fee_overrides_select_parent on public.student_fee_overrides;
drop policy if exists student_leave_requests_insert_parent on public.student_leave_requests;
drop policy if exists student_siblings_select_parent on public.student_siblings;
drop policy if exists students_select_parent on public.students;
drop policy if exists syllabus_select_parent on public.syllabus;
drop policy if exists timetable_select_parent on public.timetable_periods;
drop policy if exists avatars_update_parent on storage.objects;
drop policy if exists avatars_write_parent on storage.objects;

-- ----------------------------------------------------------------------------
-- storage.objects policies: parent branch mixed with an existing direct
-- student branch — drop and recreate without the parent OR-clause.
-- ----------------------------------------------------------------------------
drop policy if exists exam_documents_select on storage.objects;
create policy exam_documents_select on storage.objects for select
  using (
    bucket_id = 'exam-documents'
    and (
      is_staff()
      or exists (
        select 1 from exam_documents ed
        join exams e on e.id = ed.exam_id
        join students s on s.class_id = e.class_id
        where ed.storage_path = objects.name and ed.is_published = true and s.id = auth.uid()
      )
    )
  );

drop policy if exists syllabus_documents_select on storage.objects;
create policy syllabus_documents_select on storage.objects for select
  using (
    bucket_id = 'syllabus-documents'
    and (
      is_staff()
      or exists (
        select 1 from syllabus sy
        join students s on s.class_id = sy.class_id
        where sy.storage_path = objects.name and sy.is_published = true and s.id = auth.uid()
      )
    )
  );

drop policy if exists evaluated_papers_storage_select on storage.objects;
create policy evaluated_papers_storage_select on storage.objects for select
  using (
    bucket_id = 'evaluated-papers'
    and (
      is_staff()
      or (storage.foldername(name))[2] = (auth.uid())::text
      or exists (
        select 1 from students s
        where (s.id)::text = (storage.foldername(objects.name))[2]
        and (
          exists (select 1 from classes c where c.id = s.class_id and c.class_teacher_id = auth.uid())
          or exists (select 1 from class_subjects cs where cs.class_id = s.class_id and cs.teacher_id = auth.uid())
        )
      )
    )
  );

drop policy if exists student_documents_select on storage.objects;
create policy student_documents_select on storage.objects for select
  using (
    bucket_id = 'student-documents'
    and (is_staff() or (storage.foldername(name))[2] = (auth.uid())::text)
  );

-- ----------------------------------------------------------------------------
-- notifications: same pattern — student already has a direct branch, drop parent's.
-- ----------------------------------------------------------------------------
drop policy if exists notifications_select_class on public.notifications;
create policy notifications_select_class on public.notifications for select
  using (
    audience_scope = 'class'
    and (
      exists (select 1 from students s where s.id = auth.uid() and s.class_id = notifications.audience_class_id)
      or exists (select 1 from class_subjects cs where cs.teacher_id = auth.uid() and cs.class_id = notifications.audience_class_id)
    )
  );

drop policy if exists notifications_select_direct on public.notifications;
create policy notifications_select_direct on public.notifications for select
  using (audience_scope = 'student' and audience_user_id = auth.uid());

-- ----------------------------------------------------------------------------
-- Transport: these tables had NO direct student branch — only staff/driver/
-- parent could see them, meaning a student's own vehicle tracking was only
-- ever reachable via a linked parent account. Add a direct student_id/
-- student_pickup_points branch so removing parent doesn't regress the
-- student's own live-tracking view (PortalTransportPage.tsx subscribes to
-- vehicle_locations via Supabase Realtime, which enforces these policies).
-- ----------------------------------------------------------------------------
drop policy if exists vehicle_locations_select_staff_driver_parent on public.vehicle_locations;
create policy vehicle_locations_select_staff_driver_student on public.vehicle_locations for select
  using (
    school_id = current_school_id()
    and (
      is_staff()
      or driver_id = auth.uid()
      or exists (
        select 1 from student_pickup_points spp
        join pickup_points pp on pp.id = spp.pickup_point_id
        join routes r on r.id = pp.route_id
        where spp.student_id = auth.uid() and r.vehicle_id = vehicle_locations.vehicle_id and spp.is_active
      )
    )
  );

drop policy if exists trip_history_select_staff_driver_parent on public.trip_history;
create policy trip_history_select_staff_driver_student on public.trip_history for select
  using (
    school_id = current_school_id()
    and (
      is_staff()
      or exists (select 1 from trips t where t.id = trip_history.trip_id and t.driver_id = auth.uid())
      or exists (
        select 1 from student_pickup_points spp
        join pickup_points pp on pp.id = spp.pickup_point_id
        join routes r on r.id = pp.route_id
        join trips t on t.vehicle_id = r.vehicle_id
        where spp.student_id = auth.uid() and t.id = trip_history.trip_id and spp.is_active
      )
    )
  );

drop policy if exists trip_student_status_select on public.trip_student_status;
create policy trip_student_status_select on public.trip_student_status for select
  using (
    school_id = current_school_id()
    and (
      is_staff()
      or exists (select 1 from trips t where t.id = trip_student_status.trip_id and t.driver_id = auth.uid())
      or student_id = auth.uid()
    )
  );

drop policy if exists student_pickups_select_staff_parent on public.student_pickup_points;
create policy student_pickups_select_staff_student on public.student_pickup_points for select
  using (school_id = current_school_id() and (is_staff() or student_id = auth.uid()));

-- ----------------------------------------------------------------------------
-- student_leave_requests: "_select_parent" is misnamed — its qual is just
-- requested_by = auth.uid(), which already covers students today (see
-- 035_student_leave_requests_self_service.sql's student insert policy).
-- Rename for clarity, then narrow the requester_role check to student-only.
-- ----------------------------------------------------------------------------
drop policy if exists student_leave_requests_select_parent on public.student_leave_requests;
create policy student_leave_requests_select_own on public.student_leave_requests for select
  using (requested_by = auth.uid() and school_id = current_school_id());

alter table public.student_leave_requests drop constraint if exists student_leave_requests_requester_role_check;
alter table public.student_leave_requests add constraint student_leave_requests_requester_role_check check (requester_role = 'student');

-- ----------------------------------------------------------------------------
-- student_profile_change_requests: drop the parent OR-branch from insert_own,
-- narrow the requester_role check the same way.
-- ----------------------------------------------------------------------------
drop policy if exists student_profile_change_requests_insert_own on public.student_profile_change_requests;
create policy student_profile_change_requests_insert_own on public.student_profile_change_requests for insert
  with check (
    requested_by = auth.uid()
    and school_id = current_school_id()
    and requester_role = 'student'
    and student_id = auth.uid()
  );

alter table public.student_profile_change_requests drop constraint if exists student_profile_change_requests_requester_role_check;
alter table public.student_profile_change_requests add constraint student_profile_change_requests_requester_role_check check (requester_role = 'student');

-- ----------------------------------------------------------------------------
-- announcements: drop 'parents' from the audience_type check constraint
-- (the currently-live version of a constraint redeclared several times
-- across 020/031/047/056 — this alters whichever definition is active now).
-- ----------------------------------------------------------------------------
alter table public.announcements drop constraint if exists announcements_audience_type_check;
alter table public.announcements add constraint announcements_audience_type_check
  check (audience_type = any (array[
    'all', 'teachers', 'students', 'classes', 'principal',
    'specific_teachers', 'accountants', 'extracurricular_staff', 'specific_extracurricular_staff'
  ]));

-- ----------------------------------------------------------------------------
-- parent_locations is actually "whoever has the Transport page open's live
-- position" — used by students too, not parent-only. Rename rather than drop.
-- ----------------------------------------------------------------------------
alter table public.parent_locations rename to student_live_locations;
alter table public.student_live_locations rename constraint parent_locations_latitude_check to student_live_locations_latitude_check;
alter table public.student_live_locations rename constraint parent_locations_longitude_check to student_live_locations_longitude_check;
alter table public.student_live_locations rename constraint parent_locations_school_id_fkey to student_live_locations_school_id_fkey;
alter table public.student_live_locations rename constraint parent_locations_student_id_fkey to student_live_locations_student_id_fkey;
alter table public.student_live_locations rename constraint parent_locations_updated_by_fkey to student_live_locations_updated_by_fkey;
alter index parent_locations_pkey rename to student_live_locations_pkey;
alter index idx_parent_locations_school_id rename to idx_student_live_locations_school_id;

drop policy if exists parent_locations_select_staff on public.student_live_locations;
create policy student_live_locations_select_staff on public.student_live_locations for select
  using (is_staff() and school_id = current_school_id());

-- ----------------------------------------------------------------------------
-- Finally, drop the parent account system itself and the role row. Any
-- parent user (there was exactly one throwaway test account) must already be
-- deleted via the Supabase auth admin API before this runs, so these tables
-- are empty and the cascade is a no-op, not a data loss.
-- ----------------------------------------------------------------------------
drop policy if exists student_parents_select_involved on public.student_parents;
drop policy if exists student_parents_write_staff on public.student_parents;
drop policy if exists parents_select_self on public.parents;
drop policy if exists parents_select_staff on public.parents;
drop policy if exists parents_write_staff on public.parents;

drop table if exists public.student_parents;
drop table if exists public.parents;

delete from public.roles where id = 4;
