import { z } from "zod";
import { GAME_KEYS, GAME_CATEGORIES, GAME_LEVELS } from "../config/learningGames";

const empty = z.object({}).optional();

export const submitAttemptSchema = z.object({
  body: z.object({
    game_key: z.enum(GAME_KEYS),
    category: z.enum(GAME_CATEGORIES),
    level: z.enum(GAME_LEVELS),
    total_questions: z.number().int().min(1).max(100),
    correct_answers: z.number().int().min(0),
    duration_seconds: z.number().int().min(0).optional(),
  }),
  query: empty,
  params: empty,
});
