-- ============================================================================
-- Migration: 056_announcement_accountants_ec_staff
-- Run AFTER 047_announcement_specific_teachers.sql.
--
-- Adds "accountants" (broad, all accountants), "extracurricular_staff"
-- (broad, all EC staff) and "specific_extracurricular_staff" (named
-- individuals, e.g. just the dance coach) audience types. Accountants have
-- no dedicated table (resolved via user_roles, same as "principal" in
-- 031_announcement_principal_audience.sql), so only the broad option is
-- offered for them. Extracurricular staff mirrors the specific_teachers /
-- announcement_teachers shape exactly, against public.extracurricular_staff
-- instead of public.teachers.
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
    check (audience_type in (
      'all', 'teachers', 'parents', 'students', 'classes', 'principal', 'specific_teachers',
      'accountants', 'extracurricular_staff', 'specific_extracurricular_staff'
    ));

create table if not exists public.announcement_extracurricular_staff (
  announcement_id  uuid not null references public.announcements(id) on delete cascade,
  staff_id         uuid not null references public.extracurricular_staff(id) on delete cascade,
  primary key (announcement_id, staff_id)
);

create index if not exists idx_announcement_ec_staff_staff_id on public.announcement_extracurricular_staff(staff_id);

alter table public.announcement_extracurricular_staff enable row level security;

create policy announcement_ec_staff_select on public.announcement_extracurricular_staff
  for select
  using (
    exists (
      select 1 from public.announcements a
      where a.id = announcement_extracurricular_staff.announcement_id
        and (public.is_staff() or public.has_role('extracurricular_staff'))
        and a.school_id = public.current_school_id()
    )
  );

create policy announcement_ec_staff_write on public.announcement_extracurricular_staff
  for all
  using (
    exists (
      select 1 from public.announcements a
      where a.id = announcement_extracurricular_staff.announcement_id
        and (public.is_staff() or public.has_role('extracurricular_staff'))
        and a.school_id = public.current_school_id()
    )
  );
