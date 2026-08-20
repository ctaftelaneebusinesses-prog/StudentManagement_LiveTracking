import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { BookOpen, Plus } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { DataTable } from "@/components/ui/DataTable";
import { EmptyState } from "@/components/ui/EmptyState";
import { Checkbox } from "@/components/ui/Checkbox";
import { Skeleton } from "@/components/ui/Skeleton";
import { useToast } from "@/components/ui/Toast";
import { getApiErrorMessage } from "@/lib/axios";
import * as portalService from "@/services/extracurricularPortal.service";
import { ExtracurricularPracticeWork } from "@/types/extracurricularPortal.types";
import { todayIso } from "./utils";
import { BatchClassPicker, EMPTY_BATCH_PICKER } from "./components/BatchClassPicker";
import { resolveBatch } from "./batchPicker";

const EMPTY_FORM = { title: "", description: "", due_date: "", attachment_url: "" };

export function ExtracurricularPracticeWorkPage() {
  const toast = useToast();
  const queryClient = useQueryClient();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [picker, setPicker] = useState(EMPTY_BATCH_PICKER);
  const [form, setForm] = useState(EMPTY_FORM);
  const [selectedStudentIds, setSelectedStudentIds] = useState<Set<string>>(new Set());

  const batchesQuery = useQuery({ queryKey: ["extracurricular", "batches"], queryFn: portalService.fetchMyBatches });
  const batches = batchesQuery.data ?? [];
  const selectedBatch = resolveBatch(batches, picker.academicYear, picker.className, picker.section, picker.activityId);
  const batchId = selectedBatch?.id ?? "";

  const rosterQuery = useQuery({
    queryKey: ["extracurricular", "batch-students", batchId],
    queryFn: () => portalService.fetchBatchStudents(batchId),
    enabled: !!batchId && isModalOpen,
  });

  // Every student in the resolved class is targeted by default — staff can uncheck to narrow the recipients.
  useEffect(() => {
    if (rosterQuery.data) setSelectedStudentIds(new Set(rosterQuery.data.map((s) => s.id)));
  }, [rosterQuery.data]);

  function toggleStudent(studentId: string) {
    setSelectedStudentIds((prev) => {
      const next = new Set(prev);
      if (next.has(studentId)) next.delete(studentId);
      else next.add(studentId);
      return next;
    });
  }

  const practiceWorkQuery = useQuery({
    queryKey: ["extracurricular", "practice-work"],
    queryFn: () => portalService.fetchMyPracticeWork(),
  });

  const createMutation = useMutation({
    mutationFn: () =>
      portalService.createPracticeWork({
        batch_id: batchId,
        title: form.title,
        description: form.description || undefined,
        due_date: form.due_date || undefined,
        attachment_url: form.attachment_url || undefined,
        student_ids: Array.from(selectedStudentIds),
      }),
    onSuccess: () => {
      toast.success("Practice work assigned.");
      queryClient.invalidateQueries({ queryKey: ["extracurricular", "practice-work"] });
      setIsModalOpen(false);
      setForm(EMPTY_FORM);
      setPicker(EMPTY_BATCH_PICKER);
    },
    onError: (err) => toast.error(getApiErrorMessage(err, "Failed to assign practice work.")),
  });

  return (
    <div className="animate-fade-in space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-[var(--ink-primary)]">Practice Work</h1>
          <p className="text-sm text-[var(--ink-muted)]">Assign practice tasks to your students, batch by batch.</p>
        </div>
        <Button onClick={() => setIsModalOpen(true)}>
          <Plus size={16} strokeWidth={2} className="mr-1.5" />
          Assign Practice Work
        </Button>
      </div>

      <Card>
        {!practiceWorkQuery.isLoading && (practiceWorkQuery.data ?? []).length === 0 ? (
          <EmptyState
            icon={BookOpen}
            title="No practice work assigned yet"
            description="Assigned practice tasks will appear here."
          />
        ) : (
          <DataTable<ExtracurricularPracticeWork>
            isLoading={practiceWorkQuery.isLoading}
            rows={practiceWorkQuery.data ?? []}
            rowKey={(p) => p.id}
            emptyMessage="No practice work assigned yet."
            columns={[
              { header: "Title", cell: (p) => <span className="font-medium text-[var(--ink-primary)]">{p.title}</span> },
              {
                header: "Class",
                cell: (p) =>
                  p.extracurricular_batches?.name ??
                  (p.extracurricular_batches?.classes
                    ? `${p.extracurricular_batches.classes.name} - ${p.extracurricular_batches.classes.section}`
                    : "—"),
              },
              { header: "Due Date", cell: (p) => (p.due_date ? new Date(p.due_date).toLocaleDateString() : "—") },
              { header: "Assigned", cell: (p) => new Date(p.created_at).toLocaleDateString() },
            ]}
          />
        )}
      </Card>

      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title="Assign Practice Work">
        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            createMutation.mutate();
          }}
        >
          <BatchClassPicker batches={batches} value={picker} onChange={setPicker} />
          <Input
            label="Title"
            name="title"
            value={form.title}
            onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
            required
          />
          <div>
            <label className="mb-1.5 block text-sm font-medium text-[var(--ink-secondary)]">Description</label>
            <textarea
              className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500 dark:border-white/20 dark:bg-white/10 dark:text-white"
              rows={3}
              value={form.description}
              onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
            />
          </div>
          <Input
            label="Due Date"
            type="date"
            min={todayIso()}
            value={form.due_date}
            onChange={(e) => setForm((f) => ({ ...f, due_date: e.target.value }))}
          />
          <Input
            label="Attachment URL (optional)"
            value={form.attachment_url}
            onChange={(e) => setForm((f) => ({ ...f, attachment_url: e.target.value }))}
          />

          {batchId && (
            <div className="space-y-2 rounded-lg border border-slate-200 p-3 dark:border-white/10">
              <p className="text-sm font-medium text-slate-700 dark:text-slate-300">
                Notify students ({selectedStudentIds.size} selected)
              </p>
              <p className="text-xs text-slate-500 dark:text-slate-400">Academic Year: {selectedBatch?.academic_years?.name ?? "—"}</p>
              {rosterQuery.isLoading ? (
                <Skeleton className="h-20 w-full" />
              ) : (
                <div className="max-h-48 space-y-1 overflow-y-auto">
                  {(rosterQuery.data ?? []).map((s) => (
                    <label key={s.id} className="flex items-center gap-2 rounded px-1 py-1 text-sm hover:bg-slate-50 dark:hover:bg-white/5">
                      <Checkbox checked={selectedStudentIds.has(s.id)} onChange={() => toggleStudent(s.id)} />
                      {s.users.full_name} <span className="text-xs text-slate-400 dark:text-slate-500">({s.admission_no})</span>
                    </label>
                  ))}
                </div>
              )}
            </div>
          )}

          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="secondary" onClick={() => setIsModalOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" isLoading={createMutation.isPending} disabled={!batchId || !form.title}>
              Assign
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
