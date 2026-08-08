import { Users, CheckCircle2, XCircle, Award, Clock, HelpCircle } from "lucide-react";
import { SummaryCounts } from "@/types/websiteKnowledge.types";

const CARD_DEFS = [
  { key: "total", label: "Total", icon: Users, tone: "text-[var(--ink-primary)]" },
  { key: "completed", label: "Completed", icon: CheckCircle2, tone: "text-accent-600 dark:text-accent-400" },
  { key: "not_attempted", label: "Not Attempted", icon: HelpCircle, tone: "text-[var(--ink-muted)]" },
  { key: "in_progress", label: "In Progress", icon: Clock, tone: "text-blue-600 dark:text-blue-400" },
  { key: "passed", label: "Passed", icon: CheckCircle2, tone: "text-[var(--status-good)]" },
  { key: "failed", label: "Failed", icon: XCircle, tone: "text-[var(--status-serious)]" },
  { key: "certified", label: "Certified", icon: Award, tone: "text-amber-500" },
] as const;

export function SummaryStatCards({ counts }: { counts: SummaryCounts }) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-7">
      {CARD_DEFS.map(({ key, label, icon: Icon, tone }) => (
        <div key={key} className="rounded-xl border border-black/[0.06] bg-white p-4 dark:border-white/[0.08] dark:bg-[#17171a]">
          <Icon size={16} className={tone} />
          <div className="mt-2 text-xl font-bold text-[var(--ink-primary)]">{counts[key]}</div>
          <div className="text-xs text-[var(--ink-muted)]">{label}</div>
        </div>
      ))}
    </div>
  );
}
