-- ============================================================================
-- Migration: 069_platform_notifications
-- Run AFTER 068_school_creation_requests.sql.
--
-- Lets a notification target a specific user with NO school context — needed
-- for platform-level events (a school_admin's request reaching a super_admin,
-- who may have no home school at all; a decision on that request reaching the
-- requester). audience_scope='user' notifications are already delivered and
-- read purely by `audience_user_id = auth.uid()` (see notifications_select_
-- direct_user in rls_policies.sql / 036_notifications_direct_user_scope.sql)
-- — that policy never references school_id, so the ONLY blocker is the
-- column's NOT NULL constraint itself. No RLS or audience_scope change needed.
-- ============================================================================

alter table public.notifications alter column school_id drop not null;

-- push_subscriptions has the same NOT NULL shape and the same problem: a
-- platform-level super_admin account (school_id null) could not subscribe to
-- push notifications at all (POST /push/subscribe 400'd with "Your account is
-- not associated with a school"). Push delivery in push.service.ts's
-- sendToUserIds looks up subscriptions purely by user_id, never by school_id,
-- so this column was never actually load-bearing for delivery — just an
-- overly strict NOT NULL left over from when every account had a school.
alter table public.push_subscriptions alter column school_id drop not null;
