-- ============================================================================
-- Migration: 047_announcement_specific_teachers
-- Run AFTER 031_announcement_principal_audience.sql.
--
-- Adds a "specific_teachers" audience_type so a principal/admin can target
-- an announcement at one or a handful of named teachers, instead of only
-- "Teachers" (every teacher in the school) or a full class roster. Mirrors
-- announcement_classes exactly (same join-table shape, same RLS), and
-- delivery reuses the existing audience_scope='user' notification row
-- (added in 036_notifications_direct_user_scope.sql) — no new notification
-- infrastructure needed.
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
    check (audience_type in ('all', 'teachers', 'parents', 'students', 'classes', 'principal', 'specific_teachers'));

create table if not exists public.announcement_teachers (
  announcement_id  uuid not null references public.announcements(id) on delete cascade,
  teacher_id       uuid not null references public.teachers(id) on delete cascade,
  primary key (announcement_id, teacher_id)
);

create index if not exists idx_announcement_teachers_teacher_id on public.announcement_teachers(teacher_id);

alter table public.announcement_teachers enable row level security;

create policy announcement_teachers_select on public.announcement_teachers
  for select
  using (
    exists (
      select 1 from public.announcements a
      where a.id = announcement_teachers.announcement_id
        and (public.is_staff() or public.has_role('teacher'))
        and a.school_id = public.current_school_id()
    )
  );

create policy announcement_teachers_write on public.announcement_teachers
  for all
  using (
    exists (
      select 1 from public.announcements a
      where a.id = announcement_teachers.announcement_id
        and (public.is_staff() or public.has_role('teacher'))
        and a.school_id = public.current_school_id()
    )
  );
