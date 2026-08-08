import { useRef, useState } from "react";
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

// Light-surface variant (original icon color + black wordmark) — matches the
// certificate's fixed ivory paper, same reasoning as CertificateDocument's
// own footer (<PoweredByCraftLanee surface="light" />).
const CERTIFICATE_LOGO_SRC = "/craftlanee-logo-dark.png";
// Fixed capture width for the off-screen render below — decouples the
// downloaded PDF's resolution from whatever width the on-screen preview
// happens to be at (e.g. a narrow phone viewport), so it's always crisp.
const CERTIFICATE_CAPTURE_WIDTH = 1040;

export function MyAttemptsTab() {
  const { user } = useAuth();
  const toast = useToast();
  const { schools, selectedSchool } = useSchool();
  const [previewOpen, setPreviewOpen] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const captureRef = useRef<HTMLDivElement>(null);
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
    const node = captureRef.current;
    if (!cert || !node) return;
    setDownloading(true);
    try {
      // Rasterizes the same <CertificateDocument> rendered below — see
      // utils/websiteKnowledgeCertificate.ts for why this replaced a
      // separately hand-drawn jsPDF layout (it had drifted out of sync with
      // this on-screen design).
      await downloadWebsiteKnowledgeCertificate(node, cert);
    } catch {
      toast.error("Could not generate the certificate PDF.");
    } finally {
      setDownloading(false);
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
            <Button variant="secondary" isLoading={downloading} onClick={handleDownload}>
              <Download size={16} className="mr-1.5" /> Download Certificate
            </Button>
          </div>
        </div>
      )}

      {certificateQuery.data && user && (
        <Modal isOpen={previewOpen} onClose={() => setPreviewOpen(false)} title="Certificate of Website Proficiency" size="2xl">
          <div className="space-y-4">
            <CertificateDocument
              schoolName={certificateSchoolName}
              studentName={user.full_name}
              score={`${certificateQuery.data.percentage}%`}
              role={ROLE_LABELS[certificateQuery.data.role_name]}
              date={new Date(certificateQuery.data.issued_at).toLocaleDateString(undefined, { dateStyle: "long" })}
              certificateId={certificateQuery.data.certificate_number}
              logoSrc={CERTIFICATE_LOGO_SRC}
            />
            <div className="flex justify-end gap-2 print:hidden">
              <Button variant="secondary" onClick={() => window.print()}>
                <Printer size={16} className="mr-1.5" /> Print / Save as PDF
              </Button>
              <Button isLoading={downloading} onClick={handleDownload}>
                <Download size={16} className="mr-1.5" /> Download Certificate
              </Button>
            </div>
          </div>
        </Modal>
      )}

      {/*
        Off-screen twin of the certificate above, always mounted at a fixed
        1040px width whenever a certificate exists — the actual source
        html2canvas rasterizes for the "Download Certificate" button (see
        handleDownload), so the downloaded PDF is byte-for-byte the same
        design as the preview regardless of what width the preview modal
        happens to be rendered at (narrow phone vs. wide desktop).
      */}
      {certificateQuery.data && user && (
        // Moved off-screen via a large negative offset, NOT opacity-0 or
        // visibility:hidden — html2canvas renders exactly what the browser
        // would paint, so either of those would capture a blank canvas.
        <div aria-hidden className="pointer-events-none fixed -left-[10000px] top-0" style={{ width: CERTIFICATE_CAPTURE_WIDTH }}>
          <div ref={captureRef}>
            <CertificateDocument
              schoolName={certificateSchoolName}
              studentName={user.full_name}
              score={`${certificateQuery.data.percentage}%`}
              role={ROLE_LABELS[certificateQuery.data.role_name]}
              date={new Date(certificateQuery.data.issued_at).toLocaleDateString(undefined, { dateStyle: "long" })}
              certificateId={certificateQuery.data.certificate_number}
              logoSrc={CERTIFICATE_LOGO_SRC}
            />
          </div>
        </div>
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
