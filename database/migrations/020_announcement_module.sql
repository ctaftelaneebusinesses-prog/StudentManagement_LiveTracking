-- ============================================================================
-- Phase — Announcement Module.
-- Run AFTER 012_notification_system.sql.
--
-- Adds a dedicated authoring/management layer for announcements (create,
-- edit, delete, schedule, rich text, file attachments, flexible audience
-- targeting) that, on publish, feeds delivery through the *existing*
-- notifications table/RLS/Realtime pipeline (006, 012) rather than
-- reinventing it — the bell dropdown and foreground browser notifications
-- keep working unchanged. Also adds true OS-level push notifications
-- (service worker + Push API + VAPID), which is genuinely new
-- infrastructure, via a `push_subscriptions` table.
--
-- Sections:
--   1. announcements / announcement_classes / announcement_attachments
--   2. notifications: add a 'role' audience_scope (all teachers/parents/
--      students at once) + a link back to the authoring announcement
--   3. announcement-attachments storage bucket
--   4. push_subscriptions (web push)
--   5. Permissions
--   6. RLS
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. announcements / announcement_classes / announcement_attachments
--
-- `id` has no DB-generated default deliberately — the frontend supplies a
-- client-generated uuid up front so attachment files can be uploaded to
-- their final storage path (`{school_id}/{announcement_id}/...`) *before*
-- the announcement row itself is created.
--
-- `notified_at` is null until the audience fan-out (insertion of the
-- corresponding `notifications` row(s)) has run; the in-process scheduler
-- uses `notified_at is null and publish_at <= now()` to find due rows.
-- ----------------------------------------------------------------------------
create table if not exists public.announcements (
  id             uuid primary key,
  school_id      uuid not null references public.schools(id) on delete cascade,
  title          text not null,
  body           text not null,
  audience_type  text not null check (audience_type in ('all', 'teachers', 'parents', 'students', 'classes')),
  publish_at     timestamptz not null default now(),
  notified_at    timestamptz,
  created_by     uuid references public.users(id) on delete set null,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

create index if not exists idx_announcements_school_id on public.announcements(school_id);
create index if not exists idx_announcements_publish_at on public.announcements(publish_at) where notified_at is null;

create table if not exists public.announcement_classes (
  announcement_id  uuid not null references public.announcements(id) on delete cascade,
  class_id         uuid not null references public.classes(id) on delete cascade,
  primary key (announcement_id, class_id)
);

create table if not exists public.announcement_attachments (
  id               uuid primary key default gen_random_uuid(),
  announcement_id  uuid not null references public.announcements(id) on delete cascade,
  file_name        text not null,
  file_type        text not null check (file_type in ('pdf', 'image', 'document')),
  storage_path     text not null,
  file_size        bigint,
  created_at       timestamptz not null default now()
);

create index if not exists idx_announcement_attachments_announcement_id on public.announcement_attachments(announcement_id);

-- ----------------------------------------------------------------------------
-- 2. notifications: add a 'role' audience scope (broadcast to every teacher /
--    parent / student in the school at once, without one row per user) and a
--    back-reference to the announcement that produced the row (so editing or
--    deleting an announcement can find/cascade its delivered notifications).
-- ----------------------------------------------------------------------------
alter table public.notifications
  add column if not exists related_announcement_id uuid references public.announcements(id) on delete cascade,
  add column if not exists audience_role text check (audience_role in ('teacher', 'parent', 'student'));

create index if not exists idx_notifications_related_announcement on public.notifications(related_announcement_id);

-- Replace the original (unnamed, auto-named) audience_scope/shape check from
-- 006 with one that also allows audience_scope='role'.
do $$
declare
  c record;
begin
  for c in
    select conname from pg_constraint
    where conrelid = 'public.notifications'::regclass and contype = 'c'
  loop
    execute format('alter table public.notifications drop constraint %I', c.conname);
  end loop;
end $$;

alter table public.notifications
  add constraint notifications_audience_scope_check
    check (audience_scope in ('school', 'class', 'student', 'role')),
  add constraint notifications_type_check
    check (type in ('attendance', 'homework', 'marks', 'van', 'announcement', 'emergency')),
  add constraint notifications_priority_check
    check (priority in ('normal', 'high', 'critical')),
  add constraint notifications_audience_shape_check
    check (
      (audience_scope = 'school' and audience_class_id is null and audience_user_id is null and audience_role is null) or
      (audience_scope = 'class' and audience_class_id is not null) or
      (audience_scope = 'student' and audience_user_id is not null) or
      (audience_scope = 'role' and audience_role is not null)
    );

create policy notifications_select_role on public.notifications
  for select
  using (
    audience_scope = 'role'
    and school_id = public.current_school_id()
    and public.has_role(audience_role)
  );

-- ----------------------------------------------------------------------------
-- 3. announcement-attachments storage bucket — private; files are keyed
--    `{school_id}/{announcement_id}/{filename}`. Read access is intentionally
--    broader than student-documents: any authenticated user in the same
--    school can read (announcements are broadcast content, not confidential
--    per-student records), while writes stay staff/teacher-only.
-- ----------------------------------------------------------------------------
insert into storage.buckets (id, name, public)
values ('announcement-attachments', 'announcement-attachments', false)
on conflict (id) do nothing;

drop policy if exists announcement_attachments_select on storage.objects;
create policy announcement_attachments_select on storage.objects
  for select
  using (
    bucket_id = 'announcement-attachments'
    and exists (
      select 1 from public.users u
      where u.id = auth.uid() and u.school_id::text = (storage.foldername(name))[1]
    )
  );

drop policy if exists announcement_attachments_write_staff on storage.objects;
create policy announcement_attachments_write_staff on storage.objects
  for insert
  with check (
    bucket_id = 'announcement-attachments'
    and (public.is_staff() or public.has_role('teacher'))
    and (storage.foldername(name))[1] = public.current_school_id()::text
  );

drop policy if exists announcement_attachments_update_staff on storage.objects;
create policy announcement_attachments_update_staff on storage.objects
  for update
  using (
    bucket_id = 'announcement-attachments'
    and (public.is_staff() or public.has_role('teacher'))
    and (storage.foldername(name))[1] = public.current_school_id()::text
  );

drop policy if exists announcement_attachments_delete_staff on storage.objects;
create policy announcement_attachments_delete_staff on storage.objects
  for delete
  using (
    bucket_id = 'announcement-attachments'
    and (public.is_staff() or public.has_role('teacher'))
    and (storage.foldername(name))[1] = public.current_school_id()::text
  );

-- ----------------------------------------------------------------------------
-- 4. push_subscriptions — one row per browser/device a user has granted Web
--    Push permission on. The backend fans out to these directly (via the
--    `web-push` library) rather than relying on RLS, since a push send is a
--    server-initiated action against a stored endpoint, not a client read.
-- ----------------------------------------------------------------------------
create table if not exists public.push_subscriptions (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references public.users(id) on delete cascade,
  school_id   uuid not null references public.schools(id) on delete cascade,
  endpoint    text not null unique,
  p256dh      text not null,
  auth_key    text not null,
  created_at  timestamptz not null default now()
);

create index if not exists idx_push_subscriptions_user_id on public.push_subscriptions(user_id);

-- ----------------------------------------------------------------------------
-- 5. Permissions.
-- ----------------------------------------------------------------------------
insert into public.permissions (code, description) values
  ('announcements.view',   'View announcements'),
  ('announcements.manage', 'Create, edit, delete, and schedule announcements')
on conflict (code) do nothing;

insert into public.role_permissions (role_id, permission_id)
select r.id, p.id
from public.roles r
cross join public.permissions p
where r.name in ('school_admin', 'principal', 'teacher', 'super_admin')
  and p.code in ('announcements.view', 'announcements.manage')
on conflict do nothing;

insert into public.role_permissions (role_id, permission_id)
select r.id, p.id
from public.roles r
cross join public.permissions p
where r.name in ('parent', 'student')
  and p.code = 'announcements.view'
on conflict do nothing;

-- ----------------------------------------------------------------------------
-- 6. RLS on the new authoring tables. The backend always writes through
--    supabaseAdmin (service role), so these are defense-in-depth, matching
--    the convention used by every other module in this repo.
-- ----------------------------------------------------------------------------
alter table public.announcements enable row level security;

create policy announcements_select_staff on public.announcements
  for select
  using ((public.is_staff() or public.has_role('teacher')) and school_id = public.current_school_id());

create policy announcements_write_staff on public.announcements
  for all
  using ((public.is_staff() or public.has_role('teacher')) and school_id = public.current_school_id())
  with check (school_id = public.current_school_id());

alter table public.announcement_classes enable row level security;

create policy announcement_classes_select on public.announcement_classes
  for select
  using (
    exists (
      select 1 from public.announcements a
      where a.id = announcement_classes.announcement_id
        and (public.is_staff() or public.has_role('teacher'))
        and a.school_id = public.current_school_id()
    )
  );

create policy announcement_classes_write on public.announcement_classes
  for all
  using (
    exists (
      select 1 from public.announcements a
      where a.id = announcement_classes.announcement_id
        and (public.is_staff() or public.has_role('teacher'))
        and a.school_id = public.current_school_id()
    )
  );

alter table public.announcement_attachments enable row level security;

create policy announcement_attachments_select_meta on public.announcement_attachments
  for select
  using (
    exists (
      select 1 from public.announcements a
      where a.id = announcement_attachments.announcement_id
        and a.school_id = public.current_school_id()
    )
  );

create policy announcement_attachments_write_meta on public.announcement_attachments
  for all
  using (
    exists (
      select 1 from public.announcements a
      where a.id = announcement_attachments.announcement_id
        and (public.is_staff() or public.has_role('teacher'))
        and a.school_id = public.current_school_id()
    )
  );

alter table public.push_subscriptions enable row level security;

create policy push_subscriptions_self on public.push_subscriptions
  for all
  using (user_id = auth.uid())
  with check (user_id = auth.uid());
