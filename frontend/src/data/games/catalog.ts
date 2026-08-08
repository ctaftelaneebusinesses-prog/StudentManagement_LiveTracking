import { GameCatalogEntry } from "@/types/learningGames.types";

/**
 * Mirrors backend/src/config/learningGames.ts's GAME_CATALOG (key/category/
 * engine must match exactly — the backend validates attempts against its own
 * copy). Description/icon are presentation-only and live here since the
 * backend never needs them.
 */
export const GAME_CATALOG: GameCatalogEntry[] = [
  // Mathematics
  { key: "multiplication_table", category: "math", engine: "mcq", title: "Multiplication Tables", description: "Race through times tables", icon: "X" },
  { key: "number_puzzles", category: "math", engine: "mcq", title: "Number Puzzles", description: "Find the missing number", icon: "Puzzle" },
  { key: "addition", category: "math", engine: "mcq", title: "Addition", description: "Add numbers quickly", icon: "Plus" },
  { key: "subtraction", category: "math", engine: "mcq", title: "Subtraction", description: "Subtract with confidence", icon: "Minus" },
  { key: "number_sequences", category: "math", engine: "mcq", title: "Number Sequences", description: "What comes next?", icon: "ListOrdered" },
  { key: "mental_math", category: "math", engine: "mcq", title: "Mental Math", description: "Quick mixed arithmetic", icon: "Brain" },
  { key: "pattern_recognition", category: "math", engine: "mcq", title: "Pattern Recognition", description: "Spot the pattern", icon: "Shapes" },
  // Logic
  { key: "matching_puzzles", category: "logic", engine: "memory_match", title: "Matching Puzzles", description: "Match related pairs", icon: "Puzzle" },
  { key: "memory_cards", category: "logic", engine: "memory_match", title: "Memory Cards", description: "Flip and find pairs", icon: "LayoutGrid" },
  { key: "missing_numbers", category: "logic", engine: "mcq", title: "Missing Numbers", description: "Complete the equation", icon: "HelpCircle" },
  { key: "logical_sequences", category: "logic", engine: "mcq", title: "Logical Sequences", description: "Follow the logic", icon: "GitBranch" },
  { key: "shape_matching", category: "logic", engine: "memory_match", title: "Shape Matching", description: "Match shapes to shapes", icon: "Triangle" },
  // General Learning
  { key: "word_matching", category: "general", engine: "memory_match", title: "Word Matching", description: "Match words to meanings", icon: "BookOpenCheck" },
  { key: "vocabulary", category: "general", engine: "mcq", title: "Vocabulary", description: "Grow your word power", icon: "SpellCheck" },
  { key: "spelling", category: "general", engine: "word_builder", title: "Spelling", description: "Unscramble the word", icon: "CaseSensitive" },
  { key: "memory_activities", category: "general", engine: "memory_match", title: "Memory Activities", description: "Sharpen your memory", icon: "Sparkles" },
  { key: "general_knowledge", category: "general", engine: "mcq", title: "General Knowledge", description: "Test what you know", icon: "Globe2" },
];

export const CATEGORY_LABELS: Record<string, string> = {
  math: "Mathematics",
  logic: "Logic",
  general: "General Learning",
};

export const LEVEL_LABELS: Record<string, string> = {
  beginner: "Beginner",
  intermediate: "Intermediate",
  advanced: "Advanced",
};
