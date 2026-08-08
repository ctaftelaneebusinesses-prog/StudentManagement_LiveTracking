-- ============================================================================
-- School Management module: additional profile fields on `schools`, plus a
-- fix so a super_admin can write another school's logo (the existing policy
-- only allowed the uploader's own current_school_id()).
-- ============================================================================

alter table public.schools
  add column branch_name text,     -- free-text campus/branch label, distinct from the per-school public.branches table
  add column principal_name text,
  add column alternate_phone text,
  add column city text,
  add column district text,
  add column state text,
  add column pin_code text,
  add column country text;

drop policy if exists school_logos_write_staff on storage.objects;
create policy school_logos_write_staff on storage.objects
  for insert
  with check (
    bucket_id = 'school-logos'
    and (public.is_super_admin() or (public.is_staff() and (storage.foldername(name))[1] = public.current_school_id()::text))
  );

drop policy if exists school_logos_update_staff on storage.objects;
create policy school_logos_update_staff on storage.objects
  for update
  using (
    bucket_id = 'school-logos'
    and (public.is_super_admin() or (public.is_staff() and (storage.foldername(name))[1] = public.current_school_id()::text))
  );
