import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Check } from "lucide-react";
import { Attempt } from "@/types/websiteKnowledge.types";

interface QuizPlayerProps {
  attempt: Attempt;
  onAnswer: (questionId: string, optionKey: string) => Promise<void>;
  onFinish: () => void;
}

const OPTION_LABELS = ["A", "B", "C", "D"];

export function QuizPlayer({ attempt, onAnswer, onFinish }: QuizPlayerProps) {
  const [index, setIndex] = useState(0);
  const [selected, setSelected] = useState<string | null>(null);
  const [locked, setLocked] = useState(false);

  const questions = attempt.questions_snapshot;
  const total = questions.length;
  const question = questions[index];
  const isLast = index === total - 1;
  const progressPercent = Math.round(((index + 1) / total) * 100);

  // `locked` stays true across BOTH the save and the 450ms advance animation.
  // Clearing it as soon as the save resolved re-enabled the options during the
  // animation, so a second click could re-answer the question — and on the
  // last one, fire a second onFinish() that the API rejects with "already
  // completed".
  async function handleSelect(optionKey: string) {
    if (locked) return;
    setSelected(optionKey);
    setLocked(true);
    try {
      await onAnswer(question.question_id, optionKey);
    } catch {
      // onAnswer surfaces its own error toast; let the user retry this question.
      setSelected(null);
      setLocked(false);
      return;
    }
    setTimeout(() => {
      if (isLast) {
        onFinish();
      } else {
        setIndex((i) => i + 1);
        setSelected(null);
        setLocked(false);
      }
    }, 450);
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <div className="mb-2 flex items-center justify-between text-sm font-medium text-[var(--ink-secondary)]">
          <span>
            Question {index + 1} of {total}
          </span>
          <span>{progressPercent}%</span>
        </div>
        <div className="h-2.5 w-full overflow-hidden rounded-full bg-black/[0.06] dark:bg-white/[0.08]">
          <motion.div
            className="h-full rounded-full bg-gradient-to-r from-accent-500 to-accent-600"
            initial={{ width: 0 }}
            animate={{ width: `${progressPercent}%` }}
            transition={{ type: "spring", stiffness: 120, damping: 20 }}
          />
        </div>
      </div>

      <AnimatePresence mode="wait">
        <motion.div
          key={question.question_id}
          initial={{ opacity: 0, x: 24 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -24 }}
          transition={{ duration: 0.25 }}
          className="rounded-2xl border border-black/[0.06] bg-white p-6 shadow-sm dark:border-white/[0.08] dark:bg-[#17171a]"
        >
          {/* The question's category is deliberately not shown while answering —
              it names the ERP section the question is asking you to identify,
              which is the correct option verbatim. The backend withholds it
              from in-progress attempts for the same reason; it reappears in
              the completed-attempt review. */}
          <h3 className="mb-5 text-lg font-semibold text-[var(--ink-primary)]">{question.question_text}</h3>

          <div className="space-y-3">
            {question.options.map((option, i) => {
              const isSelected = selected === option.key;
              return (
                <button
                  key={option.key}
                  type="button"
                  disabled={locked}
                  onClick={() => handleSelect(option.key)}
                  className={`flex w-full items-center gap-3 rounded-xl border px-4 py-3.5 text-left text-sm font-medium transition-all disabled:cursor-not-allowed ${
                    isSelected
                      ? "border-accent-500 bg-accent-500/10 text-accent-700 dark:text-accent-300"
                      : "border-black/[0.08] text-[var(--ink-secondary)] hover:border-accent-300 hover:bg-black/[0.02] dark:border-white/[0.1] dark:hover:bg-white/[0.04]"
                  }`}
                >
                  <span
                    className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full border text-xs font-bold ${
                      isSelected ? "border-accent-500 bg-accent-500 text-white" : "border-black/[0.15] text-[var(--ink-muted)] dark:border-white/20"
                    }`}
                  >
                    {isSelected ? <Check size={14} /> : OPTION_LABELS[i]}
                  </span>
                  {option.text}
                </button>
              );
            })}
          </div>
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
