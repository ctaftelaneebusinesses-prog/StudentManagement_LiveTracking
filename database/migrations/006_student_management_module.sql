-- ============================================================================
-- Phase 4 — Student Management Module
-- Run AFTER 005_school_admin_module.sql.
--
-- Wires up the Phase 1 students/parents/student_parents tables (previously
-- unused by any application code) and lays down the minimal foundation
-- tables needed for the Student Dashboard: attendance, exams/exam_marks,
-- homework, timetable_periods, notifications, and student_documents.
--
-- These foundation tables intentionally carry only what the Student
-- Management Module needs to read/write a student's own dashboard and
-- profile. Full teacher/admin-facing management UIs for attendance-taking,
-- gradebooks, homework assignment, and timetable building are out of scope
-- here and land with their own dedicated modules later (same "schema now,
-- full module later" approach used for vehicles/drivers in Phase 1).
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. student_documents — files attached to a student's profile (birth
--    certificate, ID proof, transfer certificate, etc). The file bytes live
--    in the private "student-documents" storage bucket (see section 7);
--    this table only tracks metadata, keyed by storage path.
-- ----------------------------------------------------------------------------
create table if not exists public.student_documents (
  id            uuid primary key default gen_random_uuid(),
  school_id     uuid not null references public.schools(id) on delete cascade,
  student_id    uuid not null references public.students(id) on delete cascade,
  doc_type      text not null check (doc_type in
                  ('birth_certificate', 'id_proof', 'transfer_certificate', 'photo', 'medical', 'other')),
  file_name     text not null,
  storage_path  text not null,
  notes         text,
  uploaded_by   uuid references public.users(id) on delete set null,
  uploaded_at   timestamptz not null default now()
);

create index if not exists idx_student_documents_student_id on public.student_documents(student_id);
create index if not exists idx_student_documents_school_id on public.student_documents(school_id);

-- ----------------------------------------------------------------------------
-- 2. attendance — one row per student per day.
-- ----------------------------------------------------------------------------
create table if not exists public.attendance (
  id          uuid primary key default gen_random_uuid(),
  school_id   uuid not null references public.schools(id) on delete cascade,
  student_id  uuid not null references public.students(id) on delete cascade,
  class_id    uuid references public.classes(id) on delete set null,
  date        date not null,
  status      text not null check (status in ('present', 'absent', 'late', 'half_day', 'leave')),
  remarks     text,
  marked_by   uuid references public.users(id) on delete set null,
  created_at  timestamptz not null default now(),
  unique (student_id, date)
);

create index if not exists idx_attendance_school_id on public.attendance(school_id);
create index if not exists idx_attendance_student_id on public.attendance(student_id);
create index if not exists idx_attendance_class_date on public.attendance(class_id, date);

-- ----------------------------------------------------------------------------
-- 3. exams / exam_marks — lightweight gradebook. An exam belongs to one
--    class; marks are recorded per student per subject for that exam.
-- ----------------------------------------------------------------------------
create table if not exists public.exams (
  id                 uuid primary key default gen_random_uuid(),
  school_id          uuid not null references public.schools(id) on delete cascade,
  class_id           uuid not null references public.classes(id) on delete cascade,
  academic_year_id   uuid references public.academic_years(id) on delete set null,
  name               text not null,             -- e.g. "Mid Term", "Final Exam"
  exam_date          date,
  created_at         timestamptz not null default now()
);

create index if not exists idx_exams_school_id on public.exams(school_id);
create index if not exists idx_exams_class_id on public.exams(class_id);

create table if not exists public.exam_marks (
  id              uuid primary key default gen_random_uuid(),
  school_id       uuid not null references public.schools(id) on delete cascade,
  exam_id         uuid not null references public.exams(id) on delete cascade,
  student_id      uuid not null references public.students(id) on delete cascade,
  subject_id      uuid not null references public.subjects(id) on delete cascade,
  marks_obtained  numeric(6, 2) not null check (marks_obtained >= 0),
  max_marks       numeric(6, 2) not null default 100 check (max_marks > 0),
  grade           text,
  remarks         text,
  created_at      timestamptz not null default now(),
  unique (exam_id, student_id, subject_id)
);

create index if not exists idx_exam_marks_school_id on public.exam_marks(school_id);
create index if not exists idx_exam_marks_student_id on public.exam_marks(student_id);
create index if not exists idx_exam_marks_exam_id on public.exam_marks(exam_id);

-- ----------------------------------------------------------------------------
-- 4. homework — assigned per class + subject.
-- ----------------------------------------------------------------------------
create table if not exists public.homework (
  id               uuid primary key default gen_random_uuid(),
  school_id        uuid not null references public.schools(id) on delete cascade,
  class_id         uuid not null references public.classes(id) on delete cascade,
  subject_id       uuid references public.subjects(id) on delete set null,
  teacher_id       uuid references public.users(id) on delete set null,
  title            text not null,
  description      text,
  due_date         date not null,
  attachment_url   text,
  created_at       timestamptz not null default now()
);

create index if not exists idx_homework_school_id on public.homework(school_id);
create index if not exists idx_homework_class_due on public.homework(class_id, due_date);

-- ----------------------------------------------------------------------------
-- 5. timetable_periods — weekly recurring schedule per class.
-- ----------------------------------------------------------------------------
create table if not exists public.timetable_periods (
  id           uuid primary key default gen_random_uuid(),
  school_id    uuid not null references public.schools(id) on delete cascade,
  class_id     uuid not null references public.classes(id) on delete cascade,
  day_of_week  smallint not null check (day_of_week between 0 and 6),  -- 0 = Sunday
  period_no    smallint not null check (period_no > 0),
  subject_id   uuid references public.subjects(id) on delete set null,
  teacher_id   uuid references public.users(id) on delete set null,
  start_time   time not null,
  end_time     time not null,
  created_at   timestamptz not null default now(),
  unique (class_id, day_of_week, period_no),
  check (end_time > start_time)
);

create index if not exists idx_timetable_school_id on public.timetable_periods(school_id);
create index if not exists idx_timetable_class_day on public.timetable_periods(class_id, day_of_week);
create index if not exists idx_timetable_teacher_id on public.timetable_periods(teacher_id);

-- ----------------------------------------------------------------------------
-- 6. notifications / notification_reads — targeted announcements with
--    per-user read tracking. audience_scope pins exactly which of the two
--    target columns is populated (enforced by the check constraint).
-- ----------------------------------------------------------------------------
create table if not exists public.notifications (
  id                 uuid primary key default gen_random_uuid(),
  school_id          uuid not null references public.schools(id) on delete cascade,
  title              text not null,
  message            text not null,
  audience_scope     text not null check (audience_scope in ('school', 'class', 'student')),
  audience_class_id  uuid references public.classes(id) on delete cascade,
  audience_user_id   uuid references public.users(id) on delete cascade,
  created_by         uuid references public.users(id) on delete set null,
  created_at         timestamptz not null default now(),
  check (
    (audience_scope = 'school' and audience_class_id is null and audience_user_id is null) or
    (audience_scope = 'class' and audience_class_id is not null) or
    (audience_scope = 'student' and audience_user_id is not null)
  )
);

create index if not exists idx_notifications_school_id on public.notifications(school_id);
create index if not exists idx_notifications_class_id on public.notifications(audience_class_id);
create index if not exists idx_notifications_user_id on public.notifications(audience_user_id);

create table if not exists public.notification_reads (
  notification_id  uuid not null references public.notifications(id) on delete cascade,
  user_id          uuid not null references public.users(id) on delete cascade,
  read_at          timestamptz not null default now(),
  primary key (notification_id, user_id)
);

-- ----------------------------------------------------------------------------
-- 7. student-documents storage bucket — private (no public URL access);
--    reads happen via short-lived signed URLs generated by the backend.
--    Files are keyed as `{school_id}/{student_id}/{filename}`.
-- ----------------------------------------------------------------------------
insert into storage.buckets (id, name, public)
values ('student-documents', 'student-documents', false)
on conflict (id) do nothing;

drop policy if exists student_documents_select on storage.objects;
create policy student_documents_select on storage.objects
  for select
  using (
    bucket_id = 'student-documents'
    and (
      public.is_staff()
      or (storage.foldername(name))[2] = auth.uid()::text
      or exists (
        select 1 from public.student_parents sp
        where sp.parent_id = auth.uid()
          and sp.student_id::text = (storage.foldername(name))[2]
      )
    )
  );

drop policy if exists student_documents_write_staff on storage.objects;
create policy student_documents_write_staff on storage.objects
  for insert
  with check (
    bucket_id = 'student-documents'
    and public.is_staff()
    and (storage.foldername(name))[1] = public.current_school_id()::text
  );

drop policy if exists student_documents_update_staff on storage.objects;
create policy student_documents_update_staff on storage.objects
  for update
  using (
    bucket_id = 'student-documents'
    and public.is_staff()
    and (storage.foldername(name))[1] = public.current_school_id()::text
  );

drop policy if exists student_documents_delete_staff on storage.objects;
create policy student_documents_delete_staff on storage.objects
  for delete
  using (
    bucket_id = 'student-documents'
    and public.is_staff()
    and (storage.foldername(name))[1] = public.current_school_id()::text
  );

-- ----------------------------------------------------------------------------
-- 8. Permissions for this module.
-- ----------------------------------------------------------------------------
insert into public.permissions (code, description) values
  ('attendance.view',    'View attendance records'),
  ('attendance.manage',  'Mark and update attendance records'),
  ('marks.view',         'View exam and marks records'),
  ('marks.manage',       'Create exams and record marks'),
  ('homework.view',      'View homework assignments'),
  ('homework.manage',    'Create and manage homework assignments'),
  ('timetable.view',     'View class timetables'),
  ('timetable.manage',   'Create and manage class timetables'),
  ('notifications.view', 'View notifications'),
  ('notifications.manage', 'Send notifications')
on conflict (code) do nothing;

-- school_admin: full manage + view on everything in this module.
insert into public.role_permissions (role_id, permission_id)
select (select id from public.roles where name = 'school_admin'), id
from public.permissions
where code in (
  'attendance.view', 'attendance.manage', 'marks.view', 'marks.manage',
  'homework.view', 'homework.manage', 'timetable.view', 'timetable.manage',
  'notifications.view', 'notifications.manage'
)
on conflict do nothing;

-- principal: same as school_admin for this module.
insert into public.role_permissions (role_id, permission_id)
select (select id from public.roles where name = 'principal'), id
from public.permissions
where code in (
  'attendance.view', 'attendance.manage', 'marks.view', 'marks.manage',
  'homework.view', 'homework.manage', 'timetable.view', 'timetable.manage',
  'notifications.view', 'notifications.manage'
)
on conflict do nothing;

-- teacher: can mark attendance, record marks, assign homework, and notify
-- their own classes (enforced at the row level by RLS / class_subjects
-- lookups in the service layer); timetable is admin-built, so view-only.
insert into public.role_permissions (role_id, permission_id)
select (select id from public.roles where name = 'teacher'), id
from public.permissions
where code in (
  'attendance.view', 'attendance.manage', 'marks.view', 'marks.manage',
  'homework.view', 'homework.manage', 'timetable.view',
  'notifications.view', 'notifications.manage'
)
on conflict do nothing;

-- parent / student: read-only self-service.
insert into public.role_permissions (role_id, permission_id)
select r.id, p.id
from public.roles r
cross join public.permissions p
where r.name in ('parent', 'student')
  and p.code in ('attendance.view', 'marks.view', 'homework.view', 'timetable.view', 'notifications.view')
on conflict do nothing;

-- ----------------------------------------------------------------------------
-- 9. RLS
-- ----------------------------------------------------------------------------

-- student_documents
alter table public.student_documents enable row level security;

create policy student_documents_select_staff on public.student_documents
  for select
  using (public.is_staff() and school_id = public.current_school_id());

create policy student_documents_select_self on public.student_documents
  for select
  using (student_id = auth.uid());

create policy student_documents_select_parent on public.student_documents
  for select
  using (
    exists (
      select 1 from public.student_parents sp
      where sp.parent_id = auth.uid() and sp.student_id = student_documents.student_id
    )
  );

create policy student_documents_write_staff on public.student_documents
  for all
  using (public.is_staff() and school_id = public.current_school_id())
  with check (school_id = public.current_school_id());

-- attendance
alter table public.attendance enable row level security;

create policy attendance_select_staff on public.attendance
  for select
  using (public.is_staff() and school_id = public.current_school_id());

create policy attendance_select_self on public.attendance
  for select
  using (student_id = auth.uid());

create policy attendance_select_parent on public.attendance
  for select
  using (
    exists (
      select 1 from public.student_parents sp
      where sp.parent_id = auth.uid() and sp.student_id = attendance.student_id
    )
  );

create policy attendance_select_teacher on public.attendance
  for select
  using (
    public.has_role('teacher')
    and exists (
      select 1 from public.class_subjects cs
      where cs.teacher_id = auth.uid() and cs.class_id = attendance.class_id
    )
  );

create policy attendance_write_staff_or_teacher on public.attendance
  for all
  using (
    (public.is_staff() and school_id = public.current_school_id())
    or (
      public.has_role('teacher')
      and exists (
        select 1 from public.class_subjects cs
        where cs.teacher_id = auth.uid() and cs.class_id = attendance.class_id
      )
    )
  )
  with check (school_id = public.current_school_id());

-- exams
alter table public.exams enable row level security;

create policy exams_select_same_school on public.exams
  for select
  using (school_id = public.current_school_id());

create policy exams_write_staff_or_teacher on public.exams
  for all
  using (
    (public.is_staff() and school_id = public.current_school_id())
    or (
      public.has_role('teacher')
      and exists (
        select 1 from public.class_subjects cs
        where cs.teacher_id = auth.uid() and cs.class_id = exams.class_id
      )
    )
  )
  with check (school_id = public.current_school_id());

-- exam_marks
alter table public.exam_marks enable row level security;

create policy exam_marks_select_staff on public.exam_marks
  for select
  using (public.is_staff() and school_id = public.current_school_id());

create policy exam_marks_select_self on public.exam_marks
  for select
  using (student_id = auth.uid());

create policy exam_marks_select_parent on public.exam_marks
  for select
  using (
    exists (
      select 1 from public.student_parents sp
      where sp.parent_id = auth.uid() and sp.student_id = exam_marks.student_id
    )
  );

create policy exam_marks_select_teacher on public.exam_marks
  for select
  using (
    public.has_role('teacher')
    and exists (
      select 1 from public.class_subjects cs
      join public.exams e on e.class_id = cs.class_id
      where cs.teacher_id = auth.uid()
        and cs.subject_id = exam_marks.subject_id
        and e.id = exam_marks.exam_id
    )
  );

create policy exam_marks_write_staff_or_teacher on public.exam_marks
  for all
  using (
    (public.is_staff() and school_id = public.current_school_id())
    or (
      public.has_role('teacher')
      and exists (
        select 1 from public.class_subjects cs
        join public.exams e on e.class_id = cs.class_id
        where cs.teacher_id = auth.uid()
          and cs.subject_id = exam_marks.subject_id
          and e.id = exam_marks.exam_id
      )
    )
  )
  with check (school_id = public.current_school_id());

-- homework
alter table public.homework enable row level security;

create policy homework_select_staff on public.homework
  for select
  using (public.is_staff() and school_id = public.current_school_id());

create policy homework_select_student on public.homework
  for select
  using (
    exists (
      select 1 from public.students s
      where s.id = auth.uid() and s.class_id = homework.class_id
    )
  );

create policy homework_select_parent on public.homework
  for select
  using (
    exists (
      select 1 from public.student_parents sp
      join public.students s on s.id = sp.student_id
      where sp.parent_id = auth.uid() and s.class_id = homework.class_id
    )
  );

create policy homework_select_teacher on public.homework
  for select
  using (
    public.has_role('teacher')
    and exists (
      select 1 from public.class_subjects cs
      where cs.teacher_id = auth.uid() and cs.class_id = homework.class_id
    )
  );

create policy homework_write_staff_or_teacher on public.homework
  for all
  using (
    (public.is_staff() and school_id = public.current_school_id())
    or (
      public.has_role('teacher')
      and exists (
        select 1 from public.class_subjects cs
        where cs.teacher_id = auth.uid() and cs.class_id = homework.class_id
      )
    )
  )
  with check (school_id = public.current_school_id());

-- timetable_periods
alter table public.timetable_periods enable row level security;

create policy timetable_select_staff on public.timetable_periods
  for select
  using (public.is_staff() and school_id = public.current_school_id());

create policy timetable_select_student on public.timetable_periods
  for select
  using (
    exists (
      select 1 from public.students s
      where s.id = auth.uid() and s.class_id = timetable_periods.class_id
    )
  );

create policy timetable_select_parent on public.timetable_periods
  for select
  using (
    exists (
      select 1 from public.student_parents sp
      join public.students s on s.id = sp.student_id
      where sp.parent_id = auth.uid() and s.class_id = timetable_periods.class_id
    )
  );

create policy timetable_select_teacher on public.timetable_periods
  for select
  using (teacher_id = auth.uid());

create policy timetable_write_staff on public.timetable_periods
  for all
  using (public.is_staff() and school_id = public.current_school_id())
  with check (school_id = public.current_school_id());

-- notifications
alter table public.notifications enable row level security;

create policy notifications_select_staff on public.notifications
  for select
  using (public.is_staff() and school_id = public.current_school_id());

create policy notifications_select_school_wide on public.notifications
  for select
  using (audience_scope = 'school' and school_id = public.current_school_id());

create policy notifications_select_class on public.notifications
  for select
  using (
    audience_scope = 'class'
    and (
      exists (
        select 1 from public.students s
        where s.id = auth.uid() and s.class_id = notifications.audience_class_id
      )
      or exists (
        select 1 from public.student_parents sp
        join public.students s on s.id = sp.student_id
        where sp.parent_id = auth.uid() and s.class_id = notifications.audience_class_id
      )
      or exists (
        select 1 from public.class_subjects cs
        where cs.teacher_id = auth.uid() and cs.class_id = notifications.audience_class_id
      )
    )
  );

create policy notifications_select_direct on public.notifications
  for select
  using (
    audience_scope = 'student'
    and (
      audience_user_id = auth.uid()
      or exists (
        select 1 from public.student_parents sp
        where sp.parent_id = auth.uid() and sp.student_id = notifications.audience_user_id
      )
    )
  );

create policy notifications_write_staff_or_teacher on public.notifications
  for all
  using ((public.is_staff() or public.has_role('teacher')) and school_id = public.current_school_id())
  with check (school_id = public.current_school_id());

-- notification_reads — every authenticated user manages only their own receipts.
alter table public.notification_reads enable row level security;

create policy notification_reads_select_self on public.notification_reads
  for select
  using (user_id = auth.uid());

create policy notification_reads_write_self on public.notification_reads
  for all
  using (user_id = auth.uid())
  with check (user_id = auth.uid());
