import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import { HelpCircle } from "lucide-react";
import { MatchPair } from "@/types/learningGames.types";

interface Card {
  cardId: string;
  pairId: string;
  face: string;
  matched: boolean;
}

interface MemoryMatchEngineProps {
  pairs: MatchPair[];
  onFinish: (correct: number, total: number) => void;
}

function shuffle<T>(arr: T[]): T[] {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export function MemoryMatchEngine({ pairs, onFinish }: MemoryMatchEngineProps) {
  const cards = useMemo<Card[]>(() => {
    const built: Card[] = [];
    pairs.forEach((p, i) => {
      built.push({ cardId: `${i}-a`, pairId: p.id, face: p.a, matched: false });
      built.push({ cardId: `${i}-b`, pairId: p.id, face: p.b, matched: false });
    });
    return shuffle(built);
  }, [pairs]);

  const [flipped, setFlipped] = useState<string[]>([]);
  const [matchedPairIds, setMatchedPairIds] = useState<Set<string>>(new Set());
  const [firstTryMatches, setFirstTryMatches] = useState(0);
  const [attemptedPairIds, setAttemptedPairIds] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);

  const totalPairs = pairs.length;

  function handleFlip(card: Card) {
    if (busy || matchedPairIds.has(card.pairId) || flipped.includes(card.cardId)) return;

    const next = [...flipped, card.cardId];
    setFlipped(next);

    if (next.length === 2) {
      setBusy(true);
      const [firstId, secondId] = next;
      const first = cards.find((c) => c.cardId === firstId)!;
      const second = cards.find((c) => c.cardId === secondId)!;
      const isMatch = first.pairId === second.pairId && first.cardId !== second.cardId;

      setTimeout(() => {
        if (isMatch) {
          const wasFirstTry = !attemptedPairIds.has(first.pairId);
          setMatchedPairIds((prev) => {
            const updated = new Set(prev).add(first.pairId);
            if (updated.size === totalPairs) {
              const finalFirstTry = firstTryMatches + (wasFirstTry ? 1 : 0);
              setTimeout(() => onFinish(finalFirstTry, totalPairs), 500);
            }
            return updated;
          });
          if (wasFirstTry) setFirstTryMatches((c) => c + 1);
        } else {
          setAttemptedPairIds((prev) => new Set(prev).add(first.pairId).add(second.pairId));
        }
        setFlipped([]);
        setBusy(false);
      }, 700);
    }
  }

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <div className="flex items-center justify-between text-xs font-medium text-[var(--ink-muted)]">
        <span>Find all {totalPairs} pairs</span>
        <span>{matchedPairIds.size} / {totalPairs} matched</span>
      </div>
      <div className="grid grid-cols-4 gap-3 sm:grid-cols-5">
        {cards.map((card) => {
          const isFlipped = flipped.includes(card.cardId) || matchedPairIds.has(card.pairId);
          return (
            <motion.button
              key={card.cardId}
              type="button"
              onClick={() => handleFlip(card)}
              disabled={matchedPairIds.has(card.pairId)}
              whileTap={{ scale: 0.95 }}
              className={`flex aspect-square items-center justify-center rounded-xl border-2 p-2 text-center text-sm font-bold transition-colors ${
                matchedPairIds.has(card.pairId)
                  ? "border-emerald-400 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                  : isFlipped
                    ? "border-accent-400 bg-accent-500/10 text-[var(--ink-primary)]"
                    : "border-black/[0.08] bg-white text-transparent hover:border-accent-300 dark:border-white/[0.1] dark:bg-white/[0.04]"
              }`}
            >
              {isFlipped ? <span className="leading-tight">{card.face}</span> : <HelpCircle size={20} className="text-[var(--ink-muted)]" />}
            </motion.button>
          );
        })}
      </div>
    </div>
  );
}
