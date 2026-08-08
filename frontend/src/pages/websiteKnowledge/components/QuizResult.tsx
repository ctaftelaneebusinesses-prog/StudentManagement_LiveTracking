import { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import { Trophy, RotateCcw, Award, Sparkles } from "lucide-react";
import { Attempt, AssessmentSettings } from "@/types/websiteKnowledge.types";
import { Button } from "@/components/ui/Button";

interface QuizResultProps {
  attempt: Attempt;
  settings: AssessmentSettings;
  onRetake: () => void;
  onViewCertificate?: () => void;
}

function useCountUp(target: number, durationMs = 900) {
  const [value, setValue] = useState(0);
  const startRef = useRef<number | null>(null);

  useEffect(() => {
    let frame: number;
    function tick(now: number) {
      if (startRef.current === null) startRef.current = now;
      const progress = Math.min(1, (now - startRef.current) / durationMs);
      setValue(Math.round(target * (1 - Math.pow(1 - progress, 3))));
      if (progress < 1) frame = requestAnimationFrame(tick);
    }
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [target, durationMs]);

  return value;
}

export function QuizResult({ attempt, settings, onRetake, onViewCertificate }: QuizResultProps) {
  const percentage = attempt.percentage ?? 0;
  const passed = attempt.passed ?? false;
  const animatedPercent = useCountUp(percentage);

  useEffect(() => {
    if (!passed) return;
    let cancelled = false;
    import("canvas-confetti").then(({ default: confetti }) => {
      if (cancelled) return;
      const duration = 2000;
      const end = Date.now() + duration;
      (function frame() {
        confetti({ particleCount: 4, angle: 60, spread: 60, origin: { x: 0 }, colors: ["#635bff", "#22c55e", "#f59e0b", "#ec4899"] });
        confetti({ particleCount: 4, angle: 120, spread: 60, origin: { x: 1 }, colors: ["#635bff", "#22c55e", "#f59e0b", "#ec4899"] });
        if (Date.now() < end && !cancelled) requestAnimationFrame(frame);
      })();
      confetti({ particleCount: 120, spread: 90, origin: { y: 0.4 }, colors: ["#635bff", "#22c55e", "#f59e0b"] });
    });
    return () => {
      cancelled = true;
    };
  }, [passed]);

  return (
    <div className="mx-auto max-w-lg space-y-6 text-center">
      <motion.div
        initial={{ scale: 0.6, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ type: "spring", stiffness: 200, damping: 14 }}
        className={`mx-auto flex h-24 w-24 items-center justify-center rounded-full ${
          passed ? "bg-gradient-to-br from-amber-300 to-amber-500" : "bg-black/[0.06] dark:bg-white/[0.08]"
        }`}
      >
        {passed ? <Trophy size={44} className="text-white" /> : <Sparkles size={40} className="text-[var(--ink-muted)]" />}
      </motion.div>

      <div>
        <h2 className="text-2xl font-bold text-[var(--ink-primary)]">{passed ? "🎉 Congratulations!" : "Almost There!"}</h2>
        <p className="mt-1 text-sm text-[var(--ink-secondary)]">
          {passed
            ? "Amazing work! You successfully explored the School ERP. You are now ready to use the platform!"
            : `You need ${settings.passing_percentage}% to pass. Try again and improve your score!`}
        </p>
      </div>

      <div className="rounded-2xl border border-black/[0.06] bg-white p-8 shadow-sm dark:border-white/[0.08] dark:bg-[#17171a]">
        <div className="text-5xl font-extrabold tabular-nums text-[var(--ink-primary)]">{animatedPercent}%</div>
        <div className="mt-1 text-sm font-medium text-[var(--ink-muted)]">
          {attempt.correct_answers} / {attempt.total_questions} correct
        </div>
        <div className={`mx-auto mt-4 inline-flex items-center gap-1.5 rounded-full px-4 py-1.5 text-sm font-bold ${passed ? "bg-[var(--status-good)]/10 text-[var(--status-good)]" : "bg-[var(--status-serious)]/10 text-[var(--status-serious)]"}`}>
          {passed ? "PASSED" : "NOT YET PASSED"}
        </div>
        <div className="mt-4 grid grid-cols-3 gap-2 border-t border-black/[0.06] pt-4 text-left dark:border-white/[0.08] sm:gap-3">
          <div>
            <div className="text-xs text-[var(--ink-muted)]">Attempt</div>
            <div className="font-semibold text-[var(--ink-primary)]">#{attempt.attempt_number}</div>
          </div>
          <div>
            <div className="text-xs text-[var(--ink-muted)]">Wrong</div>
            <div className="font-semibold text-[var(--ink-primary)]">{attempt.wrong_answers}</div>
          </div>
          <div>
            <div className="text-xs text-[var(--ink-muted)]">Passing Score</div>
            <div className="font-semibold text-[var(--ink-primary)]">{settings.passing_percentage}%</div>
          </div>
        </div>
      </div>

      <div className="flex justify-center gap-3">
        {passed && onViewCertificate && (
          <Button onClick={onViewCertificate}>
            <Award size={16} className="mr-1.5" /> View Certificate
          </Button>
        )}
        <Button variant={passed ? "secondary" : "primary"} onClick={onRetake}>
          <RotateCcw size={16} className="mr-1.5" /> Retake Assessment
        </Button>
      </div>
    </div>
  );
}
