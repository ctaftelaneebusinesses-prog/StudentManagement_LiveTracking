import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Award, Download, Eye, Printer } from "lucide-react";
import * as wkService from "@/services/websiteKnowledge.service";
import { DataTable, Column } from "@/components/ui/DataTable";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { Modal } from "@/components/ui/Modal";
import { AttemptSummary } from "@/types/websiteKnowledge.types";
import { useAuth } from "@/hooks/useAuth";
import { useSchool } from "@/hooks/useSchool";
import { formatDateTime, formatPercentage, ROLE_LABELS } from "../utils";
import { downloadWebsiteKnowledgeCertificate } from "@/utils/websiteKnowledgeCertificate";
import { useToast } from "@/components/ui/Toast";
import { CertificateDocument } from "./CertificateDocument";

export function MyAttemptsTab() {
  const { user } = useAuth();
  const toast = useToast();
  const { schools, selectedSchool } = useSchool();
  const [previewOpen, setPreviewOpen] = useState(false);
  const attemptsQuery = useQuery({ queryKey: ["website-knowledge", "my-attempts"], queryFn: wkService.listMyAttempts });
  const certificateQuery = useQuery({ queryKey: ["website-knowledge", "my-certificate"], queryFn: wkService.getMyCertificate });

  // The certificate carries its own school_id from when the quiz was taken.
  // For most quiz-taking roles that's the same as `selectedSchool` (one
  // school, via /schools/me) — but a multi-school school_admin can have a
  // *different* school picked in the switcher than the one the certificate
  // was earned under, so look it up by id first and only fall back to
  // whatever's currently selected.
  const certificateSchoolName =
    schools.find((s) => s.id === certificateQuery.data?.school_id)?.name ?? selectedSchool.name;

  async function handleDownload() {
    const cert = certificateQuery.data;
    if (!cert || !user) return;
    try {
      await downloadWebsiteKnowledgeCertificate(cert, user.full_name, certificateSchoolName);
    } catch {
      toast.error("Could not generate the certificate PDF.");
    }
  }

  const columns: Column<AttemptSummary>[] = [
    { header: "Attempt", cell: (r) => `#${r.attempt_number}`, className: "font-semibold" },
    { header: "Date", cell: (r) => formatDateTime(r.completed_at ?? r.started_at) },
    { header: "Question Set", cell: (r) => r.website_knowledge_question_sets?.name ?? "—" },
    { header: "Questions", cell: (r) => r.total_questions },
    { header: "Score", cell: (r) => `${r.correct_answers}/${r.total_questions}` },
    { header: "Percentage", cell: (r) => formatPercentage(r.percentage) },
    {
      header: "Status",
      cell: (r) =>
        r.status === "in_progress" ? (
          <Badge variant="info">In Progress</Badge>
        ) : r.passed ? (
          <Badge variant="success">Passed</Badge>
        ) : (
          <Badge variant="danger">Failed</Badge>
        ),
    },
  ];

  return (
    <div className="space-y-6">
      {certificateQuery.data && (
        <div className="flex flex-col items-start justify-between gap-3 rounded-2xl border border-amber-200 bg-gradient-to-r from-amber-50 to-white p-5 sm:flex-row sm:items-center dark:border-amber-900/40 dark:from-amber-950/20 dark:to-transparent">
          <div className="flex items-center gap-3">
            <span className="flex h-11 w-11 items-center justify-center rounded-full bg-amber-400/20 text-amber-600 dark:text-amber-400">
              <Award size={22} />
            </span>
            <div>
              <div className="font-semibold text-[var(--ink-primary)]">Certificate Available</div>
              <div className="text-xs text-[var(--ink-muted)]">
                {certificateQuery.data.certificate_number} · {certificateQuery.data.percentage}% score
              </div>
            </div>
          </div>
          <div className="flex gap-2">
            <Button variant="ghost" onClick={() => setPreviewOpen(true)}>
              <Eye size={16} className="mr-1.5" /> Preview
            </Button>
            <Button variant="secondary" onClick={handleDownload}>
              <Download size={16} className="mr-1.5" /> Download Certificate
            </Button>
          </div>
        </div>
      )}

      {certificateQuery.data && user && (
        <Modal isOpen={previewOpen} onClose={() => setPreviewOpen(false)} title="Certificate of Website Proficiency" size="xl">
          <div className="space-y-4">
            <CertificateDocument
              schoolName={certificateSchoolName}
              studentName={user.full_name}
              score={`${certificateQuery.data.percentage}%`}
              role={ROLE_LABELS[certificateQuery.data.role_name]}
              date={new Date(certificateQuery.data.issued_at).toLocaleDateString(undefined, { dateStyle: "long" })}
              certificateId={certificateQuery.data.certificate_number}
            />
            <div className="flex justify-end gap-2 print:hidden">
              <Button variant="secondary" onClick={() => window.print()}>
                <Printer size={16} className="mr-1.5" /> Print / Save as PDF
              </Button>
            </div>
          </div>
        </Modal>
      )}

      <div>
        <h3 className="mb-3 text-sm font-semibold text-[var(--ink-primary)]">Attempt History</h3>
        {attemptsQuery.data?.length === 0 && !attemptsQuery.isLoading ? (
          <div className="rounded-2xl border border-dashed border-black/[0.08] dark:border-white/[0.1]">
            <EmptyState icon={Eye} title="No attempts yet" description="Take the assessment to see your history here." />
          </div>
        ) : (
          <DataTable columns={columns} rows={attemptsQuery.data ?? []} rowKey={(r) => r.id} isLoading={attemptsQuery.isLoading} />
        )}
      </div>
    </div>
  );
}
