import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import { Lightbulb } from "lucide-react";
import { Button } from "@/components/ui/Button";

interface WordBuilderEngineProps {
  words: { word: string; hint: string }[];
  onFinish: (correct: number, total: number) => void;
}

function scramble(word: string): string {
  const letters = word.split("");
  let attempt = letters.slice();
  do {
    for (let i = attempt.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [attempt[i], attempt[j]] = [attempt[j], attempt[i]];
    }
  } while (attempt.join("") === word && word.length > 1);
  return attempt.join("");
}

export function WordBuilderEngine({ words, onFinish }: WordBuilderEngineProps) {
  const [index, setIndex] = useState(0);
  const [input, setInput] = useState("");
  const [feedback, setFeedback] = useState<"correct" | "wrong" | null>(null);
  const [correctCount, setCorrectCount] = useState(0);

  const current = words[index];
  const scrambled = useMemo(() => scramble(current.word), [current]);
  const total = words.length;
  const isLast = index === total - 1;

  function handleSubmit() {
    if (feedback) return;
    const isCorrect = input.trim().toUpperCase() === current.word.toUpperCase();
    const nextCorrect = correctCount + (isCorrect ? 1 : 0);
    if (isCorrect) setCorrectCount(nextCorrect);
    setFeedback(isCorrect ? "correct" : "wrong");

    setTimeout(() => {
      if (isLast) {
        onFinish(nextCorrect, total);
      } else {
        setIndex((i) => i + 1);
        setInput("");
        setFeedback(null);
      }
    }, 1100);
  }

  return (
    <div className="mx-auto max-w-md space-y-5 text-center">
      <div className="text-xs font-medium text-[var(--ink-muted)]">
        Word {index + 1} of {total} · {correctCount} correct
      </div>

      <motion.div
        key={current.word}
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        className="rounded-2xl border border-black/[0.06] bg-white p-6 shadow-sm dark:border-white/[0.08] dark:bg-[#17171a]"
      >
        <div className="mb-4 flex justify-center gap-2">
          {scrambled.split("").map((letter, i) => (
            <span
              key={i}
              className="flex h-11 w-11 items-center justify-center rounded-lg border-2 border-accent-300 bg-accent-500/10 text-lg font-extrabold text-accent-700 dark:border-accent-700 dark:text-accent-300"
            >
              {letter}
            </span>
          ))}
        </div>

        <div className="mb-4 flex items-center justify-center gap-1.5 text-xs text-[var(--ink-muted)]">
          <Lightbulb size={14} /> {current.hint}
        </div>

        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
          disabled={!!feedback}
          placeholder="Type the word..."
          className="w-full rounded-lg border border-black/[0.1] bg-white px-4 py-2.5 text-center text-base font-semibold uppercase tracking-wide text-[var(--ink-primary)] outline-none focus:border-accent-500 focus:ring-1 focus:ring-accent-500 dark:border-white/[0.15] dark:bg-white/[0.05]"
          autoFocus
        />

        {feedback && (
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className={`mt-3 text-sm font-semibold ${feedback === "correct" ? "text-emerald-600 dark:text-emerald-400" : "text-[var(--ink-muted)]"}`}
          >
            {feedback === "correct" ? "🎉 Great Job!" : `Try Again! It was "${current.word}"`}
          </motion.p>
        )}

        {!feedback && (
          <Button className="mt-4" onClick={handleSubmit} disabled={!input.trim()}>
            Submit
          </Button>
        )}
      </motion.div>
    </div>
  );
}
