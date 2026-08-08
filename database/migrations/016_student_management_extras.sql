-- ============================================================================
-- Phase 5 — Student Management extras: Medical Information, Fee Summary,
-- and staff-uploaded student photos.
-- Run AFTER 015_attendance_reporting.sql.
--
-- Adds the structured fields the Student Profile page needs that weren't
-- covered by the original Phase 4 module (006_student_management_module.sql):
--   1. Medical information columns directly on `students`.
--   2. A minimal fee ledger (fee_structures + fee_payments) — just enough to
--      compute a due/paid/balance summary and record payments. No invoicing,
--      receipts, or payment gateway integration; that's a future Fees module.
--   3. A staff-write storage policy on the existing `avatars` bucket so
--      admin/school_admin/principal can upload a student's photo on their
--      behalf (the original policy only allowed self-upload).
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. Medical information — free-text fields, mirroring the level of detail
--    already used elsewhere on the student record (address, occupation, etc).
-- ----------------------------------------------------------------------------
alter table public.students
  add column if not exists blood_group             text,
  add column if not exists allergies                text,
  add column if not exists medical_conditions       text,
  add column if not exists emergency_contact_name   text,
  add column if not exists emergency_contact_phone  text,
  add column if not exists doctor_name              text,
  add column if not exists doctor_phone             text;

-- ----------------------------------------------------------------------------
-- 2. fee_structures — the amount due for a class, for a given term of an
--    academic year. fee_payments records what a specific student has actually
--    paid; it may optionally reference the structure it's paying toward.
-- ----------------------------------------------------------------------------
create table if not exists public.fee_structures (
  id                uuid primary key default gen_random_uuid(),
  school_id         uuid not null references public.schools(id) on delete cascade,
  class_id          uuid not null references public.classes(id) on delete cascade,
  academic_year_id  uuid references public.academic_years(id) on delete set null,
  term              text not null,               -- e.g. "Term 1", "Annual"
  amount            numeric(10, 2) not null check (amount >= 0),
  due_date          date,
  created_at        timestamptz not null default now(),
  unique (class_id, academic_year_id, term)
);

create index if not exists idx_fee_structures_school_id on public.fee_structures(school_id);
create index if not exists idx_fee_structures_class_id on public.fee_structures(class_id);

create table if not exists public.fee_payments (
  id                 uuid primary key default gen_random_uuid(),
  school_id          uuid not null references public.schools(id) on delete cascade,
  student_id         uuid not null references public.students(id) on delete cascade,
  fee_structure_id   uuid references public.fee_structures(id) on delete set null,
  amount             numeric(10, 2) not null check (amount > 0),
  payment_date       date not null default current_date,
  payment_method     text not null default 'cash'
                       check (payment_method in ('cash', 'card', 'bank_transfer', 'online', 'cheque', 'other')),
  reference_no       text,
  notes              text,
  recorded_by        uuid references public.users(id) on delete set null,
  created_at         timestamptz not null default now()
);

create index if not exists idx_fee_payments_school_id on public.fee_payments(school_id);
create index if not exists idx_fee_payments_student_id on public.fee_payments(student_id);

-- ----------------------------------------------------------------------------
-- 3. Permissions for the fee ledger.
-- ----------------------------------------------------------------------------
insert into public.permissions (code, description) values
  ('fees.view',   'View fee structures and payment history'),
  ('fees.manage', 'Define fee structures and record payments')
on conflict (code) do nothing;

insert into public.role_permissions (role_id, permission_id)
select (select id from public.roles where name = 'school_admin'), id
from public.permissions
where code in ('fees.view', 'fees.manage')
on conflict do nothing;

insert into public.role_permissions (role_id, permission_id)
select (select id from public.roles where name = 'principal'), id
from public.permissions
where code in ('fees.view', 'fees.manage')
on conflict do nothing;

-- parent / student: read-only, restricted to their own records by RLS below.
insert into public.role_permissions (role_id, permission_id)
select r.id, p.id
from public.roles r
cross join public.permissions p
where r.name in ('parent', 'student')
  and p.code = 'fees.view'
on conflict do nothing;

-- ----------------------------------------------------------------------------
-- 4. RLS — same shape as the attendance / exam_marks tables in the Phase 4
--    module: staff see everything in their school, a student sees their own
--    fees, and a linked parent sees their child's.
-- ----------------------------------------------------------------------------
alter table public.fee_structures enable row level security;

create policy fee_structures_select_staff on public.fee_structures
  for select
  using (public.is_staff() and school_id = public.current_school_id());

create policy fee_structures_select_student on public.fee_structures
  for select
  using (
    exists (
      select 1 from public.students s
      where s.id = auth.uid() and s.class_id = fee_structures.class_id
    )
  );

create policy fee_structures_select_parent on public.fee_structures
  for select
  using (
    exists (
      select 1 from public.student_parents sp
      join public.students s on s.id = sp.student_id
      where sp.parent_id = auth.uid() and s.class_id = fee_structures.class_id
    )
  );

create policy fee_structures_write_staff on public.fee_structures
  for all
  using (public.is_staff() and school_id = public.current_school_id())
  with check (school_id = public.current_school_id());

alter table public.fee_payments enable row level security;

create policy fee_payments_select_staff on public.fee_payments
  for select
  using (public.is_staff() and school_id = public.current_school_id());

create policy fee_payments_select_self on public.fee_payments
  for select
  using (student_id = auth.uid());

create policy fee_payments_select_parent on public.fee_payments
  for select
  using (
    exists (
      select 1 from public.student_parents sp
      where sp.parent_id = auth.uid() and sp.student_id = fee_payments.student_id
    )
  );

create policy fee_payments_write_staff on public.fee_payments
  for all
  using (public.is_staff() and school_id = public.current_school_id())
  with check (school_id = public.current_school_id());

-- ----------------------------------------------------------------------------
-- 5. avatars bucket — allow staff to upload/update a photo on behalf of any
--    student in their own school (the original 004_avatar_storage.sql
--    policies only permit a user to write their own `{auth.uid()}/...` path).
-- ----------------------------------------------------------------------------
drop policy if exists avatars_write_staff on storage.objects;
create policy avatars_write_staff on storage.objects
  for insert
  with check (
    bucket_id = 'avatars'
    and public.is_staff()
    and exists (
      select 1 from public.users u
      where u.id::text = (storage.foldername(name))[1]
        and u.school_id = public.current_school_id()
    )
  );

drop policy if exists avatars_update_staff on storage.objects;
create policy avatars_update_staff on storage.objects
  for update
  using (
    bucket_id = 'avatars'
    and public.is_staff()
    and exists (
      select 1 from public.users u
      where u.id::text = (storage.foldername(name))[1]
        and u.school_id = public.current_school_id()
    )
  );
