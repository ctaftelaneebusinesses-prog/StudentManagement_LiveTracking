import { useMemo, useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Sparkles } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { Card } from "@/components/ui/Card";
import { Select } from "@/components/ui/Select";
import { Input } from "@/components/ui/Input";
import { Textarea } from "@/components/ui/Textarea";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { DataTable } from "@/components/ui/DataTable";
import { Badge, BadgeVariant } from "@/components/ui/Badge";
import { Tabs } from "@/components/ui/Tabs";
import { useToast } from "@/components/ui/Toast";
import { getApiErrorMessage } from "@/lib/axios";
import * as portalService from "@/services/teacher/portal.service";
import * as homeworkService from "@/services/teacher/homework.service";
import { HomeworkItem, HomeworkStatus } from "@/types/dashboard.types";
import { HomeworkSubmissionRecord } from "@/types/dashboard.types";
import { TeacherClassSummary } from "@/types/teacher.types";

interface HomeworkFormValues {
  subject_id: string;
  title: string;
  description: string;
  due_date: string;
}

const STATUS_BADGE: Record<HomeworkStatus, { label: string; variant: BadgeVariant }> = {
  pending: { label: "Pending review", variant: "warning" },
  approved: { label: "Approved", variant: "success" },
  needs_changes: { label: "Needs changes", variant: "danger" },
};

export function TeacherHomeworkPage() {
  const dashboardQuery = useQuery({ queryKey: ["teacher", "dashboard"], queryFn: portalService.fetchDashboard });
  const classes = dashboardQuery.data?.classes ?? [];
  const homeroomClasses = classes.filter((c) => c.isHomeroom);
  const [tab, setTab] = useState<"mine" | "review">("mine");
  const showReviewTab = homeroomClasses.length > 0;
  const activeTab = showReviewTab ? tab : "mine";

  return (
    <div className="animate-fade-in space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-[var(--ink-primary)]">Homework</h1>
        <p className="text-sm text-[var(--ink-muted)]">
          {showReviewTab
            ? "Manage homework you assign, and review submissions from subject teachers for your class."
            : "Create and manage homework for your classes."}
        </p>
      </div>

      {showReviewTab && (
        <Tabs
          tabs={[
            { key: "mine", label: "My Homework" },
            { key: "review", label: "Class Review" },
          ]}
          active={activeTab}
          onChange={setTab}
        />
      )}

      {activeTab === "mine" ? <MyHomeworkPanel classes={classes} /> : <ClassReviewPanel homeroomClasses={homeroomClasses} />}
    </div>
  );
}

function MyHomeworkPanel({ classes }: { classes: TeacherClassSummary[] }) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [classId, setClassId] = useState("");
  const [isModalOpen, setModalOpen] = useState(false);
  const [editingHomework, setEditingHomework] = useState<HomeworkItem | null>(null);
  const [pendingDelete, setPendingDelete] = useState<HomeworkItem | null>(null);
  const [submissionsHomework, setSubmissionsHomework] = useState<HomeworkItem | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [isUploading, setUploading] = useState(false);

  const submissionsQuery = useQuery({
    queryKey: ["teacher", "homework-submissions", submissionsHomework?.id],
    queryFn: () => homeworkService.fetchSubmissions(submissionsHomework!.id),
    enabled: !!submissionsHomework,
  });

  const classOptions = classes.map((c) => ({ value: c.id, label: `${c.name} - ${c.section}` }));
  const selectedClass = classes.find((c) => c.id === classId);
  const subjectOptions = (selectedClass?.subjects ?? []).map((s) => ({ value: s.id, label: `${s.name} (${s.code})` }));

  const homeworkQuery = useQuery({
    queryKey: ["teacher", "homework", classId],
    queryFn: () => homeworkService.fetchHomework(classId),
    enabled: !!classId,
  });

  const toast = useToast();
  const [isEnhancing, setEnhancing] = useState(false);

  const { register, handleSubmit, reset, watch, setValue, formState: { isSubmitting } } = useForm<HomeworkFormValues>({
    defaultValues: { subject_id: "", title: "", description: "", due_date: "" },
  });

  async function handleEnhanceWithAI() {
    const title = watch("title");
    const description = watch("description");
    if (!description.trim()) {
      toast.error("Write a short description first, then enhance it with AI.");
      return;
    }
    setEnhancing(true);
    try {
      const enhanced = await homeworkService.enhanceHomeworkDescription({ title, description, due_date: watch("due_date") || undefined });
      setValue("description", enhanced);
      toast.success("Description enhanced — feel free to edit it before publishing.");
    } catch {
      toast.error("Failed to enhance description. Please try again.");
    } finally {
      setEnhancing(false);
    }
  }

  function invalidate() {
    queryClient.invalidateQueries({ queryKey: ["teacher", "homework", classId] });
  }

  const createMutation = useMutation({
    mutationFn: homeworkService.createHomework,
    onSuccess: (created) => {
      invalidate();
      reset();
      setModalOpen(false);
      toast.success(
        created.status === "approved"
          ? "Homework published — students have been notified."
          : "Homework submitted for your class teacher's review."
      );
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: homeworkService.CreateHomeworkInput }) =>
      homeworkService.updateHomework(id, patch),
    onSuccess: () => {
      invalidate();
      setEditingHomework(null);
      toast.success("Homework updated");
    },
  });

  const deleteMutation = useMutation({
    mutationFn: homeworkService.deleteHomework,
    onSuccess: () => {
      invalidate();
      setPendingDelete(null);
      toast.success("Homework deleted");
    },
  });

  async function handleUploadAndSubmit(values: HomeworkFormValues) {
    let attachmentUrl: string | undefined;
    const file = fileInputRef.current?.files?.[0];
    if (file && user) {
      setUploadError(null);
      setUploading(true);
      try {
        attachmentUrl = await homeworkService.uploadHomeworkAttachment(user.school_id ?? "", user.id, file);
      } catch (err) {
        setUploadError(err instanceof Error ? err.message : "Failed to upload attachment");
        setUploading(false);
        return;
      }
      setUploading(false);
    }

    const payload: homeworkService.CreateHomeworkInput = {
      class_id: classId,
      subject_id: values.subject_id || undefined,
      title: values.title,
      description: values.description || undefined,
      due_date: values.due_date,
      attachment_url: attachmentUrl,
    };

    if (editingHomework) {
      updateMutation.mutate({ id: editingHomework.id, patch: payload });
    } else {
      createMutation.mutate(payload);
    }
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  function openCreate() {
    setEditingHomework(null);
    reset({ subject_id: "", title: "", description: "", due_date: "" });
    setModalOpen(true);
  }

  function openEdit(hw: HomeworkItem) {
    setEditingHomework(hw);
    reset({
      subject_id: hw.subject_id ?? "",
      title: hw.title,
      description: hw.description ?? "",
      due_date: hw.due_date,
    });
    setModalOpen(true);
  }

  return (
    <div className="space-y-6">
      <Card className="space-y-4">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <Select
            label="Class"
            name="homeworkClassId"
            placeholder="Select class"
            options={classOptions}
            value={classId}
            onChange={(e) => setClassId(e.target.value)}
          />
          <Button disabled={!classId} onClick={openCreate}>
            Assign homework
          </Button>
        </div>

        {!classId ? (
          <p className="text-sm text-slate-500">Select a class to view its homework.</p>
        ) : (
          <DataTable<HomeworkItem>
            isLoading={homeworkQuery.isLoading}
            rows={homeworkQuery.data ?? []}
            rowKey={(h) => h.id}
            emptyMessage="No homework assigned yet."
            columns={[
              { header: "Title", cell: (h) => h.title },
              { header: "Subject", cell: (h) => h.subjects?.name ?? "—" },
              { header: "Due date", cell: (h) => h.due_date },
              {
                header: "Status",
                cell: (h) => <Badge variant={STATUS_BADGE[h.status].variant}>{STATUS_BADGE[h.status].label}</Badge>,
              },
              {
                header: "Attachment",
                cell: (h) =>
                  h.attachment_url ? (
                    <a href={h.attachment_url} target="_blank" rel="noreferrer" className="text-brand-600 hover:underline">
                      View file
                    </a>
                  ) : (
                    "—"
                  ),
              },
              {
                header: "",
                cell: (h) => (
                  <div className="flex gap-2">
                    <Button variant="ghost" className="!px-2 !py-1 text-xs" onClick={() => setSubmissionsHomework(h)}>
                      Submissions
                    </Button>
                    <Button variant="ghost" className="!px-2 !py-1 text-xs" onClick={() => openEdit(h)}>
                      Edit
                    </Button>
                    <Button
                      variant="ghost"
                      className="!px-2 !py-1 text-xs text-red-600"
                      onClick={() => setPendingDelete(h)}
                    >
                      Delete
                    </Button>
                  </div>
                ),
              },
            ]}
          />
        )}
      </Card>

      <Modal
        isOpen={isModalOpen}
        onClose={() => setModalOpen(false)}
        title={editingHomework ? "Edit homework" : "Assign homework"}
      >
        <form className="space-y-4" onSubmit={handleSubmit(handleUploadAndSubmit)}>
          <Input label="Title" {...register("title", { required: true })} />
          <Select label="Subject (optional)" placeholder="No specific subject" options={subjectOptions} {...register("subject_id")} />
          <div className="space-y-1.5">
            <Textarea label="Description (optional)" rows={5} {...register("description")} />
            <Button
              type="button"
              variant="secondary"
              className="!px-3 !py-1.5 text-xs"
              isLoading={isEnhancing}
              onClick={handleEnhanceWithAI}
            >
              <Sparkles size={13} strokeWidth={1.75} className="mr-1 inline" />
              Enhance with AI
            </Button>
            <p className="text-xs text-[var(--ink-muted)]">
              Write a simple note, then let AI turn it into a clear, student-friendly brief — you can still edit it before publishing.
            </p>
          </div>
          <Input label="Due date" type="date" {...register("due_date", { required: true })} />
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-slate-700">Attachment (optional)</label>
            <input ref={fileInputRef} type="file" className="text-sm" />
          </div>
          {uploadError && <p className="text-xs text-red-600">{uploadError}</p>}
          {(createMutation.isError || updateMutation.isError) && (
            <p className="text-sm text-red-600">Failed to save homework.</p>
          )}
          <Button
            type="submit"
            className="w-full"
            isLoading={isSubmitting || isUploading || createMutation.isPending || updateMutation.isPending}
          >
            {editingHomework ? "Save changes" : "Assign"}
          </Button>
        </form>
      </Modal>

      <ConfirmDialog
        isOpen={!!pendingDelete}
        title="Delete homework"
        message={`Delete "${pendingDelete?.title}"? This cannot be undone.`}
        confirmLabel="Delete"
        isLoading={deleteMutation.isPending}
        onConfirm={() => pendingDelete && deleteMutation.mutate(pendingDelete.id)}
        onCancel={() => setPendingDelete(null)}
      />

      <Modal
        isOpen={!!submissionsHomework}
        onClose={() => setSubmissionsHomework(null)}
        title={submissionsHomework ? `Submissions — ${submissionsHomework.title}` : "Submissions"}
      >
        <SubmissionsList submissions={submissionsQuery.data} isLoading={submissionsQuery.isLoading} />
      </Modal>
    </div>
  );
}

function SubmissionsList({ submissions, isLoading }: { submissions?: HomeworkSubmissionRecord[]; isLoading: boolean }) {
  if (isLoading) return <p className="text-sm text-slate-500">Loading submissions…</p>;
  if (!submissions?.length) return <p className="text-sm text-slate-500">No students have submitted yet.</p>;

  return (
    <ul className="space-y-3">
      {submissions.map((s) => (
        <li key={s.id} className="rounded-md border border-slate-100 p-3 text-sm">
          <div className="flex justify-between gap-2">
            <b>{s.students?.users?.full_name ?? "Student"}</b>
            <span className="text-xs text-slate-500">{new Date(s.submitted_at).toLocaleString()}</span>
          </div>
          {s.students?.admission_no && <p className="text-xs text-slate-500">Admission no. {s.students.admission_no}</p>}
          {s.submission_text && <p className="mt-1 text-slate-700">{s.submission_text}</p>}
          {s.attachment_url && (
            <a href={s.attachment_url} target="_blank" rel="noreferrer" className="mt-1 inline-block text-brand-600 hover:underline">
              View attachment
            </a>
          )}
        </li>
      ))}
    </ul>
  );
}

type StatusFilter = "all" | HomeworkStatus;

function ClassReviewPanel({ homeroomClasses }: { homeroomClasses: TeacherClassSummary[] }) {
  const queryClient = useQueryClient();
  const toast = useToast();
  const [classId, setClassId] = useState(homeroomClasses[0]?.id ?? "");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [quickView, setQuickView] = useState<HomeworkItem | null>(null);
  const [pendingDelete, setPendingDelete] = useState<HomeworkItem | null>(null);
  const [requestChangesFor, setRequestChangesFor] = useState<HomeworkItem | null>(null);
  const [note, setNote] = useState("");

  const classOptions = homeroomClasses.map((c) => ({ value: c.id, label: `${c.name} - ${c.section}` }));

  const reviewQuery = useQuery({
    queryKey: ["teacher", "homework-review", classId],
    queryFn: () => homeworkService.fetchForReview(classId),
    enabled: !!classId,
  });

  function invalidate() {
    queryClient.invalidateQueries({ queryKey: ["teacher", "homework-review", classId] });
  }

  const approveMutation = useMutation({
    mutationFn: homeworkService.approveHomework,
    onSuccess: () => {
      invalidate();
      toast.success("Homework approved — students have been notified.");
    },
    onError: (err) => toast.error(getApiErrorMessage(err, "Failed to approve homework.")),
  });

  const requestChangesMutation = useMutation({
    mutationFn: ({ id, note }: { id: string; note: string }) => homeworkService.requestHomeworkChanges(id, note),
    onSuccess: () => {
      invalidate();
      setRequestChangesFor(null);
      setNote("");
      toast.success("Sent back to the teacher for changes.");
    },
    onError: (err) => toast.error(getApiErrorMessage(err, "Failed to request changes.")),
  });

  const deleteMutation = useMutation({
    mutationFn: homeworkService.deleteHomework,
    onSuccess: () => {
      invalidate();
      setPendingDelete(null);
      toast.success("Homework deleted");
    },
  });

  const items = reviewQuery.data ?? [];

  const today = new Date().toISOString().slice(0, 10);
  const todayCount = items.filter((h) => h.created_at.slice(0, 10) === today).length;
  const approvedCount = items.filter((h) => h.status === "approved").length;
  const pendingCount = items.filter((h) => h.status === "pending").length;

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    return items.filter((h) => {
      if (statusFilter !== "all" && h.status !== statusFilter) return false;
      if (!query) return true;
      return (
        h.title.toLowerCase().includes(query) ||
        (h.subjects?.name ?? "").toLowerCase().includes(query) ||
        (h.users?.full_name ?? "").toLowerCase().includes(query)
      );
    });
  }, [items, search, statusFilter]);

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Card className="space-y-1">
          <p className="text-xs font-medium uppercase tracking-wide text-[var(--ink-muted)]">Today's homework</p>
          <p className="text-2xl font-bold text-[var(--ink-primary)]">{todayCount}</p>
        </Card>
        <Card className="space-y-1">
          <p className="text-xs font-medium uppercase tracking-wide text-[var(--ink-muted)]">Recently approved</p>
          <p className="text-2xl font-bold text-[var(--ink-primary)]">{approvedCount}</p>
        </Card>
        <Card className="space-y-1">
          <p className="text-xs font-medium uppercase tracking-wide text-[var(--ink-muted)]">Pending review</p>
          <p className="text-2xl font-bold text-amber-600">{pendingCount}</p>
        </Card>
      </div>

      <Card className="space-y-4">
        <div className="flex flex-wrap items-end gap-4">
          <Select label="Class" options={classOptions} value={classId} onChange={(e) => setClassId(e.target.value)} />
          <div className="min-w-[220px] flex-1">
            <Input
              label="Search"
              placeholder="Title, subject, or teacher"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <Select
            label="Status"
            options={[
              { value: "all", label: "All statuses" },
              { value: "pending", label: "Pending review" },
              { value: "needs_changes", label: "Needs changes" },
              { value: "approved", label: "Approved" },
            ]}
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}
          />
        </div>

        <DataTable<HomeworkItem>
          isLoading={reviewQuery.isLoading}
          rows={filtered}
          rowKey={(h) => h.id}
          emptyMessage="No homework matches this filter."
          columns={[
            { header: "Subject", cell: (h) => h.subjects?.name ?? "—" },
            { header: "Teacher", cell: (h) => h.users?.full_name ?? "—" },
            { header: "Title", cell: (h) => h.title },
            { header: "Submitted", cell: (h) => new Date(h.created_at).toLocaleString() },
            {
              header: "Status",
              cell: (h) => <Badge variant={STATUS_BADGE[h.status].variant}>{STATUS_BADGE[h.status].label}</Badge>,
            },
            {
              header: "",
              cell: (h) => (
                <div className="flex flex-wrap gap-2">
                  <Button variant="ghost" className="!px-2 !py-1 text-xs" onClick={() => setQuickView(h)}>
                    Quick view
                  </Button>
                  {h.status !== "approved" && (
                    <Button
                      variant="secondary"
                      className="!px-2 !py-1 text-xs"
                      isLoading={approveMutation.isPending}
                      onClick={() => approveMutation.mutate(h.id)}
                    >
                      Approve
                    </Button>
                  )}
                  {h.status === "pending" && (
                    <Button variant="ghost" className="!px-2 !py-1 text-xs" onClick={() => setRequestChangesFor(h)}>
                      Request changes
                    </Button>
                  )}
                  <Button variant="ghost" className="!px-2 !py-1 text-xs text-red-600" onClick={() => setPendingDelete(h)}>
                    Delete
                  </Button>
                </div>
              ),
            },
          ]}
        />
      </Card>

      <Modal isOpen={!!quickView} onClose={() => setQuickView(null)} title={quickView?.title ?? "Homework"}>
        {quickView && (
          <div className="space-y-3 text-sm">
            <div className="flex flex-wrap gap-2 text-xs text-[var(--ink-muted)]">
              <span>{quickView.subjects?.name ?? "General"}</span>
              <span>•</span>
              <span>{quickView.classes ? `${quickView.classes.name} - ${quickView.classes.section}` : ""}</span>
              <span>•</span>
              <span>Due {quickView.due_date}</span>
            </div>
            <p className="text-[var(--ink-secondary)]">{quickView.description || "No description provided."}</p>
            {quickView.attachment_url && (
              <a href={quickView.attachment_url} target="_blank" rel="noreferrer" className="inline-block text-brand-600 hover:underline">
                View attachment
              </a>
            )}
            {quickView.review_note && (
              <p className="rounded-md bg-amber-50 p-2 text-amber-700">Review note: {quickView.review_note}</p>
            )}
          </div>
        )}
      </Modal>

      <Modal
        isOpen={!!requestChangesFor}
        onClose={() => {
          setRequestChangesFor(null);
          setNote("");
        }}
        title="Request changes"
      >
        <div className="space-y-4">
          <Textarea
            label="What needs to change?"
            rows={4}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="e.g. Please add the chapter reference and a clearer due date."
          />
          <Button
            className="w-full"
            disabled={!note.trim()}
            isLoading={requestChangesMutation.isPending}
            onClick={() => requestChangesFor && requestChangesMutation.mutate({ id: requestChangesFor.id, note: note.trim() })}
          >
            Send back to teacher
          </Button>
        </div>
      </Modal>

      <ConfirmDialog
        isOpen={!!pendingDelete}
        title="Delete homework"
        message={`Delete "${pendingDelete?.title}"? This cannot be undone.`}
        confirmLabel="Delete"
        isLoading={deleteMutation.isPending}
        onConfirm={() => pendingDelete && deleteMutation.mutate(pendingDelete.id)}
        onCancel={() => setPendingDelete(null)}
      />
    </div>
  );
}
