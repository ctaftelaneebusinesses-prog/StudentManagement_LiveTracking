import { useMemo, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { X } from "lucide-react";
import * as learningGamesService from "@/services/learningGames.service";
import { GameCatalogEntry, GameLevel, SubmitAttemptResult } from "@/types/learningGames.types";
import { generateMatchPairs, generateMcqQuestions } from "@/data/games/generators";
import { SPELLING_WORDS } from "@/data/games/content";
import { McqGameEngine } from "./McqGameEngine";
import { MemoryMatchEngine } from "./MemoryMatchEngine";
import { WordBuilderEngine } from "./WordBuilderEngine";
import { GameResultCelebration } from "./GameResultCelebration";
import { Spinner } from "@/components/ui/Spinner";
import { CATEGORY_LABELS } from "@/data/games/catalog";

const QUESTION_COUNT: Record<GameLevel, number> = { beginner: 8, intermediate: 10, advanced: 12 };

interface GamePlayerModalProps {
  game: GameCatalogEntry;
  level: GameLevel;
  onClose: () => void;
  onEarnedAchievements: (count: number) => void;
}

function useGameContent(game: GameCatalogEntry, level: GameLevel, sessionKey: number) {
  return useMemo(() => {
    if (game.engine === "mcq") return { mcq: generateMcqQuestions(game.key, level, QUESTION_COUNT[level]) };
    if (game.engine === "memory_match") return { pairs: generateMatchPairs(game.key, level, QUESTION_COUNT[level]) };
    return { words: [...SPELLING_WORDS].sort(() => Math.random() - 0.5).slice(0, Math.min(6, SPELLING_WORDS.length)) };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [game.key, game.engine, level, sessionKey]);
}

export function GamePlayerModal({ game, level, onClose, onEarnedAchievements }: GamePlayerModalProps) {
  const [sessionKey, setSessionKey] = useState(0);
  const [result, setResult] = useState<SubmitAttemptResult | null>(null);
  const content = useGameContent(game, level, sessionKey);
  const startedAt = useMemo(() => Date.now(), [sessionKey]);

  const submitMutation = useMutation({
    mutationFn: (vars: { correct: number; total: number }) =>
      learningGamesService.submitGameAttempt({
        game_key: game.key,
        category: game.category,
        level,
        total_questions: vars.total,
        correct_answers: vars.correct,
        duration_seconds: Math.round((Date.now() - startedAt) / 1000),
      }),
    onSuccess: (data) => {
      setResult(data);
      if (data.new_achievements.length > 0) onEarnedAchievements(data.new_achievements.length);
    },
  });

  function handleFinish(correct: number, total: number) {
    submitMutation.mutate({ correct, total });
  }

  function handlePlayAgain() {
    setResult(null);
    setSessionKey((k) => k + 1);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" role="dialog" aria-modal="true">
      <div className="relative max-h-[92vh] w-full max-w-3xl overflow-y-auto rounded-3xl bg-[var(--page-plane,#f7f7fb)] p-6 shadow-2xl dark:bg-[#101012] sm:p-10">
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="absolute right-4 top-4 rounded-full p-2 text-[var(--ink-muted)] hover:bg-black/[0.06] dark:hover:bg-white/[0.08]"
        >
          <X size={18} />
        </button>

        <div className="mb-6 text-center">
          <span className="inline-block rounded-full bg-accent-500/10 px-3 py-1 text-xs font-semibold text-accent-600 dark:text-accent-400">
            {CATEGORY_LABELS[game.category]}
          </span>
          <h2 className="mt-2 text-xl font-bold text-[var(--ink-primary)]">{game.title}</h2>
        </div>

        {submitMutation.isPending && (
          <div className="flex justify-center py-16">
            <Spinner label="Saving your score..." />
          </div>
        )}

        {!submitMutation.isPending && result && (
          <GameResultCelebration result={result} gameTitle={game.title} onPlayAgain={handlePlayAgain} onExit={onClose} />
        )}

        {!submitMutation.isPending && !result && content.mcq && <McqGameEngine questions={content.mcq} onFinish={handleFinish} />}
        {!submitMutation.isPending && !result && content.pairs && <MemoryMatchEngine pairs={content.pairs} onFinish={handleFinish} />}
        {!submitMutation.isPending && !result && content.words && <WordBuilderEngine words={content.words} onFinish={handleFinish} />}
      </div>
    </div>
  );
}
