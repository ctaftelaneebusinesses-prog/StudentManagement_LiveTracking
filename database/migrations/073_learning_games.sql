-- ============================================================================
-- Migration: 073_learning_games
-- Run AFTER 072_website_knowledge_question_seed.sql.
--
-- Student "Learning Games" area (Mathematics/Logic/General Learning). The
-- 17-title catalog from the spec is served as static frontend/backend
-- constants — not DB rows — since nothing in the spec asks Super Admin to
-- manage the game catalog (unlike the Website Knowledge question bank, which
-- explicitly does). Content for procedural games (arithmetic, patterns,
-- shapes) is generated client-side; content for the few curated games
-- (vocabulary, spelling, word matching, general knowledge) lives in static
-- frontend data files. Only what genuinely needs persistence is a table here:
-- attempts, aggregate stats, and earned achievements.
-- ============================================================================

create table if not exists public.learning_game_attempts (
  id               uuid primary key default gen_random_uuid(),
  user_id          uuid not null references public.users(id) on delete cascade,
  school_id        uuid references public.schools(id) on delete cascade,
  game_key         text not null,
  category         text not null check (category in ('math', 'logic', 'general')),
  level            text not null check (level in ('beginner', 'intermediate', 'advanced')),
  total_questions  int not null,
  correct_answers  int not null,
  accuracy         numeric(5, 2) not null,
  score            int not null,
  duration_seconds int,
  played_at        timestamptz not null default now()
);

create index if not exists idx_learning_game_attempts_user on public.learning_game_attempts(user_id);
create index if not exists idx_learning_game_attempts_school on public.learning_game_attempts(school_id);

create table if not exists public.learning_game_stats (
  user_id          uuid primary key references public.users(id) on delete cascade,
  school_id        uuid references public.schools(id) on delete cascade,
  games_played     int not null default 0,
  questions_answered int not null default 0,
  correct_answers  int not null default 0,
  highest_score    int not null default 0,
  current_streak   int not null default 0,
  longest_streak   int not null default 0,
  last_played_date date,
  updated_at       timestamptz not null default now()
);

drop trigger if exists trg_learning_game_stats_updated_at on public.learning_game_stats;
create trigger trg_learning_game_stats_updated_at
  before update on public.learning_game_stats
  for each row execute function public.fn_touch_updated_at();

create table if not exists public.learning_game_user_achievements (
  id               uuid primary key default gen_random_uuid(),
  user_id          uuid not null references public.users(id) on delete cascade,
  achievement_key  text not null,
  earned_at        timestamptz not null default now(),
  unique (user_id, achievement_key)
);

create index if not exists idx_learning_game_achievements_user on public.learning_game_user_achievements(user_id);

-- ----------------------------------------------------------------------------
-- RLS — self-access plus same-school staff/class-teacher read, same
-- defense-in-depth philosophy as 071_website_knowledge_assessment.sql (real
-- writes/reads for the app go through supabaseAdmin in learningGames.service.ts).
-- ----------------------------------------------------------------------------
alter table public.learning_game_attempts enable row level security;
create policy learning_game_attempts_select_self on public.learning_game_attempts
  for select
  using (user_id = auth.uid());
create policy learning_game_attempts_select_staff on public.learning_game_attempts
  for select
  using (public.is_super_admin() or (public.is_staff() and school_id is not null and public.has_school_access(school_id)));
create policy learning_game_attempts_select_class_teacher on public.learning_game_attempts
  for select
  using (
    exists (
      select 1 from public.students st
      join public.classes c on c.id = st.class_id
      where st.id = learning_game_attempts.user_id and c.class_teacher_id = auth.uid()
    )
  );

alter table public.learning_game_stats enable row level security;
create policy learning_game_stats_select_self on public.learning_game_stats
  for select
  using (user_id = auth.uid());
create policy learning_game_stats_select_staff on public.learning_game_stats
  for select
  using (public.is_super_admin() or (public.is_staff() and school_id is not null and public.has_school_access(school_id)));
create policy learning_game_stats_select_class_teacher on public.learning_game_stats
  for select
  using (
    exists (
      select 1 from public.students st
      join public.classes c on c.id = st.class_id
      where st.id = learning_game_stats.user_id and c.class_teacher_id = auth.uid()
    )
  );

alter table public.learning_game_user_achievements enable row level security;
create policy learning_game_achievements_select_self on public.learning_game_user_achievements
  for select
  using (user_id = auth.uid());
create policy learning_game_achievements_select_staff on public.learning_game_user_achievements
  for select
  using (
    public.is_super_admin()
    or exists (
      select 1 from public.students st
      join public.classes c on c.id = st.class_id
      where st.id = learning_game_user_achievements.user_id and c.class_teacher_id = auth.uid()
    )
  );
