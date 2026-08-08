-- ============================================================================
-- Homework approval workflow + marks last-updated tracking
--
-- Adds a Class-Teacher review gate to homework (pending -> approved /
-- needs_changes) so subject-teacher homework no longer publishes straight to
-- students/parents, and adds exam_marks.updated_at so the Class Teacher's
-- Marks Overview can show a meaningful "last updated" per subject.
-- ============================================================================

alter table public.homework add column if not exists status text not null default 'pending'
  check (status in ('pending', 'approved', 'needs_changes'));
alter table public.homework add column if not exists reviewed_by uuid references public.users(id) on delete set null;
alter table public.homework add column if not exists reviewed_at timestamptz;
alter table public.homework add column if not exists review_note text;

-- Pre-existing homework predates this workflow and was already visible to
-- students/parents (the add-column above defaulted every existing row to
-- 'pending') — grandfather it in as approved so nothing disappears.
update public.homework set status = 'approved', reviewed_at = created_at where status = 'pending';

create index if not exists idx_homework_class_status on public.homework(class_id, status);

-- exam_marks: track last-updated for the Marks Overview "Last Updated" column.
-- upsertMarks() will be updated to set this explicitly on every insert/update.
alter table public.exam_marks add column if not exists updated_at timestamptz not null default now();

-- ----------------------------------------------------------------------------
-- RLS: gate student/parent visibility on approval status too (defense in
-- depth — the backend service layer is the primary gate, see homework.service.ts).
-- ----------------------------------------------------------------------------
drop policy if exists homework_select_student on public.homework;
create policy homework_select_student on public.homework
  for select
  using (
    status = 'approved'
    and exists (
      select 1 from public.students s
      where s.id = auth.uid() and s.class_id = homework.class_id
    )
  );

drop policy if exists homework_select_parent on public.homework;
create policy homework_select_parent on public.homework
  for select
  using (
    status = 'approved'
    and exists (
      select 1 from public.student_parents sp
      join public.students s on s.id = sp.student_id
      where sp.parent_id = auth.uid() and s.class_id = homework.class_id
    )
  );
