import { useEffect } from "react";
import { motion } from "framer-motion";
import { Star, Trophy, RotateCcw, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { SubmitAttemptResult } from "@/types/learningGames.types";

interface GameResultCelebrationProps {
  result: SubmitAttemptResult;
  gameTitle: string;
  onPlayAgain: () => void;
  onExit: () => void;
}

export function GameResultCelebration({ result, gameTitle, onPlayAgain, onExit }: GameResultCelebrationProps) {
  const starCount = result.accuracy >= 90 ? 3 : result.accuracy >= 60 ? 2 : result.accuracy > 0 ? 1 : 0;

  useEffect(() => {
    if (result.accuracy < 60) return;
    let cancelled = false;
    import("canvas-confetti").then(({ default: confetti }) => {
      if (cancelled) return;
      confetti({ particleCount: 90, spread: 80, origin: { y: 0.5 }, colors: ["#635bff", "#f59e0b", "#22c55e", "#ec4899"] });
    });
    return () => {
      cancelled = true;
    };
  }, [result.accuracy]);

  return (
    <div className="mx-auto max-w-sm space-y-6 text-center">
      <motion.div initial={{ scale: 0.6, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ type: "spring", stiffness: 220, damping: 14 }}>
        <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-gradient-to-br from-amber-300 to-amber-500">
          <Trophy size={38} className="text-white" />
        </div>
        <div className="mt-3 flex justify-center gap-1">
          {[0, 1, 2].map((i) => (
            <motion.span
              key={i}
              initial={{ scale: 0, rotate: -30 }}
              animate={{ scale: 1, rotate: 0 }}
              transition={{ delay: 0.15 * i, type: "spring", stiffness: 260 }}
            >
              <Star size={22} className={i < starCount ? "fill-amber-400 text-amber-400" : "text-black/[0.12] dark:text-white/[0.15]"} />
            </motion.span>
          ))}
        </div>
      </motion.div>

      <div>
        <h2 className="text-xl font-bold text-[var(--ink-primary)]">{gameTitle} Complete!</h2>
        <p className="mt-1 text-sm text-[var(--ink-secondary)]">
          You scored <span className="font-semibold text-[var(--ink-primary)]">{result.accuracy}%</span>
        </p>
      </div>

      {result.new_achievements.length > 0 && (
        <div className="space-y-2 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-left dark:border-amber-900/40 dark:bg-amber-950/20">
          <div className="text-xs font-bold uppercase tracking-wide text-amber-600 dark:text-amber-400">New Achievement{result.new_achievements.length > 1 ? "s" : ""}!</div>
          {result.new_achievements.map((a) => (
            <div key={a.key} className="flex items-center gap-2 text-sm">
              <Star size={14} className="fill-amber-400 text-amber-400" />
              <span className="font-semibold text-[var(--ink-primary)]">{a.name}</span>
              <span className="text-xs text-[var(--ink-muted)]">— {a.description}</span>
            </div>
          ))}
        </div>
      )}

      <div className="flex justify-center gap-3">
        <Button onClick={onPlayAgain}>
          <RotateCcw size={16} className="mr-1.5" /> Play Again
        </Button>
        <Button variant="secondary" onClick={onExit}>
          <ArrowLeft size={16} className="mr-1.5" /> Back to Games
        </Button>
      </div>
    </div>
  );
}
