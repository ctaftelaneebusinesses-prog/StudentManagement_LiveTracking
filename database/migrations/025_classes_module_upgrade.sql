-- ============================================================================
-- Classes module upgrade: capacity/status on classes, description/status on
-- subjects. Academic year "Active/Inactive" status reuses the existing
-- academic_years.is_current column + idx_academic_years_one_current index —
-- no schema change needed there.
-- ============================================================================

alter table public.classes
  add column capacity int check (capacity is null or capacity > 0),
  add column status text not null default 'active' check (status in ('active', 'inactive'));

alter table public.subjects
  add column description text,
  add column status text not null default 'active' check (status in ('active', 'inactive'));
