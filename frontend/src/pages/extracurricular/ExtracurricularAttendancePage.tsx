import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CalendarCheck, TrendingUp } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { Skeleton } from "@/components/ui/Skeleton";
import { EmptyState } from "@/components/ui/EmptyState";
import { useToast } from "@/components/ui/Toast";
import { getApiErrorMessage } from "@/lib/axios";
import * as portalService from "@/services/extracurricularPortal.service";
import { ExtracurricularAttendanceStatus } from "@/types/extracurricularStaff.types";
import { todayIso } from "./utils";
import { BatchClassPicker, EMPTY_BATCH_PICKER } from "./components/BatchClassPicker";
import { resolveBatch } from "./batchPicker";

const STATUS_OPTIONS: { value: ExtracurricularAttendanceStatus; label: string }[] = [
  { value: "present", label: "Present" },
  { value: "absent", label: "Absent" },
  { value: "late", label: "Late" },
  { value: "excused", label: "Excused" },
];

interface EntryState {
  status: ExtracurricularAttendanceStatus;
  remarks: string;
}

export function ExtracurricularAttendancePage() {
  const toast = useToast();
  const queryClient = useQueryClient();
  const [picker, setPicker] = useState(EMPTY_BATCH_PICKER);
  const [date, setDate] = useState(todayIso());
  const [entries, setEntries] = useState<Record<string, EntryState>>({});

  const batchesQuery = useQuery({ queryKey: ["extracurricular", "batches"], queryFn: portalService.fetchMyBatches });
  const batches = batchesQuery.data ?? [];
  const batchId = resolveBatch(batches, picker.academicYear, picker.className, picker.section, picker.activityId)?.id ?? "";

  const studentsQuery = useQuery({
    queryKey: ["extracurricular", "batch-students", batchId],
    queryFn: () => portalService.fetchBatchStudents(batchId),
    enabled: !!batchId,
  });

  const summaryQuery = useQuery({
    queryKey: ["extracurricular", "attendance-summary", batchId || undefined],
    queryFn: () => portalService.fetchAttendanceSummary(batchId || undefined),
  });

  useEffect(() => {
    if (!studentsQuery.data) return;
    setEntries((prev) => {
      const next: Record<string, EntryState> = {};
      for (const student of studentsQuery.data) {
        next[student.id] = prev[student.id] ?? { status: "present", remarks: "" };
      }
      return next;
    });
  }, [studentsQuery.data, batchId, date]);

  const markMutation = useMutation({
    mutationFn: () =>
      portalService.markAttendance({
        batch_id: batchId,
        session_date: date,
        records: Object.entries(entries).map(([student_id, entry]) => ({
          student_id,
          status: entry.status,
          remarks: entry.remarks || undefined,
        })),
      }),
    onSuccess: () => {
      toast.success("Attendance saved.");
      queryClient.invalidateQueries({ queryKey: ["extracurricular", "attendance-summary"] });
    },
    onError: (err) => toast.error(getApiErrorMessage(err, "Failed to save attendance.")),
  });

  function markAll(status: ExtracurricularAttendanceStatus) {
    setEntries((prev) => {
      const next: Record<string, EntryState> = {};
      for (const id of Object.keys(prev)) next[id] = { ...prev[id], status };
      return next;
    });
  }

  const presentRate = summaryQuery.data?.presentRatePct ?? summaryQuery.data?.presentRate;
  const roster = studentsQuery.data ?? [];

  return (
    <div className="animate-fade-in space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-[var(--ink-primary)]">Attendance</h1>
        <p className="text-sm text-[var(--ink-muted)]">Mark attendance for a session, and track your recent attendance rate.</p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Card className="flex items-center gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-500 to-emerald-700 text-white shadow-sm">
            <CalendarCheck size={18} strokeWidth={1.75} />
          </span>
          <div>
            <p className="text-2xl font-semibold tracking-tight text-[var(--ink-primary)]">{summaryQuery.data?.sessionsRun ?? 0}</p>
            <p className="text-xs text-[var(--ink-muted)]">Sessions run (last 30 days)</p>
          </div>
        </Card>
        <Card className="flex items-center gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-sky-500 to-sky-700 text-white shadow-sm">
            <TrendingUp size={18} strokeWidth={1.75} />
          </span>
          <div>
            <p className="text-2xl font-semibold tracking-tight text-[var(--ink-primary)]">{presentRate != null ? `${presentRate}%` : "—"}</p>
            <p className="text-xs text-[var(--ink-muted)]">Present rate (last 30 days)</p>
          </div>
        </Card>
      </div>

      <Card className="space-y-4">
        <BatchClassPicker batches={batches} value={picker} onChange={setPicker} />
        <div className="flex flex-wrap items-end gap-4">
          <Input label="Session date" type="date" max={todayIso()} value={date} onChange={(e) => setDate(e.target.value)} />
          {!!batchId && roster.length > 0 && (
            <Button type="button" variant="secondary" className="!px-3 !py-2 text-xs" onClick={() => markAll("present")}>
              Mark all present
            </Button>
          )}
        </div>

        {!batchId ? (
          <EmptyState title="Select a class to take attendance" description="Choose an academic year, class, and section above." />
        ) : studentsQuery.isLoading ? (
          <Skeleton className="h-48 w-full" />
        ) : roster.length === 0 ? (
          <EmptyState title="No students in this class yet" />
        ) : (
          <div className="space-y-3">
            <div className="overflow-x-auto rounded-2xl border border-black/[0.06] dark:border-white/[0.08]">
              <table className="min-w-full divide-y divide-black/[0.06] text-sm dark:divide-white/[0.08]">
                <thead className="bg-black/[0.02] dark:bg-white/[0.04]">
                  <tr>
                    <th className="px-4 py-3 text-left font-medium text-[var(--ink-muted)]">Student</th>
                    <th className="px-4 py-3 text-left font-medium text-[var(--ink-muted)]">Status</th>
                    <th className="px-4 py-3 text-left font-medium text-[var(--ink-muted)]">Remarks</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-black/[0.04] bg-white dark:divide-white/[0.05] dark:bg-[#17171a]">
                  {roster.map((student) => (
                    <tr key={student.id}>
                      <td className="px-4 py-3 text-[var(--ink-secondary)]">
                        {student.users.full_name}
                        <span className="ml-2 text-xs text-[var(--ink-muted)]">#{student.admission_no}</span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex flex-wrap gap-1.5">
                          {STATUS_OPTIONS.map((opt) => (
                            <button
                              key={opt.value}
                              type="button"
                              onClick={() =>
                                setEntries((prev) => ({
                                  ...prev,
                                  [student.id]: { ...(prev[student.id] ?? { remarks: "" }), status: opt.value },
                                }))
                              }
                              className={`rounded-full px-2.5 py-1 text-xs font-medium transition-colors ${
                                entries[student.id]?.status === opt.value
                                  ? "bg-amber-600 text-white"
                                  : "bg-black/[0.04] text-[var(--ink-secondary)] hover:bg-black/[0.07] dark:bg-white/[0.06] dark:hover:bg-white/[0.1]"
                              }`}
                            >
                              {opt.label}
                            </button>
                          ))}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <input
                          className="w-full rounded-md border border-slate-300 bg-white px-2 py-1.5 text-sm text-slate-900 shadow-sm outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500 dark:border-white/20 dark:bg-white/10 dark:text-white"
                          placeholder="Optional remarks"
                          value={entries[student.id]?.remarks ?? ""}
                          onChange={(e) =>
                            setEntries((prev) => ({
                              ...prev,
                              [student.id]: { ...(prev[student.id] ?? { status: "present" }), remarks: e.target.value },
                            }))
                          }
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <Button onClick={() => markMutation.mutate()} isLoading={markMutation.isPending}>
              Save attendance
            </Button>
          </div>
        )}
      </Card>
    </div>
  );
}
