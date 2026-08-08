-- ============================================================================
-- Phase 12 — Notification System
-- Run AFTER 011_homework_submissions.sql.
--
-- Extends the announcement-style notifications table (006) with a `type`
-- so attendance/homework/marks/van/announcement/emergency events are all
-- carried by the same table instead of six bespoke ones, a `priority` for
-- emergency alerts, a `metadata` bag for deep-linking (homework_id, exam_id,
-- trip_id, ...), and `email_sent_at` so the async email dispatcher can tell
-- which rows it has already mailed out. Also turns on Supabase Realtime for
-- the table so the frontend can subscribe to postgres_changes directly
-- (RLS policies already scope exactly what each subscriber is allowed to
-- see, so no extra server-side fan-out is needed for realtime delivery).
-- ============================================================================

alter table public.notifications
  add column if not exists type text not null default 'announcement'
    check (type in ('attendance', 'homework', 'marks', 'van', 'announcement', 'emergency')),
  add column if not exists priority text not null default 'normal'
    check (priority in ('normal', 'high', 'critical')),
  add column if not exists metadata jsonb not null default '{}'::jsonb,
  add column if not exists email_sent_at timestamptz;

create index if not exists idx_notifications_type on public.notifications(type);
create index if not exists idx_notifications_school_created on public.notifications(school_id, created_at desc);

-- Realtime: lets authenticated clients subscribe to INSERT/UPDATE events on
-- this table via supabase-js `.channel().on('postgres_changes', ...)`.
-- Postgres Changes still enforces the table's RLS select policies per
-- subscriber, so this does not widen who can see what.
alter publication supabase_realtime add table public.notifications;

-- super_admin was granted "every permission" once, in migration 002, before
-- notifications.view/manage existed (added later in 006) — backfill them so
-- the new POST /notifications/emergency route (school_admin/principal/
-- super_admin) actually works for a super_admin account.
insert into public.role_permissions (role_id, permission_id)
select (select id from public.roles where name = 'super_admin'), id
from public.permissions
where code in ('notifications.view', 'notifications.manage')
on conflict do nothing;
