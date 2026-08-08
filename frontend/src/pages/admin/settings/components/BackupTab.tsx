import { useState } from "react";
import { useForm } from "react-hook-form";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Download } from "lucide-react";
import { Select } from "@/components/ui/Select";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { SettingsCard } from "./SettingsCard";
import { SettingsTabSkeleton } from "./SettingsSkeleton";
import { ErrorState } from "@/pages/admin/dashboard/components/states/ErrorState";
import * as schoolService from "@/services/admin/school.service";
import { BackupSettings } from "@/types/admin.types";

const FREQUENCY_OPTIONS = [
  { value: "daily", label: "Daily" },
  { value: "weekly", label: "Weekly" },
  { value: "monthly", label: "Monthly" },
];

function downloadJson(data: unknown, filename: string) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

export function BackupTab() {
  const queryClient = useQueryClient();
  const [exportError, setExportError] = useState<string | null>(null);
  const query = useQuery({ queryKey: ["admin", "school"], queryFn: schoolService.fetchMySchool });
  const current = query.data?.settings?.backup as BackupSettings | undefined;

  const { register, handleSubmit, formState: { isSubmitting } } = useForm({
    values: { frequency: current?.frequency ?? "weekly", retentionDays: current?.retentionDays ?? 30 },
  });

  const saveMutation = useMutation({
    mutationFn: schoolService.updateBackupSettings,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["admin", "school"] }),
  });

  const exportMutation = useMutation({
    mutationFn: schoolService.exportSchoolData,
    onSuccess: (data) => {
      setExportError(null);
      downloadJson(data, `school-data-export-${new Date().toISOString().slice(0, 10)}.json`);
      queryClient.invalidateQueries({ queryKey: ["admin", "school"] });
    },
    onError: (err) => setExportError(err instanceof Error ? err.message : "Failed to export data"),
  });

  if (query.isLoading) return <SettingsTabSkeleton cards={2} rows={2} />;
  if (query.isError) {
    return <ErrorState message={query.error instanceof Error ? query.error.message : undefined} onRetry={() => query.refetch()} />;
  }

  return (
    <div className="animate-fade-in space-y-6">
      <SettingsCard title="Backup Preferences" subtitle="Saved for the record — used to plan your export cadence">
        <form
          className="grid grid-cols-1 gap-4 sm:grid-cols-2"
          onSubmit={handleSubmit((values) => saveMutation.mutate({ frequency: values.frequency as BackupSettings["frequency"], retentionDays: Number(values.retentionDays) }))}
        >
          <Select label="Frequency" options={FREQUENCY_OPTIONS} {...register("frequency")} />
          <Input label="Retention (days)" type="number" {...register("retentionDays")} />
          {saveMutation.isSuccess && <p className="sm:col-span-2 text-sm text-[var(--delta-good)]">Preferences saved.</p>}
          <Button type="submit" className="sm:col-span-2 sm:w-fit" isLoading={isSubmitting || saveMutation.isPending}>
            Save preferences
          </Button>
        </form>
      </SettingsCard>

      <SettingsCard title="Manual Backup" subtitle="Download a real snapshot of this school's roster and configuration data">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <p className="text-sm text-[var(--ink-secondary)]">
            Last export: {current?.lastExportAt ? new Date(current.lastExportAt).toLocaleString() : "never"}
          </p>
          <Button isLoading={exportMutation.isPending} onClick={() => exportMutation.mutate()}>
            <Download size={16} strokeWidth={2} /> Export data now
          </Button>
        </div>
        {exportError && <p className="mt-3 text-sm text-[var(--delta-bad)]">{exportError}</p>}
        <p className="mt-3 text-xs text-[var(--ink-muted)]">
          Includes school profile, users, students, teachers, classes, subjects, academic years, branches, and departments — not full transactional
          history (attendance/fee/GPS records), which is already exportable per-module from Reports.
        </p>
      </SettingsCard>
    </div>
  );
}
