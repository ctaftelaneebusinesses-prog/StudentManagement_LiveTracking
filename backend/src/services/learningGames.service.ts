import { supabaseAdmin } from "../config/supabase";
import { ApiError } from "../utils/ApiError";
import { ACHIEVEMENT_DEFS, GAME_CATALOG, GameCategory, GameLevel } from "../config/learningGames";

interface StatsRow {
  user_id: string;
  school_id: string | null;
  games_played: number;
  questions_answered: number;
  correct_answers: number;
  highest_score: number;
  current_streak: number;
  longest_streak: number;
  last_played_date: string | null;
  updated_at: string;
}

function todayISODate(): string {
  return new Date().toISOString().slice(0, 10);
}

function daysBetween(a: string, b: string): number {
  const msPerDay = 24 * 60 * 60 * 1000;
  return Math.round((new Date(b).getTime() - new Date(a).getTime()) / msPerDay);
}

async function upsertStatsAfterAttempt(userId: string, schoolId: string | null, totalQuestions: number, correct: number, score: number): Promise<StatsRow> {
  const { data: existing, error: existingError } = await supabaseAdmin
    .from("learning_game_stats")
    .select("*")
    .eq("user_id", userId)
    .maybeSingle();
  if (existingError) throw ApiError.internal(existingError.message);

  const today = todayISODate();
  let currentStreak = 1;
  if (existing?.last_played_date) {
    const gap = daysBetween(existing.last_played_date, today);
    if (gap === 0) currentStreak = existing.current_streak; // already played today
    else if (gap === 1) currentStreak = existing.current_streak + 1;
    else currentStreak = 1; // streak broken
  }

  const patch = {
    user_id: userId,
    school_id: schoolId,
    games_played: (existing?.games_played ?? 0) + 1,
    questions_answered: (existing?.questions_answered ?? 0) + totalQuestions,
    correct_answers: (existing?.correct_answers ?? 0) + correct,
    highest_score: Math.max(existing?.highest_score ?? 0, score),
    current_streak: currentStreak,
    longest_streak: Math.max(existing?.longest_streak ?? 0, currentStreak),
    last_played_date: today,
  };

  const { data, error } = await supabaseAdmin.from("learning_game_stats").upsert(patch, { onConflict: "user_id" }).select("*").single();
  if (error) throw ApiError.internal(error.message);
  return data as unknown as StatsRow;
}

async function evaluateAchievements(userId: string, stats: StatsRow, thisAttempt: { game_key: string; level: GameLevel; accuracy: number }) {
  const { data: existingAchievements, error: existingError } = await supabaseAdmin
    .from("learning_game_user_achievements")
    .select("achievement_key")
    .eq("user_id", userId);
  if (existingError) throw ApiError.internal(existingError.message);
  const already = new Set((existingAchievements ?? []).map((a) => a.achievement_key as string));

  const { data: attempts, error: attemptsError } = await supabaseAdmin
    .from("learning_game_attempts")
    .select("category, game_key, level, accuracy")
    .eq("user_id", userId);
  if (attemptsError) throw ApiError.internal(attemptsError.message);
  const allAttempts = (attempts ?? []) as unknown as { category: GameCategory; game_key: string; level: GameLevel; accuracy: number }[];

  const countByCategory = (cat: GameCategory) => allAttempts.filter((a) => a.category === cat).length;
  const distinctCategories = new Set(allAttempts.map((a) => a.category)).size;
  const hasTableChampion = allAttempts.some((a) => a.game_key === "multiplication_table" && a.level === "advanced" && a.accuracy >= 90);

  const earned: string[] = [];
  const check = (key: string, condition: boolean) => {
    if (!already.has(key) && condition) earned.push(key);
  };

  check("rising_star", stats.games_played >= 1);
  check("math_explorer", countByCategory("math") >= 5);
  check("puzzle_master", countByCategory("logic") >= 10);
  check("learning_star", countByCategory("general") >= 5);
  check("table_champion", hasTableChampion);
  check("streak_keeper", stats.current_streak >= 3);
  check("perfect_score", thisAttempt.accuracy === 100);
  check("century_club", stats.questions_answered >= 100);
  check("dedicated_learner", stats.games_played >= 25);
  check("grand_master", distinctCategories >= 3);

  if (earned.length === 0) return [];

  const { error } = await supabaseAdmin
    .from("learning_game_user_achievements")
    .insert(earned.map((achievement_key) => ({ user_id: userId, achievement_key })));
  if (error) throw ApiError.internal(error.message);

  return ACHIEVEMENT_DEFS.filter((d) => earned.includes(d.key));
}

export async function submitGameAttempt(
  userId: string,
  schoolId: string | null,
  input: { game_key: string; category: GameCategory; level: GameLevel; total_questions: number; correct_answers: number; duration_seconds?: number }
) {
  const catalogEntry = GAME_CATALOG.find((g) => g.key === input.game_key);
  if (!catalogEntry) throw ApiError.badRequest(`Unknown game: ${input.game_key}`);
  if (input.correct_answers > input.total_questions) throw ApiError.badRequest("correct_answers cannot exceed total_questions");

  const accuracy = input.total_questions > 0 ? Math.round((input.correct_answers / input.total_questions) * 10000) / 100 : 0;
  const score = input.correct_answers * 10;

  const { error } = await supabaseAdmin.from("learning_game_attempts").insert({
    user_id: userId,
    school_id: schoolId,
    game_key: input.game_key,
    category: input.category,
    level: input.level,
    total_questions: input.total_questions,
    correct_answers: input.correct_answers,
    accuracy,
    score,
    duration_seconds: input.duration_seconds,
  });
  if (error) throw ApiError.internal(error.message);

  const stats = await upsertStatsAfterAttempt(userId, schoolId, input.total_questions, input.correct_answers, score);
  const newAchievements = await evaluateAchievements(userId, stats, { game_key: input.game_key, level: input.level, accuracy });

  return { accuracy, score, stats, new_achievements: newAchievements };
}

export async function getProfile(userId: string) {
  const { data: stats, error: statsError } = await supabaseAdmin.from("learning_game_stats").select("*").eq("user_id", userId).maybeSingle();
  if (statsError) throw ApiError.internal(statsError.message);

  const { data: achievements, error: achievementsError } = await supabaseAdmin
    .from("learning_game_user_achievements")
    .select("achievement_key, earned_at")
    .eq("user_id", userId)
    .order("earned_at", { ascending: false });
  if (achievementsError) throw ApiError.internal(achievementsError.message);

  const { data: recentAttempts, error: attemptsError } = await supabaseAdmin
    .from("learning_game_attempts")
    .select("game_key, category, level, total_questions, correct_answers, accuracy, score, played_at")
    .eq("user_id", userId)
    .order("played_at", { ascending: false })
    .limit(10);
  if (attemptsError) throw ApiError.internal(attemptsError.message);

  const achievementDefsByKey = new Map(ACHIEVEMENT_DEFS.map((d) => [d.key, d]));

  return {
    stats: stats ?? {
      user_id: userId,
      games_played: 0,
      questions_answered: 0,
      correct_answers: 0,
      highest_score: 0,
      current_streak: 0,
      longest_streak: 0,
      last_played_date: null,
    },
    achievements: (achievements ?? []).map((a) => ({
      ...achievementDefsByKey.get(a.achievement_key as string),
      key: a.achievement_key,
      earned_at: a.earned_at,
    })),
    recent_attempts: recentAttempts ?? [],
  };
}

export async function getCatalog() {
  return GAME_CATALOG;
}
