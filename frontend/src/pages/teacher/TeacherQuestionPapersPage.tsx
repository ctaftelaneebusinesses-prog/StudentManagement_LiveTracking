import { useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { FileText, PenLine, Upload } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { Card } from "@/components/ui/Card";
import { Select } from "@/components/ui/Select";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { DataTable } from "@/components/ui/DataTable";
import { Badge } from "@/components/ui/Badge";
import { Tabs } from "@/components/ui/Tabs";
import { useToast } from "@/components/ui/Toast";
import { getApiErrorMessage } from "@/lib/axios";
import { RichTextEditor } from "@/pages/admin/announcements/components/RichTextEditor";
import * as portalService from "@/services/teacher/portal.service";
import * as assessmentsService from "@/services/teacher/assessments.service";
import * as questionPapersService from "@/services/teacher/questionPapers.service";
import { ExamDocument } from "@/types/exam.types";
import { QuestionPaperRecord, TeacherClassSummary } from "@/types/teacher.types";

export function TeacherQuestionPapersPage() {
  const dashboardQuery = useQuery({ queryKey: ["teacher", "dashboard"], queryFn: portalService.fetchDashboard });
  const classes = dashboardQuery.data?.classes ?? [];
  const homeroomClasses = classes.filter((c) => c.isHomeroom);
  const [tab, setTab] = useState<"mine" | "class">("mine");
  const showClassTab = homeroomClasses.length > 0;
  const activeTab = showClassTab ? tab : "mine";

  return (
    <div className="animate-fade-in space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-[var(--ink-primary)]">Question Papers</h1>
        <p className="text-sm text-[var(--ink-muted)]">
          {showClassTab
            ? "Write or upload question papers for your assessments — only you, your class teacher, and school staff can see them until published."
            : "Write or upload question papers for the assessments you create — private until your class teacher publishes them."}
        </p>
      </div>

      {showClassTab && (
        <Tabs
          tabs={[
            { key: "mine", label: "My Question Papers" },
            { key: "class", label: "Class Papers" },
          ]}
          active={activeTab}
          onChange={setTab}
        />
      )}

      {activeTab === "mine" ? <MyQuestionPapersPanel classes={classes} /> : <ClassQuestionPapersPanel homeroomClasses={homeroomClasses} />}
    </div>
  );
}

function StatusBadge({ isPublished }: { isPublished: boolean }) {
  return <Badge variant={isPublished ? "success" : "neutral"}>{isPublished ? "Published" : "Private"}</Badge>;
}

/** Shared "View" modal — renders composed HTML content inline, or links out to the uploaded file. */
function ViewDocumentModal({ doc, onClose }: { doc: ExamDocument | QuestionPaperRecord | null; onClose: () => void }) {
  return (
    <Modal isOpen={!!doc} onClose={onClose} title={doc?.file_name ?? "Question paper"} size="xl">
      {doc?.content ? (
        <div
          className="prose max-w-none text-sm text-slate-800 dark:text-slate-100 [&_h2]:text-lg [&_h2]:font-semibold [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:list-decimal [&_ol]:pl-5"
          dangerouslySetInnerHTML={{ __html: doc.content }}
        />
      ) : doc?.url ? (
        <a href={doc.url} target="_blank" rel="noreferrer" className="text-sm text-brand-600 hover:underline">
          Open file in a new tab
        </a>
      ) : (
        <p className="text-sm text-slate-500">This file isn't available to preview.</p>
      )}
    </Modal>
  );
}

interface AssessmentFormValues {
  class_id: string;
  subject_id: string;
  name: string;
  exam_date: string;
}

function MyQuestionPapersPanel({ classes }: { classes: TeacherClassSummary[] }) {
  const queryClient = useQueryClient();
  const toast = useToast();
  const { user } = useAuth();
  const [isCreateOpen, setCreateOpen] = useState(false);
  const [selectedExamId, setSelectedExamId] = useState("");
  const [mode, setMode] = useState<"upload" | "write">("upload");
  const [notes, setNotes] = useState("");
  const [composedContent, setComposedContent] = useState("");
  const [pendingDelete, setPendingDelete] = useState<ExamDocument | null>(null);
  const [viewingDoc, setViewingDoc] = useState<ExamDocument | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const assessmentsQuery = useQuery({ queryKey: ["teacher", "assessments"], queryFn: assessmentsService.fetchMyAssessments });
  const assessmentOptions = (assessmentsQuery.data ?? []).map((a) => ({
    value: a.id,
    label: `${a.name} — ${a.classes ? `${a.classes.name} ${a.classes.section}` : ""} ${a.subjects ? `(${a.subjects.name})` : ""}`,
  }));

  const documentsQuery = useQuery({
    queryKey: ["teacher", "question-papers", selectedExamId],
    queryFn: () => questionPapersService.fetchQuestionPapersForExam(selectedExamId),
    enabled: !!selectedExamId,
  });

  const { register, handleSubmit, reset, watch } = useForm<AssessmentFormValues>({
    defaultValues: { class_id: "", subject_id: "", name: "", exam_date: "" },
  });
  const selectedClass = classes.find((c) => c.id === watch("class_id"));
  const subjectOptions = (selectedClass?.subjects ?? []).map((s) => ({ value: s.id, label: `${s.name} (${s.code})` }));
  const classOptions = classes.map((c) => ({ value: c.id, label: `${c.name} - ${c.section}` }));

  const createAssessmentMutation = useMutation({
    mutationFn: assessmentsService.createAssessment,
    onSuccess: (assessment) => {
      queryClient.invalidateQueries({ queryKey: ["teacher", "assessments"] });
      setSelectedExamId(assessment.id);
      setCreateOpen(false);
      reset();
      toast.success("Assessment created — you can now write or upload its question paper below.");
    },
    onError: (err) => toast.error(getApiErrorMessage(err, "Failed to create assessment.")),
  });

  function invalidateDocs() {
    queryClient.invalidateQueries({ queryKey: ["teacher", "question-papers", selectedExamId] });
  }

  const uploadMutation = useMutation({
    mutationFn: (file: File) => questionPapersService.uploadQuestionPaper(user?.school_id ?? "", selectedExamId, file, notes || undefined),
    onSuccess: () => {
      invalidateDocs();
      setNotes("");
      if (fileInputRef.current) fileInputRef.current.value = "";
      toast.success("Question paper uploaded.");
    },
    onError: (err) => toast.error(getApiErrorMessage(err, "Failed to upload question paper.")),
  });

  const composeMutation = useMutation({
    mutationFn: () => questionPapersService.composeQuestionPaper(selectedExamId, composedContent, notes || undefined),
    onSuccess: () => {
      invalidateDocs();
      setNotes("");
      setComposedContent("");
      toast.success("Question paper saved.");
    },
    onError: (err) => toast.error(getApiErrorMessage(err, "Failed to save question paper.")),
  });

  const deleteMutation = useMutation({
    mutationFn: (docId: string) => questionPapersService.deleteQuestionPaper(selectedExamId, docId),
    onSuccess: () => {
      invalidateDocs();
      setPendingDelete(null);
      toast.success("Question paper deleted.");
    },
  });

  function handleUpload() {
    const file = fileInputRef.current?.files?.[0];
    if (!file) {
      toast.error("Choose a file to upload first.");
      return;
    }
    uploadMutation.mutate(file);
  }

  function handleCompose() {
    if (!composedContent || composedContent === "<p></p>") {
      toast.error("Write the question paper content first.");
      return;
    }
    composeMutation.mutate();
  }

  return (
    <div className="space-y-6">
      <Card className="space-y-4">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div className="min-w-[280px] flex-1">
            <Select
              label="Assessment (Academic Year / Class / Section / Subject / Exam Name)"
              placeholder="Select an assessment"
              options={assessmentOptions}
              value={selectedExamId}
              onChange={(e) => setSelectedExamId(e.target.value)}
            />
          </div>
          <Button variant="secondary" onClick={() => setCreateOpen(true)}>
            Create new assessment
          </Button>
        </div>

        {!selectedExamId ? (
          <p className="text-sm text-[var(--ink-muted)]">Select or create an assessment to manage its question paper.</p>
        ) : (
          <div className="space-y-4">
            <div className="flex gap-1 rounded-lg border border-black/[0.06] bg-black/[0.02] p-1 dark:border-white/[0.08] dark:bg-white/[0.03]">
              <button
                type="button"
                onClick={() => setMode("upload")}
                className={`inline-flex flex-1 items-center justify-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                  mode === "upload" ? "bg-white shadow-sm dark:bg-[#232326]" : "text-[var(--ink-muted)]"
                }`}
              >
                <Upload size={14} strokeWidth={1.75} /> Upload a file
              </button>
              <button
                type="button"
                onClick={() => setMode("write")}
                className={`inline-flex flex-1 items-center justify-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                  mode === "write" ? "bg-white shadow-sm dark:bg-[#232326]" : "text-[var(--ink-muted)]"
                }`}
              >
                <PenLine size={14} strokeWidth={1.75} /> Write it here
              </button>
            </div>

            {mode === "upload" ? (
              <div className="flex flex-wrap items-end gap-3 rounded-lg border border-black/[0.06] p-3 dark:border-white/[0.08]">
                <div className="flex flex-col gap-1.5">
                  <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Upload PDF or document</label>
                  <input ref={fileInputRef} type="file" accept=".pdf,.doc,.docx" className="text-sm" />
                </div>
                <div className="min-w-[200px] flex-1">
                  <Input label="Notes (optional)" value={notes} onChange={(e) => setNotes(e.target.value)} />
                </div>
                <Button isLoading={uploadMutation.isPending} onClick={handleUpload}>
                  Upload
                </Button>
              </div>
            ) : (
              <div className="space-y-3 rounded-lg border border-black/[0.06] p-3 dark:border-white/[0.08]">
                <RichTextEditor value={composedContent} onChange={setComposedContent} placeholder="Type or paste the question paper here…" />
                <div className="flex flex-wrap items-end gap-3">
                  <div className="min-w-[200px] flex-1">
                    <Input label="Notes (optional)" value={notes} onChange={(e) => setNotes(e.target.value)} />
                  </div>
                  <Button isLoading={composeMutation.isPending} onClick={handleCompose}>
                    Save question paper
                  </Button>
                </div>
              </div>
            )}

            <DataTable<ExamDocument>
              isLoading={documentsQuery.isLoading}
              rows={documentsQuery.data ?? []}
              rowKey={(d) => d.id}
              emptyMessage="No question paper for this assessment yet."
              columns={[
                {
                  header: "File",
                  cell: (d) => (
                    <span className="inline-flex items-center gap-1.5">
                      <FileText size={14} strokeWidth={1.75} className="text-[var(--ink-muted)]" />
                      {d.file_name ?? (d.content ? "Written question paper" : "Question paper")}
                    </span>
                  ),
                },
                { header: "Notes", cell: (d) => d.notes ?? "—" },
                { header: "Status", cell: (d) => <StatusBadge isPublished={d.is_published} /> },
                { header: "Uploaded", cell: (d) => new Date(d.uploaded_at).toLocaleString() },
                {
                  header: "",
                  cell: (d) => (
                    <div className="flex gap-2">
                      <button type="button" className="text-xs text-brand-600 hover:underline" onClick={() => setViewingDoc(d)}>
                        View
                      </button>
                      <button
                        type="button"
                        className="text-xs text-red-600 hover:underline"
                        onClick={() => setPendingDelete(d)}
                      >
                        Delete
                      </button>
                    </div>
                  ),
                },
              ]}
            />
          </div>
        )}
      </Card>

      <Modal isOpen={isCreateOpen} onClose={() => setCreateOpen(false)} title="Create assessment">
        <form
          className="space-y-4"
          onSubmit={handleSubmit((values) =>
            createAssessmentMutation.mutate({
              class_id: values.class_id,
              subject_id: values.subject_id,
              name: values.name,
              exam_date: values.exam_date,
            })
          )}
        >
          <Select label="Class" placeholder="Select class" options={classOptions} {...register("class_id", { required: true })} />
          <Select label="Subject" placeholder="Select subject" options={subjectOptions} {...register("subject_id", { required: true })} />
          <Input label="Exam name" placeholder="e.g. Unit Test 1" {...register("name", { required: true })} />
          <Input label="Exam date" type="date" {...register("exam_date", { required: true })} />
          {createAssessmentMutation.isError && (
            <p className="text-sm text-red-600">{getApiErrorMessage(createAssessmentMutation.error, "Failed to create assessment.")}</p>
          )}
          <Button type="submit" className="w-full" isLoading={createAssessmentMutation.isPending}>
            Create assessment
          </Button>
        </form>
      </Modal>

      <ViewDocumentModal doc={viewingDoc} onClose={() => setViewingDoc(null)} />

      <ConfirmDialog
        isOpen={!!pendingDelete}
        title="Delete question paper"
        message="Delete this question paper? This cannot be undone."
        confirmLabel="Delete"
        isLoading={deleteMutation.isPending}
        onConfirm={() => pendingDelete && deleteMutation.mutate(pendingDelete.id)}
        onCancel={() => setPendingDelete(null)}
      />
    </div>
  );
}

function ClassQuestionPapersPanel({ homeroomClasses }: { homeroomClasses: TeacherClassSummary[] }) {
  const queryClient = useQueryClient();
  const toast = useToast();
  const [classId, setClassId] = useState(homeroomClasses[0]?.id ?? "");
  const [viewingDoc, setViewingDoc] = useState<QuestionPaperRecord | null>(null);

  const papersQuery = useQuery({
    queryKey: ["teacher", "class-question-papers", classId],
    queryFn: () => questionPapersService.fetchClassQuestionPapers(classId),
    enabled: !!classId,
  });

  const publishMutation = useMutation({
    mutationFn: ({ examId, docId, isPublished }: { examId: string; docId: string; isPublished: boolean }) =>
      questionPapersService.publishQuestionPaper(examId, docId, isPublished),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["teacher", "class-question-papers", classId] });
      toast.success(variables.isPublished ? "Published to the class." : "Unpublished.");
    },
    onError: (err) => toast.error(getApiErrorMessage(err, "Failed to update publish status.")),
  });

  const classOptions = homeroomClasses.map((c) => ({ value: c.id, label: `${c.name} - ${c.section}` }));

  return (
    <Card className="space-y-4">
      <Select label="Class" options={classOptions} value={classId} onChange={(e) => setClassId(e.target.value)} />

      <DataTable<QuestionPaperRecord>
        isLoading={papersQuery.isLoading}
        rows={papersQuery.data ?? []}
        rowKey={(d) => d.id}
        emptyMessage="No question papers uploaded for this class yet."
        columns={[
          { header: "Exam", cell: (d) => d.exams?.name ?? "—" },
          { header: "Subject", cell: (d) => d.exams?.subjects?.name ?? "—" },
          { header: "File", cell: (d) => d.file_name ?? (d.content ? "Written question paper" : "Question paper") },
          { header: "Status", cell: (d) => <StatusBadge isPublished={d.is_published} /> },
          { header: "Uploaded", cell: (d) => new Date(d.uploaded_at).toLocaleString() },
          {
            header: "",
            cell: (d) =>
              d.exams ? (
                <div className="flex flex-wrap gap-2">
                  <button type="button" className="text-xs text-brand-600 hover:underline" onClick={() => setViewingDoc(d)}>
                    View
                  </button>
                  <Button
                    variant="ghost"
                    className="!px-2 !py-1 text-xs"
                    isLoading={publishMutation.isPending}
                    onClick={() =>
                      publishMutation.mutate({ examId: d.exams!.id, docId: d.id, isPublished: !d.is_published })
                    }
                  >
                    {d.is_published ? "Unpublish" : "Publish"}
                  </Button>
                </div>
              ) : null,
          },
        ]}
      />

      <ViewDocumentModal doc={viewingDoc} onClose={() => setViewingDoc(null)} />
    </Card>
  );
}
