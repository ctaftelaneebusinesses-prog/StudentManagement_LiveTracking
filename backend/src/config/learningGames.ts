/**
 * The Student Learning Games catalog (spec MODULE 3 §24-29). All 17 titles
 * from the spec are served, but implemented as 3 reusable engines rather
 * than 17 bespoke codebases — `engine` says which frontend player component
 * renders a given game. Nothing here is a DB row: no part of the spec asks
 * Super Admin to manage the game catalog (unlike the Website Knowledge
 * question bank, which explicitly does), so this stays a static constant
 * mirrored by frontend/src/data/games/catalog.ts.
 */
export const GAME_CATEGORIES = ["math", "logic", "general"] as const;
export type GameCategory = (typeof GAME_CATEGORIES)[number];

export const GAME_LEVELS = ["beginner", "intermediate", "advanced"] as const;
export type GameLevel = (typeof GAME_LEVELS)[number];

export const GAME_ENGINES = ["mcq", "memory_match", "word_builder"] as const;
export type GameEngine = (typeof GAME_ENGINES)[number];

export const GAME_CATALOG: { key: string; category: GameCategory; engine: GameEngine; title: string }[] = [
  // Mathematics (7)
  { key: "multiplication_table", category: "math", engine: "mcq", title: "Multiplication Tables" },
  { key: "number_puzzles", category: "math", engine: "mcq", title: "Number Puzzles" },
  { key: "addition", category: "math", engine: "mcq", title: "Addition" },
  { key: "subtraction", category: "math", engine: "mcq", title: "Subtraction" },
  { key: "number_sequences", category: "math", engine: "mcq", title: "Number Sequences" },
  { key: "mental_math", category: "math", engine: "mcq", title: "Mental Math" },
  { key: "pattern_recognition", category: "math", engine: "mcq", title: "Pattern Recognition" },
  // Logic (5)
  { key: "matching_puzzles", category: "logic", engine: "memory_match", title: "Matching Puzzles" },
  { key: "memory_cards", category: "logic", engine: "memory_match", title: "Memory Cards" },
  { key: "missing_numbers", category: "logic", engine: "mcq", title: "Missing Numbers" },
  { key: "logical_sequences", category: "logic", engine: "mcq", title: "Logical Sequences" },
  { key: "shape_matching", category: "logic", engine: "memory_match", title: "Shape Matching" },
  // General Learning (5)
  { key: "word_matching", category: "general", engine: "memory_match", title: "Word Matching" },
  { key: "vocabulary", category: "general", engine: "mcq", title: "Vocabulary" },
  { key: "spelling", category: "general", engine: "word_builder", title: "Spelling" },
  { key: "memory_activities", category: "general", engine: "memory_match", title: "Memory Activities" },
  { key: "general_knowledge", category: "general", engine: "mcq", title: "General Knowledge" },
];

export const GAME_KEYS = GAME_CATALOG.map((g) => g.key) as [string, ...string[]];

export interface AchievementDef {
  key: string;
  name: string;
  description: string;
}

/** Evaluated after every attempt in learningGames.service.ts::evaluateAchievements. */
export const ACHIEVEMENT_DEFS: AchievementDef[] = [
  { key: "rising_star", name: "Rising Star", description: "Complete your first learning game" },
  { key: "math_explorer", name: "Math Explorer", description: "Play 5 Mathematics games" },
  { key: "puzzle_master", name: "Puzzle Master", description: "Play 10 Logic games" },
  { key: "learning_star", name: "Learning Star", description: "Play 5 General Learning games" },
  { key: "table_champion", name: "Table Champion", description: "Score 90%+ on Multiplication Tables (Advanced)" },
  { key: "streak_keeper", name: "Streak Keeper", description: "Play games 3 days in a row" },
  { key: "perfect_score", name: "Perfect Score", description: "Get a 100% score in any game" },
  { key: "century_club", name: "Century Club", description: "Answer 100 questions across all games" },
  { key: "dedicated_learner", name: "Dedicated Learner", description: "Play 25 games in total" },
  { key: "grand_master", name: "Grand Master", description: "Play at least one game in every category" },
];
