import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus } from "lucide-react";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { DataTable } from "@/components/ui/DataTable";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { SettingsCard } from "./SettingsCard";
import * as schoolService from "@/services/admin/school.service";
import { Holiday } from "@/types/admin.types";

const WEEKDAYS = [
  { value: 0, label: "Sun" },
  { value: 1, label: "Mon" },
  { value: 2, label: "Tue" },
  { value: 3, label: "Wed" },
  { value: 4, label: "Thu" },
  { value: 5, label: "Fri" },
  { value: 6, label: "Sat" },
];

function WorkingDaysSection() {
  const queryClient = useQueryClient();
  const { data: school } = useQuery({ queryKey: ["admin", "school"], queryFn: schoolService.fetchMySchool });
  const [selected, setSelected] = useState<number[]>([1, 2, 3, 4, 5]);

  useEffect(() => {
    const stored = school?.settings?.workingDays as number[] | undefined;
    if (stored) setSelected(stored);
  }, [school]);

  const mutation = useMutation({
    mutationFn: schoolService.updateWorkingDays,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["admin", "school"] }),
  });

  function toggle(day: number) {
    setSelected((prev) => (prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day].sort()));
  }

  return (
    <SettingsCard title="Working Days" subtitle="Which weekdays count as school days">
      <div className="flex flex-wrap gap-2">
        {WEEKDAYS.map((day) => (
          <button
            key={day.value}
            type="button"
            onClick={() => toggle(day.value)}
            className={`h-11 w-14 rounded-xl text-sm font-medium transition-colors ${
              selected.includes(day.value)
                ? "bg-accent-600 text-white shadow-sm"
                : "bg-black/[0.04] text-[var(--ink-secondary)] hover:bg-black/[0.08] dark:bg-white/[0.06] dark:hover:bg-white/[0.1]"
            }`}
          >
            {day.label}
          </button>
        ))}
      </div>
      <Button className="mt-4" isLoading={mutation.isPending} onClick={() => mutation.mutate(selected)}>
        Save working days
      </Button>
      {mutation.isSuccess && <p className="mt-2 text-sm text-[var(--delta-good)]">Working days saved.</p>}
    </SettingsCard>
  );
}

function TeacherAttendanceSection() {
  const queryClient = useQueryClient();
  const { data: school } = useQuery({ queryKey: ["admin", "school"], queryFn: schoolService.fetchMySchool });
  const [cutoff, setCutoff] = useState("");

  useEffect(() => {
    const stored = (school?.settings?.attendance as { teacherCheckinCutoff?: string } | undefined)?.teacherCheckinCutoff;
    setCutoff(stored ?? "");
  }, [school]);

  const mutation = useMutation({
    mutationFn: schoolService.updateAttendanceSettings,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["admin", "school"] }),
  });

  return (
    <SettingsCard
      title="Teacher Check-In"
      subtitle="Teachers self-mark attendance by tapping Check In on their dashboard. Anyone who hasn't checked in by this time is automatically marked absent."
    >
      <div className="flex flex-wrap items-end gap-3">
        <Input label="Check-in cutoff time" type="time" value={cutoff} onChange={(e) => setCutoff(e.target.value)} />
        <Button isLoading={mutation.isPending} onClick={() => mutation.mutate({ teacherCheckinCutoff: cutoff || undefined })}>
          Save cutoff time
        </Button>
      </div>
      {mutation.isSuccess && <p className="mt-2 text-sm text-[var(--delta-good)]">Check-in cutoff saved.</p>}
    </SettingsCard>
  );
}

function HolidaysSection() {
  const queryClient = useQueryClient();
  const [modal, setModal] = useState<"add" | Holiday | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Holiday | null>(null);
  const { data: holidays = [], isLoading } = useQuery({ queryKey: ["admin", "holidays"], queryFn: schoolService.fetchHolidays });
  const { data: years = [] } = useQuery({ queryKey: ["admin", "academic-years"], queryFn: schoolService.fetchAcademicYears });
  const yearOptions = years.map((y) => ({ value: y.id, label: y.name }));
  const editing = modal !== "add" ? modal : null;

  const { register, handleSubmit, reset, formState: { isSubmitting } } = useForm({
    defaultValues: { name: "", date: "", is_recurring_yearly: false, academic_year_id: "" },
  });

  const createMutation = useMutation({
    mutationFn: schoolService.createHoliday,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin", "holidays"] });
      reset();
      setModal(null);
    },
  });

  const updateMutation = useMutation({
    mutationFn: (vars: { id: string; patch: Partial<Holiday> }) => schoolService.updateHoliday(vars.id, vars.patch),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin", "holidays"] });
      setModal(null);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: schoolService.deleteHoliday,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin", "holidays"] });
      setDeleteTarget(null);
    },
  });

  return (
    <SettingsCard
      title="Holiday Calendar"
      subtitle={`${holidays.length} holiday${holidays.length === 1 ? "" : "s"}`}
      action={
        <Button onClick={() => setModal("add")}>
          <Plus size={16} strokeWidth={2} /> Add holiday
        </Button>
      }
    >
      <DataTable<Holiday>
        isLoading={isLoading}
        rows={holidays}
        rowKey={(h) => h.id}
        emptyMessage="No holidays added yet."
        columns={[
          { header: "Name", cell: (h) => h.name },
          { header: "Date", cell: (h) => h.date },
          { header: "Recurring yearly", cell: (h) => (h.is_recurring_yearly ? "Yes" : "No") },
          { header: "Academic year", cell: (h) => h.academic_years?.name ?? "—" },
          {
            header: "",
            cell: (h) => (
              <div className="flex gap-2">
                <Button variant="ghost" className="!px-2 !py-1 text-xs" onClick={() => setModal(h)}>
                  Edit
                </Button>
                <Button variant="ghost" className="!px-2 !py-1 text-xs text-[var(--delta-bad)]" onClick={() => setDeleteTarget(h)}>
                  Delete
                </Button>
              </div>
            ),
          },
        ]}
      />

      <Modal isOpen={modal === "add"} onClose={() => setModal(null)} title="Add holiday">
        <form
          className="space-y-4"
          onSubmit={handleSubmit((values) =>
            createMutation.mutate({ ...values, academic_year_id: values.academic_year_id || undefined })
          )}
        >
          <Input label="Holiday name" {...register("name", { required: true })} />
          <Input label="Date" type="date" {...register("date", { required: true })} />
          <Select label="Academic year" placeholder="None" options={yearOptions} {...register("academic_year_id")} />
          <label className="flex items-center gap-2 text-sm text-[var(--ink-secondary)]">
            <input type="checkbox" {...register("is_recurring_yearly")} /> Repeats every year
          </label>
          {createMutation.isError && <p className="text-sm text-[var(--delta-bad)]">Failed to create holiday.</p>}
          <Button type="submit" className="w-full" isLoading={isSubmitting || createMutation.isPending}>
            Create
          </Button>
        </form>
      </Modal>

      {editing && (
        <EditHolidayModal
          holiday={editing}
          yearOptions={yearOptions}
          onClose={() => setModal(null)}
          onSave={(patch) => updateMutation.mutate({ id: editing.id, patch })}
          isSaving={updateMutation.isPending}
        />
      )}

      <ConfirmDialog
        isOpen={deleteTarget !== null}
        title="Delete holiday"
        message={`Delete "${deleteTarget?.name}"? This cannot be undone.`}
        confirmLabel="Delete"
        isLoading={deleteMutation.isPending}
        onConfirm={() => deleteTarget && deleteMutation.mutate(deleteTarget.id)}
        onCancel={() => setDeleteTarget(null)}
      />
    </SettingsCard>
  );
}

function EditHolidayModal({
  holiday,
  yearOptions,
  onClose,
  onSave,
  isSaving,
}: {
  holiday: Holiday;
  yearOptions: { value: string; label: string }[];
  onClose: () => void;
  onSave: (patch: Partial<Holiday>) => void;
  isSaving: boolean;
}) {
  const { register, handleSubmit } = useForm({
    defaultValues: {
      name: holiday.name,
      date: holiday.date,
      is_recurring_yearly: holiday.is_recurring_yearly,
      academic_year_id: holiday.academic_year_id ?? "",
    },
  });
  return (
    <Modal isOpen onClose={onClose} title="Edit holiday">
      <form className="space-y-4" onSubmit={handleSubmit((values) => onSave({ ...values, academic_year_id: values.academic_year_id || null }))}>
        <Input label="Holiday name" {...register("name", { required: true })} />
        <Input label="Date" type="date" {...register("date", { required: true })} />
        <Select label="Academic year" placeholder="None" options={yearOptions} {...register("academic_year_id")} />
        <label className="flex items-center gap-2 text-sm text-[var(--ink-secondary)]">
          <input type="checkbox" {...register("is_recurring_yearly")} /> Repeats every year
        </label>
        <Button type="submit" className="w-full" isLoading={isSaving}>
          Save changes
        </Button>
      </form>
    </Modal>
  );
}

export function CalendarTab() {
  return (
    <div className="animate-fade-in space-y-6">
      <WorkingDaysSection />
      <TeacherAttendanceSection />
      <HolidaysSection />
    </div>
  );
}
