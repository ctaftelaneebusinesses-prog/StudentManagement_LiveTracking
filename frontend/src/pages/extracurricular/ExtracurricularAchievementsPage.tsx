import { useEffect, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, Trophy } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { Skeleton } from "@/components/ui/Skeleton";
import { EmptyState } from "@/components/ui/EmptyState";
import { Checkbox } from "@/components/ui/Checkbox";
import { useToast } from "@/components/ui/Toast";
import { useAuth } from "@/hooks/useAuth";
import { getApiErrorMessage } from "@/lib/axios";
import * as portalService from "@/services/extracurricularPortal.service";
import { BatchClassPicker, EMPTY_BATCH_PICKER } from "./components/BatchClassPicker";
import { resolveBatch } from "./batchPicker";

const EMPTY_FORM = { title: "", description: "", achieved_on: "" };

export function ExtracurricularAchievementsPage() {
  const toast = useToast();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [file, setFile] = useState<File | null>(null);
  const [awardToStudents, setAwardToStudents] = useState(false);
  const [picker, setPicker] = useState(EMPTY_BATCH_PICKER);
  const [selectedStudentIds, setSelectedStudentIds] = useState<Set<string>>(new Set());

  const batchesQuery = useQuery({
    queryKey: ["extracurricular", "batches"],
    queryFn: portalService.fetchMyBatches,
    enabled: isModalOpen,
  });
  const batches = batchesQuery.data ?? [];
  const selectedBatch = awardToStudents
    ? resolveBatch(batches, picker.academicYear, picker.className, picker.section, picker.activityId)
    : null;
  const batchId = selectedBatch?.id ?? "";

  const rosterQuery = useQuery({
    queryKey: ["extracurricular", "batch-students", batchId],
    queryFn: () => portalService.fetchBatchStudents(batchId),
    enabled: !!batchId && isModalOpen,
  });

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

  const achievementsQuery = useQuery({
    queryKey: ["extracurricular", "achievements"],
    queryFn: portalService.fetchMyAchievements,
  });

  const uploadMutation = useMutation({
    mutationFn: () => {
      if (!file || !user) throw new Error("A file and a signed-in staff account are required.");
      return portalService.uploadAchievement(user.id, user.school_id ?? "", file, {
        title: form.title,
        description: form.description || undefined,
        achieved_on: form.achieved_on || undefined,
        student_ids: awardToStudents ? Array.from(selectedStudentIds) : undefined,
      });
    },
    onSuccess: () => {
      toast.success("Achievement uploaded.");
      queryClient.invalidateQueries({ queryKey: ["extracurricular", "achievements"] });
      setIsModalOpen(false);
      setForm(EMPTY_FORM);
      setFile(null);
      setAwardToStudents(false);
      setPicker(EMPTY_BATCH_PICKER);
      if (fileInputRef.current) fileInputRef.current.value = "";
    },
    onError: (err) => toast.error(getApiErrorMessage(err, "Failed to upload achievement.")),
  });

  const achievements = achievementsQuery.data ?? [];

  return (
    <div className="animate-fade-in space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-[var(--ink-primary)]">Achievements & Certificates</h1>
          <p className="text-sm text-[var(--ink-muted)]">Upload certificates and highlight student or personal achievements.</p>
        </div>
        <Button onClick={() => setIsModalOpen(true)}>
          <Plus size={16} strokeWidth={2} className="mr-1.5" />
          Upload Achievement
        </Button>
      </div>

      <Card>
        {achievementsQuery.isLoading ? (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-28 w-full" />
            ))}
          </div>
        ) : achievements.length === 0 ? (
          <EmptyState icon={Trophy} title="No achievements uploaded yet" description="Certificates and highlights you upload will appear here." />
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {achievements.map((a) => (
              <div key={a.id} className="rounded-xl border border-black/[0.06] p-4 dark:border-white/[0.08]">
                <div className="flex items-start justify-between gap-2">
                  <p className="text-sm font-semibold text-[var(--ink-primary)]">{a.title}</p>
                  <Trophy size={16} strokeWidth={1.75} className="shrink-0 text-amber-500" />
                </div>
                {a.description && <p className="mt-1 text-xs text-[var(--ink-secondary)]">{a.description}</p>}
                <p className="mt-2 text-xs text-[var(--ink-muted)]">
                  {a.achieved_on ? new Date(a.achieved_on).toLocaleDateString() : "Date not set"}
                </p>
                {(a.url ?? a.signed_url) && (
                  <a
                    href={a.url ?? a.signed_url}
                    target="_blank"
                    rel="noreferrer"
                    className="mt-2 inline-block text-xs font-medium text-brand-600 hover:underline"
                  >
                    View file →
                  </a>
                )}
              </div>
            ))}
          </div>
        )}
      </Card>

      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title="Upload Achievement">
        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            uploadMutation.mutate();
          }}
        >
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
            label="Achieved On"
            type="date"
            value={form.achieved_on}
            onChange={(e) => setForm((f) => ({ ...f, achieved_on: e.target.value }))}
          />

          <label className="flex items-center gap-2 text-sm text-slate-700 dark:text-slate-300">
            <Checkbox checked={awardToStudents} onChange={(e) => setAwardToStudents(e.target.checked)} />
            Award this certificate to student(s) instead of yourself
          </label>

          {awardToStudents && (
            <div className="space-y-3 rounded-lg border border-slate-200 p-3 dark:border-white/10">
              <BatchClassPicker batches={batches} value={picker} onChange={setPicker} />
              {batchId && (
                <>
                  <p className="text-sm font-medium text-slate-700 dark:text-slate-300">
                    Recipients ({selectedStudentIds.size} selected)
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
                </>
              )}
            </div>
          )}

          <div>
            <label className="mb-1.5 block text-sm font-medium text-[var(--ink-secondary)]">Certificate / File</label>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*,application/pdf"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              className="block w-full text-sm text-[var(--ink-secondary)] file:mr-3 file:rounded-md file:border-0 file:bg-brand-600 file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-white hover:file:bg-brand-700"
            />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="secondary" onClick={() => setIsModalOpen(false)}>
              Cancel
            </Button>
            <Button
              type="submit"
              isLoading={uploadMutation.isPending}
              disabled={!form.title || !file || (awardToStudents && selectedStudentIds.size === 0)}
            >
              Upload
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
