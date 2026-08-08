import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Check, X } from "lucide-react";
import { McqQuestion } from "@/types/learningGames.types";

interface McqGameEngineProps {
  questions: McqQuestion[];
  onFinish: (correct: number, total: number) => void;
}

const OPTION_LABELS = ["A", "B", "C", "D"];

export function McqGameEngine({ questions, onFinish }: McqGameEngineProps) {
  const [index, setIndex] = useState(0);
  const [chosen, setChosen] = useState<number | null>(null);
  const [correctCount, setCorrectCount] = useState(0);

  const total = questions.length;
  const question = questions[index];
  const isLast = index === total - 1;
  const progressPercent = Math.round(((index + 1) / total) * 100);

  function handleSelect(optionIndex: number) {
    if (chosen !== null) return;
    setChosen(optionIndex);
    const isCorrect = optionIndex === question.correctIndex;
    const nextCorrect = correctCount + (isCorrect ? 1 : 0);
    if (isCorrect) setCorrectCount(nextCorrect);

    setTimeout(() => {
      if (isLast) {
        onFinish(nextCorrect, total);
      } else {
        setIndex((i) => i + 1);
        setChosen(null);
      }
    }, 900);
  }

  return (
    <div className="mx-auto max-w-xl space-y-5">
      <div>
        <div className="mb-2 flex items-center justify-between text-xs font-medium text-[var(--ink-muted)]">
          <span>
            Question {index + 1} of {total}
          </span>
          <span>{correctCount} correct</span>
        </div>
        <div className="h-2 w-full overflow-hidden rounded-full bg-black/[0.06] dark:bg-white/[0.08]">
          <motion.div
            className="h-full rounded-full bg-gradient-to-r from-emerald-400 to-accent-500"
            initial={{ width: 0 }}
            animate={{ width: `${progressPercent}%` }}
            transition={{ type: "spring", stiffness: 140, damping: 22 }}
          />
        </div>
      </div>

      <AnimatePresence mode="wait">
        <motion.div
          key={question.id}
          initial={{ opacity: 0, scale: 0.97 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.97 }}
          transition={{ duration: 0.2 }}
          className="rounded-2xl border border-black/[0.06] bg-white p-6 text-center shadow-sm dark:border-white/[0.08] dark:bg-[#17171a]"
        >
          <h3 className="mb-6 text-xl font-bold text-[var(--ink-primary)]">{question.prompt}</h3>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {question.options.map((opt, i) => {
              const isChosen = chosen === i;
              const isCorrectOpt = i === question.correctIndex;
              const showState = chosen !== null;
              return (
                <button
                  key={i}
                  type="button"
                  disabled={chosen !== null}
                  onClick={() => handleSelect(i)}
                  className={`flex items-center justify-center gap-2 rounded-xl border-2 px-4 py-4 text-base font-bold transition-all disabled:cursor-not-allowed ${
                    showState && isCorrectOpt
                      ? "border-emerald-500 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                      : showState && isChosen
                        ? "border-red-500 bg-red-500/10 text-red-600 dark:text-red-400"
                        : "border-black/[0.08] text-[var(--ink-secondary)] hover:border-accent-300 dark:border-white/[0.1]"
                  }`}
                >
                  {showState && isCorrectOpt && <Check size={18} />}
                  {showState && isChosen && !isCorrectOpt && <X size={18} />}
                  {!showState && <span className="text-xs font-semibold text-[var(--ink-muted)]">{OPTION_LABELS[i]}</span>}
                  {opt}
                </button>
              );
            })}
          </div>
          {chosen !== null && (
            <motion.p
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              className={`mt-4 text-sm font-semibold ${chosen === question.correctIndex ? "text-emerald-600 dark:text-emerald-400" : "text-[var(--ink-muted)]"}`}
            >
              {chosen === question.correctIndex ? "🎉 Great Job!" : "Try Again next time!"}
            </motion.p>
          )}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
