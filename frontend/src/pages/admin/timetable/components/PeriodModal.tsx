import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { ClassSubject, Subject, Teacher } from "@/types/admin.types";
import { TimetablePeriodEntry, TimetablePeriodType, WEEKDAY_NAMES } from "@/types/timetable.types";
import * as extracurricularStaffService from "@/services/admin/extracurricularStaff.service";

interface PeriodModalCell {
  dayOfWeek: number;
  periodNo: number;
  existing: TimetablePeriodEntry | null;
  /** Start/end time to default to, borrowed from a sibling cell in the same period row, if any. */
  defaultStartTime?: string;
  defaultEndTime?: string;
}

interface PeriodFormValues {
  period_type: TimetablePeriodType;
  subject_id: string;
  activity_id: string;
  teacher_id: string;
  room_number: string;
  start_time: string;
  end_time: string;
}

interface PeriodModalProps {
  cell: PeriodModalCell | null;
  classSubjects: ClassSubject[];
  subjects: Subject[];
  teachers: Teacher[];
  isSaving: boolean;
  isDeleting: boolean;
  saveError: string | null;
  onSave: (values: PeriodFormValues) => void;
  onDelete: () => void;
  onClose: () => void;
}

const PERIOD_TYPE_OPTIONS = [
  { value: "academic", label: "Academic Subject" },
  { value: "extracurricular", label: "Extracurricular Activity" },
];

export function PeriodModal({
  cell,
  classSubjects,
  subjects,
  teachers,
  isSaving,
  isDeleting,
  saveError,
  onSave,
  onDelete,
  onClose,
}: PeriodModalProps) {
  const {
    register,
    handleSubmit,
    reset,
    watch,
    setValue,
    formState: { errors },
  } = useForm<PeriodFormValues>({
    defaultValues: {
      period_type: "academic",
      subject_id: "",
      activity_id: "",
      teacher_id: "",
      room_number: "",
      start_time: "",
      end_time: "",
    },
  });

  useEffect(() => {
    if (!cell) return;
    reset({
      period_type: cell.existing?.period_type ?? "academic",
      subject_id: cell.existing?.subject_id ?? "",
      activity_id: cell.existing?.activity_id ?? "",
      teacher_id: cell.existing?.teacher_id ?? "",
      room_number: cell.existing?.room_number ?? "",
      start_time: cell.existing?.start_time?.slice(0, 5) ?? cell.defaultStartTime ?? "",
      end_time: cell.existing?.end_time?.slice(0, 5) ?? cell.defaultEndTime ?? "",
    });
  }, [cell, reset]);

  const periodType = watch("period_type");
  const selectedSubjectId = watch("subject_id");
  const selectedInstructorId = watch("teacher_id");

  // Auto-fill the teacher already assigned to this subject for this class (Assign Subjects, from the Classes Module) — still editable.
  useEffect(() => {
    if (!cell || cell.existing || periodType !== "academic") return; // don't clobber an existing period's saved teacher
    const match = classSubjects.find((cs) => cs.subject_id === selectedSubjectId);
    if (match?.teacher_id) setValue("teacher_id", match.teacher_id);
  }, [selectedSubjectId, classSubjects, cell, periodType, setValue]);

  // Every active extracurricular staff member is a candidate instructor — no
  // separate "pick an activity first" step. Each instructor's own staff type
  // (their primary activity, e.g. "Yoga Instructor") is shown alongside their
  // name, and silently becomes the period's activity_id on save.
  const instructorsQuery = useQuery({
    queryKey: ["admin", "extracurricular-staff", "active"],
    queryFn: () => extracurricularStaffService.fetchExtracurricularStaffList({ status: "active", pageSize: 200 }),
    enabled: periodType === "extracurricular",
  });

  const instructors = instructorsQuery.data?.items ?? [];
  const selectedInstructor = instructors.find((s) => s.id === selectedInstructorId);

  // Keep activity_id in sync with whichever instructor is currently selected — it's derived, never chosen directly.
  useEffect(() => {
    setValue("activity_id", selectedInstructor?.staff_type_activity_id ?? "");
  }, [selectedInstructor, setValue]);

  const subjectOptions = (classSubjects.length > 0 ? classSubjects.map((cs) => ({ id: cs.subject_id, name: cs.subjects.name })) : subjects).map(
    (s) => ({ value: s.id, label: s.name })
  );
  const teacherOptions = teachers.map((t) => ({ value: t.id, label: t.users.full_name }));
  const instructorOptions = instructors.map((s) => ({
    value: s.id,
    label: s.staff_type_activity ? `${s.users.full_name} — ${s.staff_type_activity.staff_title}` : s.users.full_name,
  }));

  if (!cell) return null;

  function handleSave(values: PeriodFormValues) {
    onSave(values.period_type === "extracurricular" ? { ...values, subject_id: "" } : { ...values, activity_id: "" });
  }

  return (
    <Modal
      isOpen={!!cell}
      onClose={onClose}
      title={`${WEEKDAY_NAMES[cell.dayOfWeek]} · Period ${cell.periodNo}`}
    >
      <form className="space-y-4" onSubmit={handleSubmit(handleSave)}>
        <Select label="Period Type" options={PERIOD_TYPE_OPTIONS} {...register("period_type")} />

        <div className="grid grid-cols-2 gap-4">
          <Input
            label="Start time"
            type="time"
            error={errors.start_time?.message}
            {...register("start_time", { required: "Required" })}
          />
          <Input
            label="End time"
            type="time"
            error={errors.end_time?.message}
            {...register("end_time", { required: "Required" })}
          />
        </div>

        {periodType === "academic" ? (
          <>
            <Select label="Subject" placeholder="Select subject" options={subjectOptions} {...register("subject_id")} />
            <Select label="Teacher" placeholder="Select teacher" options={teacherOptions} {...register("teacher_id")} />
          </>
        ) : (
          <Select
            label="Instructor"
            placeholder={instructorsQuery.isLoading ? "Loading instructors…" : "Select instructor"}
            options={instructorOptions}
            {...register("teacher_id")}
          />
        )}

        <Input label="Room number (optional)" placeholder="e.g. 101 or Lab 2" {...register("room_number")} />

        {saveError && (
          <p className="rounded-md bg-red-500/10 px-3 py-2 text-sm text-red-600">{saveError}</p>
        )}

        <div className="flex items-center justify-between gap-3 pt-1">
          {cell.existing ? (
            <Button type="button" variant="danger" onClick={onDelete} isLoading={isDeleting}>
              Delete period
            </Button>
          ) : (
            <span />
          )}
          <Button type="submit" isLoading={isSaving}>
            {cell.existing ? "Save changes" : "Add period"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
