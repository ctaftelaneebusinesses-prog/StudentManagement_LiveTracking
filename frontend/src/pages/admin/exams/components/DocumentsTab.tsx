import { ReactNode, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { FileText, Upload, Trash2, Download } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { DataTable, Column } from "@/components/ui/DataTable";
import { useAuth } from "@/hooks/useAuth";
import * as examDocumentsService from "@/services/admin/examDocuments.service";
import { Exam, ExamDocument, ExamDocumentType } from "@/types/exam.types";
import { EmptyState } from "@/components/ui/EmptyState";
import { ExamsTableSkeleton } from "./ExamsSkeleton";

const DOC_TYPE_OPTIONS: { value: ExamDocumentType; label: string }[] = [
  { value: "question_paper", label: "Question paper" },
  { value: "answer_key", label: "Answer key" },
  { value: "hall_ticket", label: "Hall ticket" },
  { value: "result_sheet", label: "Result sheet" },
  { value: "circular", label: "Circular" },
  { value: "other", label: "Other" },
];

const DOC_TYPE_LABEL: Record<ExamDocumentType, string> = Object.fromEntries(
  DOC_TYPE_OPTIONS.map((o) => [o.value, o.label])
) as Record<ExamDocumentType, string>;

export function DocumentsTab({ exam, picker }: { exam: Exam | null; picker: ReactNode }) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [docType, setDocType] = useState<ExamDocumentType>("question_paper");
  const [notes, setNotes] = useState("");
  const [deletingDoc, setDeletingDoc] = useState<ExamDocument | null>(null);

  const documentsQuery = useQuery({
    queryKey: ["admin", "exams", exam?.id, "documents"],
    queryFn: () => examDocumentsService.fetchExamDocuments(exam!.id),
    enabled: !!exam,
  });

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["admin", "exams", exam?.id, "documents"] });

  const uploadMutation = useMutation({
    mutationFn: (file: File) => examDocumentsService.uploadExamDocument(user!.school_id!, exam!.id, file, docType, notes || undefined),
    onSuccess: () => {
      invalidate();
      setNotes("");
      if (fileInputRef.current) fileInputRef.current.value = "";
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (docId: string) => examDocumentsService.deleteExamDocument(exam!.id, docId),
    onSuccess: () => {
      invalidate();
      setDeletingDoc(null);
    },
  });

  function handleUpload() {
    const file = fileInputRef.current?.files?.[0];
    if (!file) return;
    uploadMutation.mutate(file);
  }

  if (!exam) {
    return (
      <div className="animate-fade-in space-y-4">
        {picker}
        <div className="rounded-2xl border border-black/[0.06] bg-white py-4 dark:border-white/[0.08] dark:bg-[#17171a]">
          <EmptyState icon={FileText} title="Select an exam" description="Choose an exam above to upload or manage its documents." />
        </div>
      </div>
    );
  }

  const documents = documentsQuery.data ?? [];

  const columns: Column<ExamDocument>[] = [
    { header: "Type", cell: (d) => DOC_TYPE_LABEL[d.doc_type] ?? d.doc_type },
    { header: "File", cell: (d) => <span className="font-medium text-[var(--ink-primary)]">{d.file_name}</span> },
    { header: "Notes", cell: (d) => d.notes ?? "—" },
    { header: "Uploaded", cell: (d) => new Date(d.uploaded_at).toLocaleDateString() },
    {
      header: "",
      cell: (d) => (
        <div className="flex justify-end gap-1.5">
          {d.url && (
            <a href={d.url} target="_blank" rel="noreferrer" aria-label="Download document">
              <Button variant="ghost" className="!px-2 !py-1 text-xs">
                <Download size={14} />
              </Button>
            </a>
          )}
          <Button
            variant="ghost"
            className="!px-2 !py-1 text-xs text-red-600 hover:bg-red-500/10"
            onClick={() => setDeletingDoc(d)}
            aria-label="Delete document"
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
      {picker}

      <div className="rounded-2xl border border-black/[0.06] bg-white p-5 dark:border-white/[0.08] dark:bg-[#17171a]">
        <h3 className="text-sm font-semibold text-[var(--ink-primary)]">Upload document</h3>
        <p className="mt-1 text-xs text-[var(--ink-muted)]">Question papers, answer keys, hall tickets, result sheets, and more (PDF or other files).</p>
        <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-[1fr_1fr_auto]">
          <Select
            label="Document type"
            options={DOC_TYPE_OPTIONS}
            value={docType}
            onChange={(e) => setDocType(e.target.value as ExamDocumentType)}
          />
          <Input label="Notes (optional)" value={notes} onChange={(e) => setNotes(e.target.value)} />
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-[var(--ink-secondary)]">File</label>
            <input ref={fileInputRef} type="file" accept="application/pdf,image/*,.doc,.docx" className="text-sm text-[var(--ink-secondary)]" />
          </div>
        </div>
        {uploadMutation.isError && <p className="mt-2 text-sm text-red-600">Failed to upload document.</p>}
        <Button className="mt-4" onClick={handleUpload} isLoading={uploadMutation.isPending}>
          <Upload size={16} /> Upload
        </Button>
      </div>

      {documentsQuery.isLoading ? (
        <ExamsTableSkeleton />
      ) : documents.length === 0 ? (
        <div className="rounded-2xl border border-black/[0.06] bg-white py-4 dark:border-white/[0.08] dark:bg-[#17171a]">
          <EmptyState icon={FileText} title="No documents uploaded" description="Upload a question paper, hall ticket, or result sheet to get started." />
        </div>
      ) : (
        <div className="rounded-2xl border border-black/[0.06] bg-white p-2 dark:border-white/[0.08] dark:bg-[#17171a]">
          <DataTable<ExamDocument> columns={columns} rows={documents} rowKey={(d) => d.id} isLoading={false} />
        </div>
      )}

      <ConfirmDialog
        isOpen={!!deletingDoc}
        title="Delete document"
        message={`Delete "${deletingDoc?.file_name}"? This cannot be undone.`}
        confirmLabel="Delete"
        isLoading={deleteMutation.isPending}
        onConfirm={() => deletingDoc && deleteMutation.mutate(deletingDoc.id)}
        onCancel={() => setDeletingDoc(null)}
      />
    </div>
  );
}
