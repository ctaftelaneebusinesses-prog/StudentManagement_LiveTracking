import { useState } from "react";
import { useForm } from "react-hook-form";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { DatePicker } from "@/components/ui/DatePicker";
import { Select } from "@/components/ui/Select";
import { getApiErrorMessage } from "@/lib/axios";
import * as schoolService from "@/services/admin/school.service";
import { AcademicYear } from "@/types/admin.types";
import { deriveAcademicYearLabel } from "@/utils/academicYear";

interface AcademicYearFormValues {
  start_date: string;
  end_date: string;
  status: "active" | "inactive";
}

interface AcademicYearFormModalProps {
  /** "add" for a new academic year, or the existing year being edited. */
  mode: "add" | AcademicYear;
  onClose: () => void;
  /** Fired after a successful create/update — callers can use this to auto-select the year. */
  onSaved?: (year: AcademicYear) => void;
}

export function AcademicYearFormModal({ mode, onClose, onSaved }: AcademicYearFormModalProps) {
  const queryClient = useQueryClient();
  const editing = mode !== "add" ? mode : null;
  const [formError, setFormError] = useState<string | null>(null);

  const { register, handleSubmit, watch, setValue } = useForm<AcademicYearFormValues>({
    defaultValues: {
      start_date: editing?.start_date ?? "",
      end_date: editing?.end_date ?? "",
      status: editing?.is_current ? "active" : "inactive",
    },
  });

  const startDate = watch("start_date");
  const endDate = watch("end_date");
  const label = deriveAcademicYearLabel(startDate, endDate);

  function invalidateAndClose(year: AcademicYear) {
    queryClient.invalidateQueries({ queryKey: ["admin", "academic-years"] });
    onSaved?.(year);
    onClose();
  }

  const createMutation = useMutation({
    mutationFn: (values: AcademicYearFormValues) =>
      schoolService.createAcademicYear({
        name: label,
        start_date: values.start_date,
        end_date: values.end_date,
        is_current: values.status === "active",
      }),
    onSuccess: invalidateAndClose,
    onError: (err) => setFormError(getApiErrorMessage(err, "Failed to create academic year.")),
  });

  const updateMutation = useMutation({
    mutationFn: (values: AcademicYearFormValues) =>
      schoolService.updateAcademicYear(editing!.id, {
        name: label,
        start_date: values.start_date,
        end_date: values.end_date,
        is_current: values.status === "active",
      }),
    onSuccess: invalidateAndClose,
    onError: (err) => setFormError(getApiErrorMessage(err, "Failed to update academic year.")),
  });

  const activeMutation = editing ? updateMutation : createMutation;

  function onSubmit(values: AcademicYearFormValues) {
    setFormError(null);
    if (!values.start_date || !values.end_date) {
      setFormError("Both start and end dates are required.");
      return;
    }
    if (values.end_date <= values.start_date) {
      setFormError("End date must be after the start date.");
      return;
    }
    activeMutation.mutate(values);
  }

  return (
    <Modal isOpen onClose={onClose} title={editing ? "Edit academic year" : "Add academic year"}>
      <form className="space-y-4" onSubmit={handleSubmit(onSubmit)}>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <DatePicker
            label="Start date"
            value={startDate}
            onChange={(iso) => setValue("start_date", iso, { shouldValidate: true })}
          />
          <DatePicker
            label="End date"
            value={endDate}
            onChange={(iso) => setValue("end_date", iso, { shouldValidate: true })}
            minDate={startDate}
          />
        </div>

        <div className="rounded-lg border border-black/[0.06] bg-black/[0.02] px-3 py-2.5 dark:border-white/[0.08] dark:bg-white/[0.03]">
          <p className="text-xs font-medium text-[var(--ink-muted)]">Academic Year</p>
          <p className="mt-0.5 text-sm font-semibold text-[var(--ink-primary)]">{label || "Select both dates"}</p>
        </div>

        <Select
          label="Status"
          options={[
            { value: "active", label: "Active" },
            { value: "inactive", label: "Inactive" },
          ]}
          {...register("status")}
        />
        <p className="-mt-2 text-xs text-[var(--ink-muted)]">
          Only one academic year can be Active at a time. Setting this Active will deactivate the current one.
        </p>

        {formError && <p className="text-sm text-red-600">{formError}</p>}

        <Button type="submit" className="w-full" isLoading={activeMutation.isPending}>
          {editing ? "Save changes" : "Create"}
        </Button>
      </form>
    </Modal>
  );
}
