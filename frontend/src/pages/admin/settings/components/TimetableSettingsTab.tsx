import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, Trash2 } from "lucide-react";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { SettingsCard } from "./SettingsCard";
import * as schoolService from "@/services/admin/school.service";
import { DefaultPeriodTiming } from "@/services/admin/school.service";
import { getApiErrorMessage } from "@/lib/axios";

function nextPeriodNo(rows: DefaultPeriodTiming[]): number {
  return rows.reduce((max, r) => Math.max(max, r.period_no), 0) + 1;
}

export function TimetableSettingsTab() {
  const queryClient = useQueryClient();
  const { data: school } = useQuery({ queryKey: ["admin", "school"], queryFn: schoolService.fetchMySchool });
  const [rows, setRows] = useState<DefaultPeriodTiming[]>([]);

  useEffect(() => {
    const stored = school?.settings?.defaultPeriodTimings as DefaultPeriodTiming[] | undefined;
    if (stored?.length) {
      setRows([...stored].sort((a, b) => a.period_no - b.period_no));
    }
  }, [school]);

  const mutation = useMutation({
    mutationFn: schoolService.updateDefaultPeriodTimings,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["admin", "school"] }),
  });

  function updateRow(index: number, patch: Partial<DefaultPeriodTiming>) {
    setRows((prev) => prev.map((r, i) => (i === index ? { ...r, ...patch } : r)));
  }

  function addRow() {
    setRows((prev) => [...prev, { period_no: nextPeriodNo(prev), start_time: "", end_time: "" }]);
  }

  function removeRow(index: number) {
    setRows((prev) => prev.filter((_, i) => i !== index));
  }

  return (
    <SettingsCard
      title="Master Timetable Settings"
      subtitle="Set default period timings once — every class uses these unless a specific class/section timetable overrides a period."
      action={
        <Button variant="ghost" onClick={addRow}>
          <Plus size={16} strokeWidth={2} /> Add period
        </Button>
      }
    >
      <div className="space-y-3">
        {rows.length === 0 && <p className="text-sm text-[var(--ink-muted)]">No default periods set yet. Add one to get started.</p>}
        {rows.map((row, index) => (
          <div key={index} className="flex flex-wrap items-end gap-3">
            <Input
              label="Period"
              type="number"
              min={1}
              className="w-24"
              value={row.period_no}
              onChange={(e) => updateRow(index, { period_no: Number(e.target.value) || 1 })}
            />
            <Input
              label="Start time"
              type="time"
              value={row.start_time}
              onChange={(e) => updateRow(index, { start_time: e.target.value })}
            />
            <Input
              label="End time"
              type="time"
              value={row.end_time}
              onChange={(e) => updateRow(index, { end_time: e.target.value })}
            />
            <Button variant="ghost" className="!px-2 !py-2 text-[var(--delta-bad)]" onClick={() => removeRow(index)}>
              <Trash2 size={16} strokeWidth={1.75} />
            </Button>
          </div>
        ))}
      </div>

      <Button
        className="mt-4"
        isLoading={mutation.isPending}
        onClick={() => mutation.mutate([...rows].sort((a, b) => a.period_no - b.period_no))}
      >
        Save default timings
      </Button>
      {mutation.isSuccess && <p className="mt-2 text-sm text-[var(--delta-good)]">Default period timings saved.</p>}
      {mutation.isError && (
        <p className="mt-2 text-sm text-[var(--delta-bad)]">{getApiErrorMessage(mutation.error, "Failed to save default period timings.")}</p>
      )}
    </SettingsCard>
  );
}
