-- ============================================================================
-- Migration: 055_student_fee_overrides
-- Run AFTER 054_parent_live_location.sql.
--
-- Lets admin/principal/accountant (fees.manage) increase or reduce what one
-- specific student owes on a class-wide fee_structures line, without
-- touching the shared class row (which every other student in the class
-- still pays as-is). When a row exists here for a (student, fee_structure)
-- pair, its override_amount fully replaces that line's net-due amount for
-- that student; app code enforces that fee_structure_id always points at a
-- class-level row (class_id not null), since a per-student ad hoc row
-- (student_id set, from 049) has no "class default" to override.
-- ============================================================================

create table public.student_fee_overrides (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete cascade,
  student_id uuid not null references public.students(id) on delete cascade,
  fee_structure_id uuid not null references public.fee_structures(id) on delete cascade,
  override_amount numeric(10, 2) not null check (override_amount >= 0),
  reason text,
  created_by uuid references public.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (student_id, fee_structure_id)
);

create index student_fee_overrides_student_id_idx on public.student_fee_overrides(student_id);
create index student_fee_overrides_fee_structure_id_idx on public.student_fee_overrides(fee_structure_id);

-- ----------------------------------------------------------------------------
-- RLS — same shape as fee_structures' policies in 016_student_management_extras.sql:
-- staff see everything in their school, a student sees their own overrides,
-- a linked parent sees their child's, staff write.
-- ----------------------------------------------------------------------------
alter table public.student_fee_overrides enable row level security;

create policy student_fee_overrides_select_staff on public.student_fee_overrides
  for select
  using (public.is_staff() and school_id = public.current_school_id());

create policy student_fee_overrides_select_student on public.student_fee_overrides
  for select
  using (student_id = auth.uid());

create policy student_fee_overrides_select_parent on public.student_fee_overrides
  for select
  using (
    exists (
      select 1 from public.student_parents sp
      where sp.parent_id = auth.uid() and sp.student_id = student_fee_overrides.student_id
    )
  );

create policy student_fee_overrides_write_staff on public.student_fee_overrides
  for all
  using (public.is_staff() and school_id = public.current_school_id())
  with check (school_id = public.current_school_id());
