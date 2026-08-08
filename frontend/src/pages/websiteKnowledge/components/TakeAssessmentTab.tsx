import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { BadgeCheck, ListChecks, Percent, PlayCircle } from "lucide-react";
import * as wkService from "@/services/websiteKnowledge.service";
import { Attempt } from "@/types/websiteKnowledge.types";
import { Button } from "@/components/ui/Button";
import { Spinner } from "@/components/ui/Spinner";
import { useToast } from "@/components/ui/Toast";
import { QuizPlayer } from "./QuizPlayer";
import { QuizResult } from "./QuizResult";

type Phase = "intro" | "playing" | "result";

export function TakeAssessmentTab({ onCertificateEarned }: { onCertificateEarned: () => void }) {
  const [phase, setPhase] = useState<Phase>("intro");
  const [attempt, setAttempt] = useState<Attempt | null>(null);
  const toast = useToast();
  const queryClient = useQueryClient();

  const settingsQuery = useQuery({ queryKey: ["website-knowledge", "settings"], queryFn: wkService.getSettings });

  const startMutation = useMutation({
    mutationFn: wkService.startAttempt,
    onSuccess: (data) => {
      setAttempt(data);
      setPhase("playing");
    },
    onError: () => toast.error("Could not start the assessment. Please try again."),
  });

  async function handleAnswer(questionId: string, optionKey: string) {
    if (!attempt) return;
    try {
      await wkService.submitAnswer(attempt.id, questionId, optionKey);
    } catch (err) {
      toast.error("Could not save your answer — check your connection.");
      // Rethrow so QuizPlayer unlocks the question instead of advancing past
      // an answer that was never recorded.
      throw err;
    }
  }

  const completeMutation = useMutation({
    mutationFn: () => wkService.completeAttempt(attempt!.id),
    onSuccess: (completed) => {
      setAttempt(completed);
      setPhase("result");
      queryClient.invalidateQueries({ queryKey: ["website-knowledge", "my-attempts"] });
      if (completed.passed) onCertificateEarned();
    },
    onError: () => toast.error("Could not submit your assessment. Please try again."),
  });

  if (settingsQuery.isLoading) {
    return (
      <div className="flex justify-center py-16">
        <Spinner label="Loading assessment..." />
      </div>
    );
  }

  if (phase === "playing" && attempt) {
    return <QuizPlayer attempt={attempt} onAnswer={handleAnswer} onFinish={() => completeMutation.mutate()} />;
  }

  if (phase === "result" && attempt && settingsQuery.data) {
    return (
      <QuizResult
        attempt={attempt}
        settings={settingsQuery.data}
        onRetake={() => {
          setAttempt(null);
          setPhase("intro");
        }}
        onViewCertificate={attempt.passed ? onCertificateEarned : undefined}
      />
    );
  }

  const settings = settingsQuery.data;

  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="mx-auto max-w-xl">
      <div className="rounded-2xl border border-black/[0.06] bg-gradient-to-br from-accent-50 to-white p-8 text-center shadow-sm dark:border-white/[0.08] dark:from-[#1c1a2e] dark:to-[#17171a]">
        <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-accent-500/10 text-accent-600 dark:text-accent-400">
          <BadgeCheck size={32} />
        </div>
        <h2 className="text-xl font-bold text-[var(--ink-primary)]">Website Knowledge Assessment</h2>
        <p className="mx-auto mt-2 max-w-sm text-sm text-[var(--ink-secondary)]">
          Test how well you know your way around the School ERP. This is not an academic exam — it's here to help you get the most out of the
          platform.
        </p>

        <div className="mx-auto mt-6 grid max-w-xs grid-cols-2 gap-4 text-left">
          <div className="rounded-xl border border-black/[0.06] bg-white p-3 dark:border-white/[0.08] dark:bg-white/[0.03]">
            <ListChecks size={16} className="mb-1 text-accent-600 dark:text-accent-400" />
            <div className="text-lg font-bold text-[var(--ink-primary)]">{settings?.question_count ?? 20}</div>
            <div className="text-xs text-[var(--ink-muted)]">Questions</div>
          </div>
          <div className="rounded-xl border border-black/[0.06] bg-white p-3 dark:border-white/[0.08] dark:bg-white/[0.03]">
            <Percent size={16} className="mb-1 text-accent-600 dark:text-accent-400" />
            <div className="text-lg font-bold text-[var(--ink-primary)]">{settings?.passing_percentage ?? 80}%</div>
            <div className="text-xs text-[var(--ink-muted)]">To Pass</div>
          </div>
        </div>

        <Button className="mt-7" isLoading={startMutation.isPending} onClick={() => startMutation.mutate()}>
          <PlayCircle size={18} className="mr-1.5" /> Start Assessment
        </Button>
      </div>
    </motion.div>
  );
}
