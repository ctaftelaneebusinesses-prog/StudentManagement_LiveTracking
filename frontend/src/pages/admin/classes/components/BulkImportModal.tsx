import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { FileSpreadsheet, CheckCircle2, XCircle, Download } from "lucide-react";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import * as studentsService from "@/services/admin/students.service";
import { parseStudentsWorkbook, ParseStudentsWorkbookResult } from "@/utils/importStudents";
import { BulkCreateStudentsResult, ClassRoom } from "@/types/admin.types";

const TEMPLATE_CSV =
  "Full Name,Email,Admission No,Roll No,Class,Section,Gender,Date of Birth,Phone,Address\n" +
  "Jane Doe,jane.doe@example.com,1024,12,1,A,female,2015-04-12,9876543210,123 Main Street\n";

function downloadTemplate() {
  const blob = new Blob([TEMPLATE_CSV], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = "student-import-template.csv";
  link.click();
  URL.revokeObjectURL(url);
}

interface BulkImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  /** When omitted (e.g. importing from the main Students page rather than a class's Students tab), unmatched/blank rows are simply left unassigned. */
  classId?: string;
  classes: ClassRoom[];
  onImported: () => void;
}

export function BulkImportModal({ isOpen, onClose, classId, classes, onImported }: BulkImportModalProps) {
  const [parsed, setParsed] = useState<ParseStudentsWorkbookResult | null>(null);
  const [isParsing, setParsing] = useState(false);
  const [result, setResult] = useState<BulkCreateStudentsResult | null>(null);

  const importMutation = useMutation({
    mutationFn: () =>
      studentsService.bulkCreateStudents(
        (parsed?.rows ?? []).map((r) => ({ ...r.input, class_id: r.input.class_id ?? classId }))
      ),
    onSuccess: (data) => {
      setResult(data);
      onImported();
    },
  });

  function reset() {
    setParsed(null);
    setResult(null);
  }

  function handleClose() {
    reset();
    onClose();
  }

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setParsing(true);
    setResult(null);
    try {
      const parseResult = await parseStudentsWorkbook(file, classes);
      setParsed(parseResult);
    } finally {
      setParsing(false);
      e.target.value = "";
    }
  }

  return (
    <Modal isOpen={isOpen} onClose={handleClose} title="Bulk import students">
      {!parsed && !result && (
        <div className="space-y-4">
          <p className="text-sm text-[var(--ink-muted)]">
            Upload an .xlsx or .csv file. Accepted columns: <strong>Full Name</strong>, <strong>Email</strong>,{" "}
            <strong>Admission No</strong>, and optionally Roll No, Class, Section, Gender, Date of Birth, Phone,
            Address. {classId ? "Rows without a matching class default to this class." : "Rows without a matching class are imported unassigned."}
          </p>
          <button
            type="button"
            onClick={downloadTemplate}
            className="flex items-center gap-1.5 text-sm font-medium text-brand-600 hover:underline dark:text-brand-400"
          >
            <Download size={14} /> Download sample template
          </button>
          <label className="flex cursor-pointer flex-col items-center gap-2 rounded-xl border-2 border-dashed border-slate-300 px-6 py-10 text-center transition-colors hover:border-accent-400 dark:border-white/15 dark:hover:border-accent-500">
            <FileSpreadsheet size={28} className="text-[var(--ink-muted)]" />
            <span className="text-sm font-medium text-[var(--ink-primary)]">
              {isParsing ? "Reading file…" : "Click to choose a file"}
            </span>
            <input
              type="file"
              accept=".xlsx,.xls,.csv"
              className="hidden"
              disabled={isParsing}
              onChange={handleFileChange}
            />
          </label>
        </div>
      )}

      {parsed && !result && (
        <div className="space-y-4">
          <div className="flex gap-4 text-sm">
            <span className="flex items-center gap-1.5 text-[var(--delta-good)]">
              <CheckCircle2 size={16} /> {parsed.rows.length} ready to import
            </span>
            {parsed.errors.length > 0 && (
              <span className="flex items-center gap-1.5 text-[var(--delta-bad)]">
                <XCircle size={16} /> {parsed.errors.length} issue{parsed.errors.length === 1 ? "" : "s"}
              </span>
            )}
          </div>

          {parsed.errors.length > 0 && (
            <div className="max-h-32 overflow-y-auto rounded-lg border border-red-500/20 bg-red-500/[0.04] p-2 text-xs">
              {parsed.errors.map((e, i) => (
                <p key={i} className="text-[var(--ink-secondary)]">
                  Row {e.rowNumber}: {e.message}
                </p>
              ))}
            </div>
          )}

          {parsed.rows.length > 0 && (
            <div className="max-h-56 overflow-y-auto rounded-lg border border-black/[0.06] dark:border-white/[0.08]">
              <table className="min-w-full text-xs">
                <thead className="bg-slate-50 text-left text-[var(--ink-muted)] dark:bg-white/5">
                  <tr>
                    <th className="px-3 py-2">Name</th>
                    <th className="px-3 py-2">Email</th>
                    <th className="px-3 py-2">Admission No</th>
                    <th className="px-3 py-2">Class</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-black/[0.05] dark:divide-white/[0.06]">
                  {parsed.rows.map((r) => (
                    <tr key={r.rowNumber}>
                      <td className="px-3 py-2 text-[var(--ink-primary)]">{r.input.full_name}</td>
                      <td className="px-3 py-2 text-[var(--ink-secondary)]">{r.input.email}</td>
                      <td className="px-3 py-2 text-[var(--ink-secondary)]">{r.input.admission_no}</td>
                      <td className="px-3 py-2 text-[var(--ink-secondary)]">{r.classLabel ?? "This class"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {importMutation.isError && (
            <p className="text-sm text-red-600">Something went wrong submitting the import.</p>
          )}

          <div className="flex justify-end gap-3">
            <Button variant="secondary" onClick={reset}>
              Choose a different file
            </Button>
            <Button
              disabled={parsed.rows.length === 0}
              isLoading={importMutation.isPending}
              onClick={() => importMutation.mutate()}
            >
              Import {parsed.rows.length} student{parsed.rows.length === 1 ? "" : "s"}
            </Button>
          </div>
        </div>
      )}

      {result && (
        <div className="space-y-4">
          <div className="flex gap-4 text-sm">
            <span className="flex items-center gap-1.5 text-[var(--delta-good)]">
              <CheckCircle2 size={16} /> {result.created.length} created
            </span>
            {result.failed.length > 0 && (
              <span className="flex items-center gap-1.5 text-[var(--delta-bad)]">
                <XCircle size={16} /> {result.failed.length} failed
              </span>
            )}
          </div>
          {result.failed.length > 0 && (
            <div className="max-h-40 overflow-y-auto rounded-lg border border-red-500/20 bg-red-500/[0.04] p-2 text-xs">
              {result.failed.map((f, i) => (
                <p key={i} className="text-[var(--ink-secondary)]">
                  {f.admission_no ?? f.email ?? `Row ${f.index + 1}`}: {f.message}
                </p>
              ))}
            </div>
          )}
          <Button className="w-full" onClick={handleClose}>
            Done
          </Button>
        </div>
      )}
    </Modal>
  );
}
