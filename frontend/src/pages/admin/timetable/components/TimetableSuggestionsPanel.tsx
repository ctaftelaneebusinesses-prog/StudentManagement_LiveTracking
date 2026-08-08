import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, X } from "lucide-react";
import { ChartCard } from "@/pages/admin/dashboard/components/ChartCard";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { useToast } from "@/components/ui/Toast";
import * as timetableChangeRequestsService from "@/services/admin/timetableChangeRequests.service";
import { getApiErrorMessage } from "@/lib/axios";
import { DAY_NAMES } from "@/types/dashboard.types";

/**
 * Teachers can only *suggest* timetable changes (TeacherTimetablePage.tsx) —
 * this panel is where an admin sees those suggestions and resolves them.
 * Approving/rejecting here only marks the suggestion itself as reviewed; the
 * admin still applies the actual change through the grid below (click the
 * cell), which keeps every real write running through the validated,
 * conflict-checked upsertPeriod path.
 */
export function TimetableSuggestionsPanel() {
  const queryClient = useQueryClient();
  const toast = useToast();

  const suggestionsQuery = useQuery({
    queryKey: ["admin", "timetable-change-requests"],
    queryFn: timetableChangeRequestsService.fetchOpenSuggestions,
  });

  const reviewMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: "approved" | "rejected" }) =>
      timetableChangeRequestsService.reviewSuggestion(id, status),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin", "timetable-change-requests"] });
      toast.success("Suggestion updated.");
    },
    onError: (err) => toast.error(getApiErrorMessage(err, "Failed to update the suggestion.")),
  });

  const suggestions = suggestionsQuery.data ?? [];
  if (!suggestionsQuery.isLoading && suggestions.length === 0) return null;

  return (
    <ChartCard title="Suggested changes" subtitle="Timetable changes teachers have proposed" className="print:hidden">
      <ul className="space-y-3">
        {suggestions.map((s) => (
          <li key={s.id} className="rounded-xl border border-black/[0.06] p-4 dark:border-white/[0.08]">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="text-sm font-medium text-[var(--ink-primary)]">
                  {s.classes ? `${s.classes.name} - ${s.classes.section}` : "—"} · {DAY_NAMES[s.day_of_week]} · Period {s.period_no}
                </p>
                <p className="text-xs text-[var(--ink-muted)]">Suggested by {s.users?.full_name ?? "a teacher"}</p>
                <p className="mt-1 text-sm text-[var(--ink-secondary)]">{s.reason}</p>
                <div className="mt-1 flex flex-wrap gap-2 text-xs text-[var(--ink-muted)]">
                  {s.proposed_change.start_time && s.proposed_change.end_time && (
                    <Badge variant="info">
                      {s.proposed_change.start_time}–{s.proposed_change.end_time}
                    </Badge>
                  )}
                  {s.proposed_change.room_number && <Badge variant="info">Room {s.proposed_change.room_number}</Badge>}
                </div>
              </div>
              <div className="flex gap-1.5">
                <Button
                  variant="secondary"
                  className="!p-1.5 text-[var(--status-good)]"
                  title="Mark reviewed (approved)"
                  onClick={() => reviewMutation.mutate({ id: s.id, status: "approved" })}
                >
                  <Check size={15} strokeWidth={2} />
                </Button>
                <Button
                  variant="secondary"
                  className="!p-1.5 text-[var(--status-serious)]"
                  title="Dismiss"
                  onClick={() => reviewMutation.mutate({ id: s.id, status: "rejected" })}
                >
                  <X size={15} strokeWidth={2} />
                </Button>
              </div>
            </div>
          </li>
        ))}
      </ul>
    </ChartCard>
  );
}
