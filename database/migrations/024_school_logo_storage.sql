-- ============================================================================
-- Settings Module follow-up — school logo storage bucket
-- Public "school-logos" bucket, keyed by {school_id}/logo.{ext}. Read is
-- public (logos appear on login/branding screens); write is restricted to
-- staff of that school, same shape as the avatars bucket in 004.
-- ============================================================================

insert into storage.buckets (id, name, public)
values ('school-logos', 'school-logos', true)
on conflict (id) do nothing;

drop policy if exists school_logos_read_public on storage.objects;
create policy school_logos_read_public on storage.objects
  for select
  using (bucket_id = 'school-logos');

drop policy if exists school_logos_write_staff on storage.objects;
create policy school_logos_write_staff on storage.objects
  for insert
  with check (
    bucket_id = 'school-logos'
    and public.is_staff()
    and (storage.foldername(name))[1] = public.current_school_id()::text
  );

drop policy if exists school_logos_update_staff on storage.objects;
create policy school_logos_update_staff on storage.objects
  for update
  using (
    bucket_id = 'school-logos'
    and public.is_staff()
    and (storage.foldername(name))[1] = public.current_school_id()::text
  );
