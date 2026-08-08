-- ============================================================================
-- Migration: 071_website_knowledge_assessment
-- Run AFTER 070_school_request_notification_types.sql.
--
-- "Website Knowledge" — a non-academic quiz that teaches/verifies each role
-- understands how to use the ERP (deliberately NOT the exam module: separate
-- tables, separate UI, never mixed with marks/exams). Rolls up results the
-- management chain: student -> class teacher, teacher -> principal,
-- principal -> school_admin, school_admin -> super_admin (read-only, global).
-- super_admin never takes the assessment itself, per spec.
--
-- Sections:
--   1. website_knowledge_questions        — question bank, one row per role
--   2. website_knowledge_question_sets    — named sets (e.g. "Set 1") per role
--   3. website_knowledge_question_set_items — which questions belong to a set
--   4. website_knowledge_settings         — singleton platform config (super_admin only)
--   5. website_knowledge_attempts         — one row per quiz attempt, with a
--                                            full question+option snapshot so
--                                            editing the bank never rewrites history
--   6. website_knowledge_attempt_answers  — per-question answer within an attempt
--   7. website_knowledge_certificates     — one certificate per (user, role),
--                                            upgraded in place on a higher retake
--   8. website_knowledge_notification_log — idempotency guard, since
--                                            notification.service.ts has none built in
--   9. Permissions (assessment.manage_questions / assessment.manage_settings)
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. website_knowledge_questions
-- ----------------------------------------------------------------------------
create table if not exists public.website_knowledge_questions (
  id             uuid primary key default gen_random_uuid(),
  role_name      text not null check (role_name in ('student', 'teacher', 'principal', 'school_admin', 'accountant', 'driver', 'extracurricular_staff')),
  question_text  text not null,
  options        jsonb not null, -- [{ "key": "a", "text": "..." }, ...]
  correct_option text not null,
  explanation    text,
  category       text,
  is_active      boolean not null default true,
  created_by     uuid references public.users(id) on delete set null,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

create index if not exists idx_wk_questions_role on public.website_knowledge_questions(role_name);

drop trigger if exists trg_wk_questions_updated_at on public.website_knowledge_questions;
create trigger trg_wk_questions_updated_at
  before update on public.website_knowledge_questions
  for each row execute function public.fn_touch_updated_at();

-- ----------------------------------------------------------------------------
-- 2. website_knowledge_question_sets
-- ----------------------------------------------------------------------------
create table if not exists public.website_knowledge_question_sets (
  id          uuid primary key default gen_random_uuid(),
  role_name   text not null check (role_name in ('student', 'teacher', 'principal', 'school_admin', 'accountant', 'driver', 'extracurricular_staff')),
  set_number  int not null check (set_number between 1 and 10),
  name        text not null,
  is_active   boolean not null default true,
  created_at  timestamptz not null default now(),
  unique (role_name, set_number)
);

-- ----------------------------------------------------------------------------
-- 3. website_knowledge_question_set_items
-- ----------------------------------------------------------------------------
create table if not exists public.website_knowledge_question_set_items (
  id           uuid primary key default gen_random_uuid(),
  set_id       uuid not null references public.website_knowledge_question_sets(id) on delete cascade,
  question_id  uuid not null references public.website_knowledge_questions(id) on delete cascade,
  order_index  int not null default 0,
  unique (set_id, question_id)
);

create index if not exists idx_wk_set_items_set on public.website_knowledge_question_set_items(set_id);
create index if not exists idx_wk_set_items_question on public.website_knowledge_question_set_items(question_id);

-- ----------------------------------------------------------------------------
-- 4. website_knowledge_settings — singleton row, platform-wide (not per
--    school.settings — this quiz's config is a single global default, not a
--    per-tenant value, so it does not fit the schools.settings JSONB pattern).
-- ----------------------------------------------------------------------------
create table if not exists public.website_knowledge_settings (
  id                  smallint primary key default 1 check (id = 1),
  question_count      int not null default 20 check (question_count in (20, 30, 50)),
  passing_percentage  int not null default 80 check (passing_percentage in (70, 75, 80, 85, 90)),
  updated_by          uuid references public.users(id) on delete set null,
  updated_at          timestamptz not null default now()
);

insert into public.website_knowledge_settings (id) values (1) on conflict (id) do nothing;

drop trigger if exists trg_wk_settings_updated_at on public.website_knowledge_settings;
create trigger trg_wk_settings_updated_at
  before update on public.website_knowledge_settings
  for each row execute function public.fn_touch_updated_at();

-- ----------------------------------------------------------------------------
-- 5. website_knowledge_attempts
-- ----------------------------------------------------------------------------
create table if not exists public.website_knowledge_attempts (
  id                 uuid primary key default gen_random_uuid(),
  user_id            uuid not null references public.users(id) on delete cascade,
  school_id          uuid references public.schools(id) on delete cascade,
  role_name          text not null check (role_name in ('student', 'teacher', 'principal', 'school_admin', 'accountant', 'driver', 'extracurricular_staff')),
  set_id             uuid references public.website_knowledge_question_sets(id) on delete set null,
  attempt_number     int not null,
  questions_snapshot jsonb not null, -- [{ question_id, question_text, category, options:[{key,text}], correct_option, explanation }]
  total_questions    int not null,
  correct_answers    int not null default 0,
  wrong_answers      int not null default 0,
  percentage         numeric(5, 2),
  passed             boolean,
  status             text not null default 'in_progress' check (status in ('in_progress', 'completed')),
  started_at         timestamptz not null default now(),
  completed_at       timestamptz
);

create index if not exists idx_wk_attempts_user_role on public.website_knowledge_attempts(user_id, role_name);
create index if not exists idx_wk_attempts_school on public.website_knowledge_attempts(school_id);
create unique index if not exists uq_wk_attempts_in_progress on public.website_knowledge_attempts(user_id, role_name) where status = 'in_progress';

-- ----------------------------------------------------------------------------
-- 6. website_knowledge_attempt_answers
-- ----------------------------------------------------------------------------
create table if not exists public.website_knowledge_attempt_answers (
  id            uuid primary key default gen_random_uuid(),
  attempt_id    uuid not null references public.website_knowledge_attempts(id) on delete cascade,
  question_id   uuid not null,
  selected_option text,
  is_correct    boolean,
  answered_at   timestamptz not null default now(),
  unique (attempt_id, question_id)
);

create index if not exists idx_wk_attempt_answers_attempt on public.website_knowledge_attempt_answers(attempt_id);

-- ----------------------------------------------------------------------------
-- 7. website_knowledge_certificates — one per (user, role); a later higher-
--    scoring attempt updates this row in place rather than inserting a new
--    certificate (spec: no duplicate certificates).
-- ----------------------------------------------------------------------------
create table if not exists public.website_knowledge_certificates (
  id                  uuid primary key default gen_random_uuid(),
  certificate_number  text not null unique,
  attempt_id          uuid references public.website_knowledge_attempts(id) on delete set null,
  user_id             uuid not null references public.users(id) on delete cascade,
  school_id           uuid references public.schools(id) on delete cascade,
  role_name           text not null,
  score               int not null,
  percentage          numeric(5, 2) not null,
  issued_at           timestamptz not null default now(),
  unique (user_id, role_name)
);

create index if not exists idx_wk_certificates_school on public.website_knowledge_certificates(school_id);

-- ----------------------------------------------------------------------------
-- 8. website_knowledge_notification_log — "insert first, only notify if the
--    insert wasn't a conflict" idempotency guard for the completion
--    notification that fans out to the next link in the hierarchy.
-- ----------------------------------------------------------------------------
create table if not exists public.website_knowledge_notification_log (
  id                  uuid primary key default gen_random_uuid(),
  attempt_id          uuid not null references public.website_knowledge_attempts(id) on delete cascade,
  recipient_user_id   uuid not null references public.users(id) on delete cascade,
  notified_at         timestamptz not null default now(),
  unique (attempt_id, recipient_user_id)
);

-- ----------------------------------------------------------------------------
-- 9. Permissions — question-bank/settings management stays super_admin-only
--    (mirrors the platform.* seed pattern in 066_super_admin_multi_school.sql).
-- ----------------------------------------------------------------------------
insert into public.permissions (code, description) values
  ('assessment.manage_questions', 'Create, edit, and deactivate Website Knowledge quiz questions and question sets'),
  ('assessment.manage_settings',  'Configure the Website Knowledge quiz''s question count and passing percentage')
on conflict (code) do nothing;

insert into public.role_permissions (role_id, permission_id)
select (select id from public.roles where name = 'super_admin'), id
from public.permissions
where code in ('assessment.manage_questions', 'assessment.manage_settings')
on conflict do nothing;

-- ----------------------------------------------------------------------------
-- RLS. Backend always writes via supabaseAdmin (service role, bypasses RLS);
-- these policies are defense-in-depth for direct-client reads, same
-- philosophy as every other table in this codebase. The fine-grained
-- hierarchy (a principal sees only their school's teachers, not students;
-- a school_admin sees only assigned schools' principals, etc.) is the real
-- enforcement inside websiteKnowledgeMonitoring.service.ts — RLS here grants
-- self-access plus a same-school staff bypass.
-- ----------------------------------------------------------------------------
alter table public.website_knowledge_questions enable row level security;
create policy wk_questions_select on public.website_knowledge_questions
  for select
  using (public.is_super_admin() or public.has_role(role_name));

alter table public.website_knowledge_question_sets enable row level security;
create policy wk_question_sets_select on public.website_knowledge_question_sets
  for select
  using (public.is_super_admin() or public.has_role(role_name));

alter table public.website_knowledge_question_set_items enable row level security;
create policy wk_question_set_items_select on public.website_knowledge_question_set_items
  for select
  using (
    public.is_super_admin()
    or exists (
      select 1 from public.website_knowledge_question_sets s
      where s.id = website_knowledge_question_set_items.set_id
        and public.has_role(s.role_name)
    )
  );

alter table public.website_knowledge_settings enable row level security;
create policy wk_settings_select_all on public.website_knowledge_settings
  for select
  using (auth.role() = 'authenticated');
create policy wk_settings_write_super_admin on public.website_knowledge_settings
  for all
  using (public.is_super_admin())
  with check (public.is_super_admin());

alter table public.website_knowledge_attempts enable row level security;
create policy wk_attempts_select_self on public.website_knowledge_attempts
  for select
  using (user_id = auth.uid());
create policy wk_attempts_select_staff on public.website_knowledge_attempts
  for select
  using (public.is_super_admin() or (public.is_staff() and school_id is not null and public.has_school_access(school_id)));
create policy wk_attempts_select_class_teacher on public.website_knowledge_attempts
  for select
  using (
    role_name = 'student'
    and exists (
      select 1 from public.students st
      join public.classes c on c.id = st.class_id
      where st.id = website_knowledge_attempts.user_id and c.class_teacher_id = auth.uid()
    )
  );

alter table public.website_knowledge_attempt_answers enable row level security;
create policy wk_attempt_answers_select on public.website_knowledge_attempt_answers
  for select
  using (
    exists (
      select 1 from public.website_knowledge_attempts a
      where a.id = website_knowledge_attempt_answers.attempt_id
        and (
          a.user_id = auth.uid()
          or public.is_super_admin()
          or (public.is_staff() and a.school_id is not null and public.has_school_access(a.school_id))
        )
    )
  );

alter table public.website_knowledge_certificates enable row level security;
create policy wk_certificates_select_self on public.website_knowledge_certificates
  for select
  using (user_id = auth.uid());
create policy wk_certificates_select_staff on public.website_knowledge_certificates
  for select
  using (public.is_super_admin() or (public.is_staff() and school_id is not null and public.has_school_access(school_id)));

alter table public.website_knowledge_notification_log enable row level security;
create policy wk_notification_log_select_recipient on public.website_knowledge_notification_log
  for select
  using (recipient_user_id = auth.uid() or public.is_super_admin());
