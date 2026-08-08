-- ============================================================================
-- Announcement Module: add "principal" as an audience_type so an announcement
-- can be targeted at just the school's Principal(s), reusing the existing
-- role-scoped notification pipeline (audience_scope='role') rather than any
-- new delivery mechanism. The `notifications.audience_role` check constraint
-- was already dropped (and never restored) by a later block within
-- 020_announcement_module.sql, so that column is already unconstrained and
-- needs no change here; only the `announcements.audience_type` constraint
-- (still enforced) needs widening. The constraint is unnamed/auto-generated,
-- so drop-by-lookup mirrors the pattern 020 already used for this table.
-- ============================================================================

do $$
declare
  c record;
begin
  for c in
    select conname from pg_constraint
    where conrelid = 'public.announcements'::regclass and contype = 'c'
  loop
    execute format('alter table public.announcements drop constraint %I', c.conname);
  end loop;
end $$;

alter table public.announcements
  add constraint announcements_audience_type_check
    check (audience_type in ('all', 'teachers', 'parents', 'students', 'classes', 'principal'));
