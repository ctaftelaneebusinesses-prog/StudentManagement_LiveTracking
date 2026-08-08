import { ReactNode, useState } from "react";
import { Link } from "react-router-dom";
import { useForm } from "react-hook-form";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CalendarClock, Plus, Pencil, Trash2, TriangleAlert } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Modal } from "@/components/ui/Modal";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { DataTable, Column } from "@/components/ui/DataTable";
import { ExportButtons } from "@/components/ui/ExportButtons";
import { getApiErrorMessage } from "@/lib/axios";
import * as examsService from "@/services/admin/exams.service";
import * as classesService from "@/services/admin/classes.service";
import { Exam, ExamScheduleEntry } from "@/types/exam.types";
import { ExportColumn } from "@/utils/export";
import { EmptyState } from "@/components/ui/EmptyState";
import { ExamsTableSkeleton } from "./ExamsSkeleton";

interface ScheduleFormValues {
  subject_id: string;
  exam_date: string;
  start_time: string;
  end_time: string;
  room: string;
  max_marks: string;
}

const EMPTY_FORM: ScheduleFormValues = { subject_id: "", exam_date: "", start_time: "", end_time: "", room: "", max_marks: "100" };

const EXPORT_COLUMNS: ExportColumn<ExamScheduleEntry>[] = [
  { header: "Subject", accessor: (r) => r.subjects?.name ?? "" },
  { header: "Date", accessor: (r) => r.exam_date },
  { header: "Start", accessor: (r) => r.start_time.slice(0, 5) },
  { header: "End", accessor: (r) => r.end_time.slice(0, 5) },
  { header: "Room", accessor: (r) => r.room ?? "—" },
  { header: "Max marks", accessor: (r) => r.max_marks },
];

export function TimetableTab({ exam, picker }: { exam: Exam | null; picker: ReactNode }) {
  const queryClient = useQueryClient();
  const [isCreateOpen, setCreateOpen] = useState(false);
  const [editingEntry, setEditingEntry] = useState<ExamScheduleEntry | null>(null);
  const [deletingEntry, setDeletingEntry] = useState<ExamScheduleEntry | null>(null);

  const scheduleQuery = useQuery({
    queryKey: ["admin", "exams", exam?.id, "schedule"],
    queryFn: () => examsService.fetchSchedule(exam!.id),
    enabled: !!exam,
  });

  const classSubjectsQuery = useQuery({
    queryKey: ["admin", "classes", exam?.class_id, "subjects"],
    queryFn: () => classesService.fetchClassSubjects(exam!.class_id),
    enabled: !!exam,
  });
  const subjectOptions = (classSubjectsQuery.data ?? []).map((cs) => ({
    value: cs.subject_id,
    label: cs.subjects.name,
  }));
  const hasNoSubjects = !classSubjectsQuery.isLoading && subjectOptions.length === 0;

  const createForm = useForm<ScheduleFormValues>({ defaultValues: EMPTY_FORM });
  const editForm = useForm<ScheduleFormValues>({ defaultValues: EMPTY_FORM });

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["admin", "exams", exam?.id, "schedule"] });

  const createMutation = useMutation({
    mutationFn: (values: ScheduleFormValues) =>
      examsService.createScheduleEntry(exam!.id, {
        subject_id: values.subject_id,
        exam_date: values.exam_date,
        start_time: values.start_time,
        end_time: values.end_time,
        room: values.room || undefined,
        max_marks: values.max_marks ? Number(values.max_marks) : undefined,
      }),
    onSuccess: () => {
      invalidate();
      createForm.reset(EMPTY_FORM);
      setCreateOpen(false);
    },
  });

  const updateMutation = useMutation({
    mutationFn: (values: ScheduleFormValues) =>
      examsService.updateScheduleEntry(exam!.id, editingEntry!.id, {
        subject_id: values.subject_id,
        exam_date: values.exam_date,
        start_time: values.start_time,
        end_time: values.end_time,
        room: values.room || undefined,
        max_marks: values.max_marks ? Number(values.max_marks) : undefined,
      }),
    onSuccess: () => {
      invalidate();
      setEditingEntry(null);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (scheduleId: string) => examsService.deleteScheduleEntry(exam!.id, scheduleId),
    onSuccess: () => {
      invalidate();
      setDeletingEntry(null);
    },
  });

  function openEdit(entry: ExamScheduleEntry) {
    editForm.reset({
      subject_id: entry.subject_id,
      exam_date: entry.exam_date,
      start_time: entry.start_time.slice(0, 5),
      end_time: entry.end_time.slice(0, 5),
      room: entry.room ?? "",
      max_marks: String(entry.max_marks),
    });
    setEditingEntry(entry);
  }

  if (!exam) {
    return (
      <div className="animate-fade-in space-y-4">
        {picker}
        <div className="rounded-2xl border border-black/[0.06] bg-white py-4 dark:border-white/[0.08] dark:bg-[#17171a]">
          <EmptyState icon={CalendarClock} title="Select an exam" description="Choose an exam above to build its subject schedule." />
        </div>
      </div>
    );
  }

  const entries = scheduleQuery.data ?? [];

  const columns: Column<ExamScheduleEntry>[] = [
    { header: "Subject", cell: (r) => <span className="font-medium text-[var(--ink-primary)]">{r.subjects?.name ?? "—"}</span> },
    { header: "Date", cell: (r) => r.exam_date },
    { header: "Time", cell: (r) => `${r.start_time.slice(0, 5)} – ${r.end_time.slice(0, 5)}` },
    { header: "Room", cell: (r) => r.room ?? "—" },
    { header: "Max marks", cell: (r) => r.max_marks },
    {
      header: "",
      cell: (r) => (
        <div className="flex justify-end gap-1.5">
          <Button variant="ghost" className="!px-2 !py-1 text-xs" onClick={() => openEdit(r)} aria-label="Edit schedule entry">
            <Pencil size={14} />
          </Button>
          <Button
            variant="ghost"
            className="!px-2 !py-1 text-xs text-red-600 hover:bg-red-500/10"
            onClick={() => setDeletingEntry(r)}
            aria-label="Remove schedule entry"
          >
            <Trash2 size={14} />
          </Button>
        </div>
      ),
      className: "text-right",
    },
  ];

  return (
    <div className="animate-fade-in space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-4">
        {picker}
        <div className="flex gap-2">
          <ExportButtons
            title={`${exam.name} — Exam Timetable`}
            columns={EXPORT_COLUMNS}
            rows={entries}
            filename={`${exam.name.replace(/\s+/g, "_")}_timetable`}
          />
          <Button onClick={() => setCreateOpen(true)}>
            <Plus size={16} /> Add subject
          </Button>
        </div>
      </div>

      {scheduleQuery.isLoading ? (
        <ExamsTableSkeleton />
      ) : entries.length === 0 ? (
        <div className="rounded-2xl border border-black/[0.06] bg-white py-4 dark:border-white/[0.08] dark:bg-[#17171a]">
          <EmptyState icon={CalendarClock} title="No subjects scheduled" description="Add subjects to build this exam's timetable." />
        </div>
      ) : (
        <div className="rounded-2xl border border-black/[0.06] bg-white p-2 dark:border-white/[0.08] dark:bg-[#17171a]">
          <DataTable<ExamScheduleEntry> columns={columns} rows={entries} rowKey={(r) => r.id} isLoading={false} />
        </div>
      )}

      {/* Create */}
      <Modal isOpen={isCreateOpen} onClose={() => setCreateOpen(false)} title="Add subject to timetable">
        {hasNoSubjects ? (
          <div className="space-y-4">
            <div className="flex items-start gap-3 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3.5 py-3 text-sm text-amber-800 dark:text-amber-400">
              <TriangleAlert size={18} className="mt-0.5 flex-none" />
              <p>
                <strong>{exam.classes ? `${exam.classes.name} - ${exam.classes.section}` : "This class"}</strong> doesn't have any
                subjects assigned yet, so there's nothing to schedule. Add subjects to the class first, then come back here.
              </p>
            </div>
            <Link
              to={`/dashboard/admin/classes/${exam.class_id}`}
              className="inline-flex w-full items-center justify-center rounded-md bg-brand-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-brand-700"
            >
              Go to class subjects
            </Link>
          </div>
        ) : (
          <form className="space-y-4" onSubmit={createForm.handleSubmit((values) => createMutation.mutate(values))}>
            <Select
              label="Subject"
              placeholder="Select subject"
              options={subjectOptions}
              error={createForm.formState.errors.subject_id?.message}
              {...createForm.register("subject_id", { required: "Subject is required" })}
            />
            <div className="grid grid-cols-2 gap-4">
              <Input
                label="Exam date"
                type="date"
                error={createForm.formState.errors.exam_date?.message}
                {...createForm.register("exam_date", { required: "Date is required" })}
              />
              <Input label="Room (optional)" {...createForm.register("room")} />
              <Input
                label="Start time"
                type="time"
                error={createForm.formState.errors.start_time?.message}
                {...createForm.register("start_time", { required: "Start time is required" })}
              />
              <Input
                label="End time"
                type="time"
                error={createForm.formState.errors.end_time?.message}
                {...createForm.register("end_time", { required: "End time is required" })}
              />
            </div>
            <Input label="Max marks" type="number" min={1} {...createForm.register("max_marks")} />
            {createMutation.isError && (
              <p className="text-sm text-red-600">{getApiErrorMessage(createMutation.error, "Failed to add subject.")}</p>
            )}
            <Button type="submit" className="w-full" isLoading={createMutation.isPending}>
              Add to timetable
            </Button>
          </form>
        )}
      </Modal>

      {/* Edit */}
      <Modal isOpen={!!editingEntry} onClose={() => setEditingEntry(null)} title="Edit schedule entry">
        <form className="space-y-4" onSubmit={editForm.handleSubmit((values) => updateMutation.mutate(values))}>
          <Select
            label="Subject"
            placeholder="Select subject"
            options={subjectOptions}
            error={editForm.formState.errors.subject_id?.message}
            {...editForm.register("subject_id", { required: "Subject is required" })}
          />
          <div className="grid grid-cols-2 gap-4">
            <Input
              label="Exam date"
              type="date"
              error={editForm.formState.errors.exam_date?.message}
              {...editForm.register("exam_date", { required: "Date is required" })}
            />
            <Input label="Room (optional)" {...editForm.register("room")} />
            <Input
              label="Start time"
              type="time"
              error={editForm.formState.errors.start_time?.message}
              {...editForm.register("start_time", { required: "Start time is required" })}
            />
            <Input
              label="End time"
              type="time"
              error={editForm.formState.errors.end_time?.message}
              {...editForm.register("end_time", { required: "End time is required" })}
            />
          </div>
          <Input label="Max marks" type="number" min={1} {...editForm.register("max_marks")} />
          {updateMutation.isError && (
            <p className="text-sm text-red-600">{getApiErrorMessage(updateMutation.error, "Failed to update entry.")}</p>
          )}
          <Button type="submit" className="w-full" isLoading={updateMutation.isPending}>
            Save changes
          </Button>
        </form>
      </Modal>

      <ConfirmDialog
        isOpen={!!deletingEntry}
        title="Remove from timetable"
        message={`Remove ${deletingEntry?.subjects?.name ?? "this subject"} from the timetable?`}
        confirmLabel="Remove"
        isLoading={deleteMutation.isPending}
        onConfirm={() => deletingEntry && deleteMutation.mutate(deletingEntry.id)}
        onCancel={() => setDeletingEntry(null)}
      />
    </div>
  );
}
