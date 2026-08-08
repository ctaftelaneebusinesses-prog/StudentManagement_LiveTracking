-- ============================================================================
-- Phase 14 — Production Preparation: attendance module schema fix
--
-- backend/src/services/attendance.service.ts (teacher marking/history +
-- principal/admin reporting) was written against an `attendance_date`
-- column, an `updated_by` column, an `attendance_history` audit table, and
-- four `vw_attendance_*` reporting views. None of those exist in the schema
-- actually committed and applied — 006_student_management_module.sql defines
-- `attendance` with a `date` column and nothing else — so every one of those
-- code paths currently throws "column/relation does not exist" against a
-- real database (the whole attendance feature is non-functional in
-- production today). This migration adds the missing pieces against the
-- real uuid schema and the real `date` column; attendance.service.ts is
-- fixed in the same pass to read `date` directly instead of the
-- never-existed `attendance_date`. The frontend's teacher attendance
-- service/page were already written correctly against `date` — only this
-- one backend file had drifted from the schema.
-- ============================================================================

-- 1. Columns the service writes on edit (`marked_by` already exists from 006).
alter table public.attendance add column if not exists updated_at timestamptz not null default now();
alter table public.attendance add column if not exists updated_by uuid references public.users(id) on delete set null;

-- 2. Audit trail of status changes.
create table if not exists public.attendance_history (
  id             uuid primary key default gen_random_uuid(),
  attendance_id  uuid not null references public.attendance(id) on delete cascade,
  student_id     uuid not null references public.students(id) on delete cascade,
  old_status     text,
  new_status     text not null,
  change_reason  text,
  changed_by     uuid references public.users(id) on delete set null,
  changed_at     timestamptz not null default now()
);

create index if not exists idx_attendance_history_attendance_id on public.attendance_history(attendance_id);
create index if not exists idx_attendance_history_student_id on public.attendance_history(student_id);

alter table public.attendance_history enable row level security;

drop policy if exists attendance_history_select_staff on public.attendance_history;
create policy attendance_history_select_staff on public.attendance_history
  for select
  using (
    public.is_staff()
    and exists (
      select 1 from public.attendance a
      where a.id = attendance_history.attendance_id and a.school_id = public.current_school_id()
    )
  );

drop policy if exists attendance_history_select_teacher on public.attendance_history;
create policy attendance_history_select_teacher on public.attendance_history
  for select
  using (
    public.has_role('teacher')
    and exists (
      select 1 from public.attendance a
      join public.class_subjects cs on cs.class_id = a.class_id
      where a.id = attendance_history.attendance_id and cs.teacher_id = auth.uid()
    )
  );

-- Every UPDATE that actually changes status logs a row automatically —
-- editAttendance() no longer needs to write attendance_history itself.
create or replace function public.fn_log_attendance_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if (TG_OP = 'UPDATE' and old.status is distinct from new.status) then
    insert into public.attendance_history (attendance_id, student_id, old_status, new_status, changed_by, change_reason)
    values (new.id, new.student_id, old.status, new.status, new.updated_by, new.remarks);
  end if;
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists trg_attendance_history on public.attendance;
create trigger trg_attendance_history
  before update on public.attendance
  for each row
  execute function public.fn_log_attendance_change();

-- 3. Reporting views for the principal/admin report endpoints. Column is
--    exposed as `attendance_date` (aliased from the real `date` column)
--    since that's what attendance.service.ts's daily/monthly report
--    functions filter and read.
create or replace view public.vw_attendance_daily_summary as
select
  a.date as attendance_date,
  a.class_id,
  (c.name || ' ' || c.section) as class_name,
  count(*) filter (where a.status = 'present')  as present_count,
  count(*) filter (where a.status = 'absent')   as absent_count,
  count(*) filter (where a.status = 'late')     as late_count,
  count(*) filter (where a.status = 'half_day') as half_day_count,
  count(*) filter (where a.status = 'leave')    as leave_count,
  count(*) as total_marked,
  round(100.0 * count(*) filter (where a.status = 'present') / nullif(count(*), 0), 2) as present_pct
from public.attendance a
join public.classes c on c.id = a.class_id
group by a.date, a.class_id, c.name, c.section;

create or replace view public.vw_attendance_monthly_summary as
select
  date_trunc('month', a.date)::date as month,
  a.class_id,
  (c.name || ' ' || c.section) as class_name,
  count(*) filter (where a.status = 'present')  as present_count,
  count(*) filter (where a.status = 'absent')   as absent_count,
  count(*) filter (where a.status = 'late')     as late_count,
  count(*) filter (where a.status = 'half_day') as half_day_count,
  count(*) filter (where a.status = 'leave')    as leave_count,
  count(*) as total_marked,
  round(100.0 * count(*) filter (where a.status = 'present') / nullif(count(*), 0), 2) as present_pct
from public.attendance a
join public.classes c on c.id = a.class_id
group by date_trunc('month', a.date), a.class_id, c.name, c.section;

create or replace view public.vw_attendance_student_summary as
select
  a.student_id,
  s.class_id,
  u.full_name as student_name,
  count(*) filter (where a.status = 'present')  as present_count,
  count(*) filter (where a.status = 'absent')   as absent_count,
  count(*) filter (where a.status = 'late')     as late_count,
  count(*) filter (where a.status = 'half_day') as half_day_count,
  count(*) filter (where a.status = 'leave')    as leave_count,
  count(*) as total_marked,
  round(100.0 * count(*) filter (where a.status = 'present') / nullif(count(*), 0), 2) as present_pct
from public.attendance a
join public.students s on s.id = a.student_id
join public.users u on u.id = s.id
group by a.student_id, s.class_id, u.full_name;

create or replace view public.vw_attendance_class_summary as
select
  a.class_id,
  (c.name || ' ' || c.section) as class_name,
  count(distinct a.student_id) as student_count,
  count(*) filter (where a.status = 'present')  as present_count,
  count(*) filter (where a.status = 'absent')   as absent_count,
  count(*) filter (where a.status = 'late')     as late_count,
  count(*) filter (where a.status = 'half_day') as half_day_count,
  count(*) filter (where a.status = 'leave')    as leave_count,
  count(*) as total_marked,
  round(100.0 * count(*) filter (where a.status = 'present') / nullif(count(*), 0), 2) as present_pct
from public.attendance a
join public.classes c on c.id = a.class_id
group by a.class_id, c.name, c.section;
