import { useState } from "react";
import { useForm } from "react-hook-form";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, Pencil, Trash2, CalendarClock, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Modal } from "@/components/ui/Modal";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { DataTable, Column } from "@/components/ui/DataTable";
import { getApiErrorMessage } from "@/lib/axios";
import * as examsService from "@/services/admin/exams.service";
import { Exam } from "@/types/exam.types";
import { ExamStatusBadge } from "./ExamStatusBadge";
import { ExamsTableSkeleton } from "./ExamsSkeleton";
import { EmptyState } from "@/components/ui/EmptyState";

interface ExamFormValues {
  class_id: string;
  scope: "class" | "selected" | "all";
  name: string;
  exam_date: string;
}

interface ExamsTabProps {
  classes: { value: string; label: string }[];
  classFilter: string;
  onClassFilterChange: (value: string) => void;
  exams: Exam[];
  isLoading: boolean;
  onManage: (examId: string) => void;
}

export function ExamsTab({ classes, classFilter, onClassFilterChange, exams, isLoading, onManage }: ExamsTabProps) {
  const queryClient = useQueryClient();
  const [isCreateOpen, setCreateOpen] = useState(false);
  const [editingExam, setEditingExam] = useState<Exam | null>(null);
  const [deletingExam, setDeletingExam] = useState<Exam | null>(null);

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["admin", "exams"] });

  const createForm = useForm<ExamFormValues>({
    defaultValues: { class_id: classFilter, scope: "class", name: "", exam_date: "" },
  });
  const editForm = useForm<ExamFormValues>({ defaultValues: { class_id: "", scope: "class", name: "", exam_date: "" } });
  const createScope = createForm.watch("scope");
  const [selectedClassIds, setSelectedClassIds] = useState<Set<string>>(new Set());

  function toggleSelectedClass(id: string) {
    setSelectedClassIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  const createMutation = useMutation({
    mutationFn: (values: ExamFormValues) =>
      examsService.createExam({
        name: values.name,
        exam_date: values.exam_date || undefined,
        scope: values.scope,
        class_id: values.scope === "class" ? values.class_id : undefined,
        class_ids: values.scope === "selected" ? Array.from(selectedClassIds) : undefined,
      }),
    onSuccess: () => {
      invalidate();
      createForm.reset();
      setSelectedClassIds(new Set());
      setCreateOpen(false);
    },
  });

  const updateMutation = useMutation({
    mutationFn: (values: ExamFormValues) =>
      examsService.updateExam(editingExam!.id, { ...values, exam_date: values.exam_date || undefined }),
    onSuccess: () => {
      invalidate();
      setEditingExam(null);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => examsService.deleteExam(id),
    onSuccess: () => {
      invalidate();
      setDeletingExam(null);
    },
  });

  function openEdit(exam: Exam) {
    editForm.reset({ class_id: exam.class_id, name: exam.name, exam_date: exam.exam_date ?? "" });
    setEditingExam(exam);
  }

  const columns: Column<Exam>[] = [
    { header: "Exam", cell: (e) => <span className="font-medium text-[var(--ink-primary)]">{e.name}</span> },
    { header: "Class", cell: (e) => (e.classes ? `${e.classes.name} - ${e.classes.section}` : "—") },
    { header: "Date", cell: (e) => e.exam_date ?? "—" },
    { header: "Status", cell: (e) => <ExamStatusBadge isPublished={e.is_published} /> },
    {
      header: "",
      cell: (e) => (
        <div className="flex justify-end gap-1.5">
          <Button variant="ghost" className="!px-2 !py-1 text-xs" onClick={() => onManage(e.id)}>
            Manage <ArrowRight size={13} className="ml-1" />
          </Button>
          <Button variant="ghost" className="!px-2 !py-1 text-xs" onClick={() => openEdit(e)} aria-label="Edit exam">
            <Pencil size={14} />
          </Button>
          <Button
            variant="ghost"
            className="!px-2 !py-1 text-xs text-red-600 hover:bg-red-500/10"
            onClick={() => setDeletingExam(e)}
            aria-label="Delete exam"
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
        <div className="w-56">
          <Select
            label="Class"
            placeholder="All classes"
            options={classes}
            value={classFilter}
            onChange={(e) => onClassFilterChange(e.target.value)}
          />
        </div>
        <Button onClick={() => setCreateOpen(true)}>
          <Plus size={16} /> Create exam
        </Button>
      </div>

      {isLoading ? (
        <ExamsTableSkeleton />
      ) : exams.length === 0 ? (
        <div className="rounded-2xl border border-black/[0.06] bg-white py-4 dark:border-white/[0.08] dark:bg-[#17171a]">
          <EmptyState
            icon={CalendarClock}
            title="No exams yet"
            description="Create your first exam to start building its timetable, documents, and results."
          />
        </div>
      ) : (
        <div className="rounded-2xl border border-black/[0.06] bg-white p-2 dark:border-white/[0.08] dark:bg-[#17171a]">
          <DataTable<Exam> columns={columns} rows={exams} rowKey={(e) => e.id} isLoading={false} />
        </div>
      )}

      {/* Create */}
      <Modal
        isOpen={isCreateOpen}
        onClose={() => {
          setCreateOpen(false);
          setSelectedClassIds(new Set());
        }}
        title="Create exam"
      >
        <form
          className="space-y-4"
          onSubmit={createForm.handleSubmit((values) => {
            if (values.scope === "selected" && selectedClassIds.size === 0) return;
            createMutation.mutate(values);
          })}
        >
          <div>
            <p className="mb-1.5 text-sm font-medium text-slate-700 dark:text-slate-300">Applies to</p>
            <div className="inline-flex rounded-lg border border-slate-300 p-0.5 dark:border-white/20">
              {(["class", "selected", "all"] as const).map((opt) => (
                <button
                  key={opt}
                  type="button"
                  onClick={() => createForm.setValue("scope", opt, { shouldValidate: true })}
                  className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                    createScope === opt
                      ? "bg-accent-600 text-white"
                      : "text-[var(--ink-secondary)] hover:bg-black/[0.04] dark:hover:bg-white/[0.06]"
                  }`}
                >
                  {opt === "class" ? "One class" : opt === "selected" ? "Selected classes" : "Entire school"}
                </button>
              ))}
            </div>
          </div>

          {createScope === "all" && (
            <p className="rounded-lg border border-accent-500/20 bg-accent-50 px-3.5 py-2.5 text-sm text-accent-700 dark:bg-accent-500/10 dark:text-accent-300">
              This creates the exam for every active class, so each class's own teachers and students will see it.
            </p>
          )}
          {createScope === "class" && (
            <Select
              label="Class"
              placeholder="Select class"
              options={classes}
              error={createForm.formState.errors.class_id?.message}
              {...createForm.register("class_id", { required: createScope === "class" ? "Class is required" : false })}
            />
          )}
          {createScope === "selected" && (
            <div>
              <p className="mb-1.5 text-sm font-medium text-slate-700 dark:text-slate-300">Classes / sections</p>
              <div className="max-h-48 space-y-1 overflow-y-auto rounded-lg border border-slate-200 p-2 dark:border-white/10">
                {classes.map((c) => (
                  <label
                    key={c.value}
                    className="flex items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-black/[0.03] dark:hover:bg-white/[0.05]"
                  >
                    <input
                      type="checkbox"
                      checked={selectedClassIds.has(c.value)}
                      onChange={() => toggleSelectedClass(c.value)}
                      className="h-4 w-4 rounded border-slate-300 text-brand-600 focus:ring-brand-500 dark:border-white/20"
                    />
                    {c.label}
                  </label>
                ))}
              </div>
              {selectedClassIds.size === 0 && (
                <p className="mt-1 text-xs text-red-600">Select at least one class.</p>
              )}
            </div>
          )}
          <Input
            label="Exam name"
            placeholder="e.g. Mid Term, Final Exam"
            error={createForm.formState.errors.name?.message}
            {...createForm.register("name", { required: "Exam name is required" })}
          />
          <Input label="Exam date (optional)" type="date" {...createForm.register("exam_date")} />
          {createMutation.isError && (
            <p className="text-sm text-red-600">{getApiErrorMessage(createMutation.error, "Failed to create exam.")}</p>
          )}
          <Button
            type="submit"
            className="w-full"
            isLoading={createMutation.isPending}
            disabled={createScope === "selected" && selectedClassIds.size === 0}
          >
            Create exam
          </Button>
        </form>
      </Modal>

      {/* Edit */}
      <Modal isOpen={!!editingExam} onClose={() => setEditingExam(null)} title="Edit exam">
        <form className="space-y-4" onSubmit={editForm.handleSubmit((values) => updateMutation.mutate(values))}>
          <Select
            label="Class"
            placeholder="Select class"
            options={classes}
            error={editForm.formState.errors.class_id?.message}
            {...editForm.register("class_id", { required: "Class is required" })}
          />
          <Input
            label="Exam name"
            error={editForm.formState.errors.name?.message}
            {...editForm.register("name", { required: "Exam name is required" })}
          />
          <Input label="Exam date (optional)" type="date" {...editForm.register("exam_date")} />
          {updateMutation.isError && (
            <p className="text-sm text-red-600">{getApiErrorMessage(updateMutation.error, "Failed to update exam.")}</p>
          )}
          <Button type="submit" className="w-full" isLoading={updateMutation.isPending}>
            Save changes
          </Button>
        </form>
      </Modal>

      {/* Delete */}
      <ConfirmDialog
        isOpen={!!deletingExam}
        title="Delete exam"
        message={`Delete "${deletingExam?.name}"? This also removes its schedule, documents, and marks. This cannot be undone.`}
        confirmLabel="Delete"
        isLoading={deleteMutation.isPending}
        onConfirm={() => deletingExam && deleteMutation.mutate(deletingExam.id)}
        onCancel={() => setDeletingExam(null)}
      />
    </div>
  );
}
