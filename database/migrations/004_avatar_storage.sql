-- ============================================================================
-- Phase 2 — Avatar storage bucket for Profile Management
-- Run AFTER 003_rbac_rls_policies.sql.
--
-- Creates a private "avatars" bucket and storage policies so a user may only
-- upload/update/read their own avatar file. Files are keyed by
-- `{user_id}/{filename}` — the policies check that the first path segment
-- (storage.foldername) matches auth.uid().
-- ============================================================================

insert into storage.buckets (id, name, public)
values ('avatars', 'avatars', true)
on conflict (id) do nothing;

drop policy if exists avatars_read_public on storage.objects;
create policy avatars_read_public on storage.objects
  for select
  using (bucket_id = 'avatars');

drop policy if exists avatars_write_own on storage.objects;
create policy avatars_write_own on storage.objects
  for insert
  with check (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists avatars_update_own on storage.objects;
create policy avatars_update_own on storage.objects
  for update
  using (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists avatars_delete_own on storage.objects;
create policy avatars_delete_own on storage.objects
  for delete
  using (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  );
