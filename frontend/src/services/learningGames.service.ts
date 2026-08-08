import { api } from "@/lib/axios";
import { GameCategory, GameLevel, GameProfile, SubmitAttemptResult } from "@/types/learningGames.types";

export async function submitGameAttempt(input: {
  game_key: string;
  category: GameCategory;
  level: GameLevel;
  total_questions: number;
  correct_answers: number;
  duration_seconds?: number;
}): Promise<SubmitAttemptResult> {
  const { data } = await api.post("/learning-games/attempts", input);
  return data.data;
}

export async function getProfile(): Promise<GameProfile> {
  const { data } = await api.get("/learning-games/profile");
  return data.data;
}
