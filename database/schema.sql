-- ============================================================================
-- Smart School Management System — Core Schema
-- Target: Supabase PostgreSQL
-- Multi-tenant design: every school-owned row carries school_id for isolation.
-- Run in Supabase SQL Editor (or via `supabase db push`) in this order:
--   1. schema.sql
--   2. rls_policies.sql
-- ============================================================================

create extension if not exists "uuid-ossp";
create extension if not exists pgcrypto;

-- ----------------------------------------------------------------------------
-- schools — tenant root. Every other business table scopes to one of these.
-- ----------------------------------------------------------------------------
create table if not exists public.schools (
  id           uuid primary key default gen_random_uuid(),
  name         text not null,
  code         text not null unique,           -- short unique school code, e.g. "GHS001"
  address      text,
  phone        text,
  email        text,
  is_active    boolean not null default true,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

-- ----------------------------------------------------------------------------
-- roles — fixed reference data, not per-tenant. Seeded once, never per-school.
-- ----------------------------------------------------------------------------
create table if not exists public.roles (
  id           smallint primary key,
  name         text not null unique
);

insert into public.roles (id, name) values
  (1, 'admin'),
  (2, 'principal'),
  (3, 'teacher'),
  (4, 'parent'),
  (5, 'student'),
  (6, 'driver')
on conflict (id) do nothing;

-- ----------------------------------------------------------------------------
-- users — 1:1 profile extension of auth.users. id MUST equal auth.users.id.
-- Created via a trigger (see below) when a new auth user signs up, or
-- directly by the backend using the Supabase service role for staff-created
-- accounts (students/parents/teachers/drivers are provisioned by admins).
-- ----------------------------------------------------------------------------
create table if not exists public.users (
  id           uuid primary key references auth.users(id) on delete cascade,
  school_id    uuid references public.schools(id) on delete restrict,
  role_id      smallint not null references public.roles(id),
  full_name    text not null,
  email        text not null,
  phone        text,
  avatar_url   text,
  is_active    boolean not null default true,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create index if not exists idx_users_school_id on public.users(school_id);
create index if not exists idx_users_role_id   on public.users(role_id);
create unique index if not exists idx_users_email on public.users(email);

-- ----------------------------------------------------------------------------
-- classes / subjects — academic structure, scoped per school.
-- ----------------------------------------------------------------------------
create table if not exists public.classes (
  id                uuid primary key default gen_random_uuid(),
  school_id         uuid not null references public.schools(id) on delete cascade,
  name              text not null,              -- e.g. "Grade 8"
  section           text not null,              -- e.g. "A"
  academic_year     text not null,              -- e.g. "2026-2027"
  class_teacher_id  uuid references public.users(id) on delete set null,
  created_at        timestamptz not null default now(),
  unique (school_id, name, section, academic_year)
);

create index if not exists idx_classes_school_id on public.classes(school_id);
create index if not exists idx_classes_teacher_id on public.classes(class_teacher_id);

create table if not exists public.subjects (
  id           uuid primary key default gen_random_uuid(),
  school_id    uuid not null references public.schools(id) on delete cascade,
  name         text not null,
  code         text not null,
  created_at   timestamptz not null default now(),
  unique (school_id, code)
);

create index if not exists idx_subjects_school_id on public.subjects(school_id);

create table if not exists public.class_subjects (
  id           uuid primary key default gen_random_uuid(),
  class_id     uuid not null references public.classes(id) on delete cascade,
  subject_id   uuid not null references public.subjects(id) on delete cascade,
  teacher_id   uuid references public.users(id) on delete set null,
  unique (class_id, subject_id)
);

create index if not exists idx_class_subjects_class_id on public.class_subjects(class_id);
create index if not exists idx_class_subjects_teacher_id on public.class_subjects(teacher_id);

-- ----------------------------------------------------------------------------
-- students / parents / teachers / drivers — role-specific extension tables.
-- Each shares its primary key with public.users(id) (1:1 extension pattern),
-- keeping role-specific fields out of the generic users table.
-- ----------------------------------------------------------------------------
create table if not exists public.students (
  id              uuid primary key references public.users(id) on delete cascade,
  school_id       uuid not null references public.schools(id) on delete cascade,
  class_id        uuid references public.classes(id) on delete set null,
  admission_no    text not null,
  roll_no         text,
  date_of_birth   date,
  gender          text check (gender in ('male', 'female', 'other')),
  address         text,
  admission_date  date not null default current_date,
  unique (school_id, admission_no)
);

create index if not exists idx_students_school_id on public.students(school_id);
create index if not exists idx_students_class_id on public.students(class_id);

create table if not exists public.parents (
  id           uuid primary key references public.users(id) on delete cascade,
  school_id    uuid not null references public.schools(id) on delete cascade,
  occupation   text,
  address      text
);

create index if not exists idx_parents_school_id on public.parents(school_id);

create table if not exists public.student_parents (
  student_id   uuid not null references public.students(id) on delete cascade,
  parent_id    uuid not null references public.parents(id) on delete cascade,
  relation     text not null check (relation in ('father', 'mother', 'guardian')),
  primary key (student_id, parent_id)
);

create index if not exists idx_student_parents_parent_id on public.student_parents(parent_id);

create table if not exists public.teachers (
  id              uuid primary key references public.users(id) on delete cascade,
  school_id       uuid not null references public.schools(id) on delete cascade,
  employee_id     text not null,
  qualification   text,
  joining_date    date not null default current_date,
  unique (school_id, employee_id)
);

create index if not exists idx_teachers_school_id on public.teachers(school_id);

create table if not exists public.drivers (
  id                uuid primary key references public.users(id) on delete cascade,
  school_id         uuid not null references public.schools(id) on delete cascade,
  license_number    text not null,
  license_expiry    date,
  unique (school_id, license_number)
);

create index if not exists idx_drivers_school_id on public.drivers(school_id);

-- ----------------------------------------------------------------------------
-- vehicles — transport assets, scoped per school. Full trip/GPS tables are
-- out of scope for this foundation task and will be added with the
-- transport/GPS module.
-- ----------------------------------------------------------------------------
create table if not exists public.vehicles (
  id               uuid primary key default gen_random_uuid(),
  school_id        uuid not null references public.schools(id) on delete cascade,
  vehicle_number   text not null,
  capacity         int not null check (capacity > 0),
  driver_id        uuid references public.drivers(id) on delete set null,
  is_active        boolean not null default true,
  created_at       timestamptz not null default now(),
  unique (school_id, vehicle_number)
);

create index if not exists idx_vehicles_school_id on public.vehicles(school_id);
create index if not exists idx_vehicles_driver_id on public.vehicles(driver_id);

-- ----------------------------------------------------------------------------
-- updated_at maintenance trigger, applied to tables that track it.
-- ----------------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_schools_updated_at on public.schools;
create trigger trg_schools_updated_at
  before update on public.schools
  for each row execute function public.set_updated_at();

drop trigger if exists trg_users_updated_at on public.users;
create trigger trg_users_updated_at
  before update on public.users
  for each row execute function public.set_updated_at();

-- ----------------------------------------------------------------------------
-- auth.users -> public.users provisioning trigger.
-- Reads role/school/full_name from the signup's raw_user_meta_data, which the
-- backend sets via the Supabase Admin API when it creates the auth user.
-- ----------------------------------------------------------------------------
create or replace function public.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.users (id, school_id, role_id, full_name, email)
  values (
    new.id,
    nullif(new.raw_user_meta_data ->> 'school_id', '')::uuid,
    coalesce((new.raw_user_meta_data ->> 'role_id')::smallint, 5),
    coalesce(new.raw_user_meta_data ->> 'full_name', new.email),
    new.email
  );
  return new;
end;
$$;

drop trigger if exists trg_handle_new_auth_user on auth.users;
create trigger trg_handle_new_auth_user
  after insert on auth.users
  for each row execute function public.handle_new_auth_user();
