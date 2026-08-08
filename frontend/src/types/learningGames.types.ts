export type GameCategory = "math" | "logic" | "general";
export type GameLevel = "beginner" | "intermediate" | "advanced";
export type GameEngine = "mcq" | "memory_match" | "word_builder";

export interface GameCatalogEntry {
  key: string;
  category: GameCategory;
  engine: GameEngine;
  title: string;
  description: string;
  icon: string;
}

export interface GameStats {
  user_id: string;
  games_played: number;
  questions_answered: number;
  correct_answers: number;
  highest_score: number;
  current_streak: number;
  longest_streak: number;
  last_played_date: string | null;
}

export interface Achievement {
  key: string;
  name: string;
  description: string;
  earned_at: string;
}

export interface RecentGameAttempt {
  game_key: string;
  category: GameCategory;
  level: GameLevel;
  total_questions: number;
  correct_answers: number;
  accuracy: number;
  score: number;
  played_at: string;
}

export interface GameProfile {
  stats: GameStats;
  achievements: Achievement[];
  recent_attempts: RecentGameAttempt[];
}

export interface SubmitAttemptResult {
  accuracy: number;
  score: number;
  stats: GameStats;
  new_achievements: { key: string; name: string; description: string }[];
}

// MCQ engine question shape (generated client-side, never persisted).
export interface McqQuestion {
  id: string;
  prompt: string;
  options: string[];
  correctIndex: number;
}

// Memory-match engine pair shape.
export interface MatchPair {
  id: string;
  a: string;
  b: string;
}
