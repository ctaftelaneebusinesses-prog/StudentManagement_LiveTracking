import { useQuery } from "@tanstack/react-query";
import { Award } from "lucide-react";
import { Drawer } from "@/components/ui/Drawer";
import { Spinner } from "@/components/ui/Spinner";
import { EmptyState } from "@/components/ui/EmptyState";
import { Badge } from "@/components/ui/Badge";
import { AttemptHistory } from "@/types/websiteKnowledge.types";
import { formatDateTime, formatPercentage } from "../utils";

interface HistoryDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  queryKey: unknown[];
  fetchHistory: () => Promise<AttemptHistory>;
  enabled: boolean;
}

export function HistoryDrawer({ isOpen, onClose, title, description, queryKey, fetchHistory, enabled }: HistoryDrawerProps) {
  const { data, isLoading } = useQuery({ queryKey, queryFn: fetchHistory, enabled });

  return (
    <Drawer isOpen={isOpen} onClose={onClose} title={title} description={description} width="lg">
      {isLoading && (
        <div className="flex justify-center py-10">
          <Spinner label="Loading history..." />
        </div>
      )}

      {!isLoading && data && (
        <div className="space-y-5">
          {data.certificate ? (
            <div className="flex items-center gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4 dark:border-amber-900/40 dark:bg-amber-950/20">
              <span className="flex h-10 w-10 items-center justify-center rounded-full bg-amber-400/20 text-amber-600 dark:text-amber-400">
                <Award size={18} />
              </span>
              <div>
                <div className="text-sm font-semibold text-[var(--ink-primary)]">Certified — {data.certificate.percentage}%</div>
                <div className="text-xs text-[var(--ink-muted)]">{data.certificate.certificate_number}</div>
              </div>
            </div>
          ) : (
            <div className="rounded-xl border border-dashed border-black/[0.08] px-4 py-3 text-sm text-[var(--ink-muted)] dark:border-white/[0.1]">
              Not certified yet.
            </div>
          )}

          <div>
            <h4 className="mb-2 text-sm font-semibold text-[var(--ink-primary)]">Attempt History</h4>
            {data.attempts.length === 0 ? (
              <EmptyState title="No attempts yet" />
            ) : (
              <ul className="space-y-2">
                {data.attempts.map((a) => (
                  <li
                    key={a.id}
                    className="flex items-center justify-between rounded-xl border border-black/[0.06] px-4 py-3 text-sm dark:border-white/[0.08]"
                  >
                    <div>
                      <div className="font-medium text-[var(--ink-primary)]">
                        Attempt {a.attempt_number} — {formatPercentage(a.percentage)}
                      </div>
                      <div className="text-xs text-[var(--ink-muted)]">{formatDateTime(a.completed_at ?? a.started_at)}</div>
                    </div>
                    {a.status === "in_progress" ? (
                      <Badge variant="info">In Progress</Badge>
                    ) : a.passed ? (
                      <Badge variant="success">Passed</Badge>
                    ) : (
                      <Badge variant="danger">Failed</Badge>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}
    </Drawer>
  );
}
