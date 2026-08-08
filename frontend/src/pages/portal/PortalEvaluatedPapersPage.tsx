import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { FileCheck2 } from "lucide-react";
import { usePortalStudentId } from "@/context/PortalStudentContext";
import * as evaluatedPapersService from "@/services/portal/evaluatedPapers.service";
import { PortalGlassCard } from "./components/ui/PortalGlassCard";
import { PortalSkeleton } from "./components/ui/PortalSkeleton";
import { PortalEmptyState } from "./components/ui/PortalEmptyState";
import { staggerContainer, fadeSlideUp } from "./components/ui/portalMotion";

export function PortalEvaluatedPapersPage() {
  const studentId = usePortalStudentId();
  const papersQuery = useQuery({
    queryKey: ["portal", "evaluated-papers", studentId],
    queryFn: () => evaluatedPapersService.fetchEvaluatedPapers(studentId),
    enabled: !!studentId,
  });

  return (
    <div className="space-y-6">
      <div className="border-l-4 pl-4" style={{ borderColor: "var(--portal-accent)" }}>
        <h1 className="text-2xl font-semibold text-[var(--ink-primary)]">Evaluated Papers</h1>
        <p className="text-sm text-[var(--ink-muted)]">Corrected answer sheets uploaded by your teachers.</p>
      </div>

      <PortalGlassCard noHover className="space-y-4">
        {papersQuery.isLoading ? (
          <PortalSkeleton className="h-48 w-full" />
        ) : !papersQuery.data?.length ? (
          <PortalEmptyState title="No evaluated papers yet" description="Corrected answer sheets your teachers upload will appear here." icon={FileCheck2} />
        ) : (
          <motion.ul variants={staggerContainer} initial="hidden" animate="show" className="space-y-2">
            {papersQuery.data.map((paper) => (
              <motion.li
                key={paper.id}
                variants={fadeSlideUp}
                className="flex flex-wrap items-center justify-between gap-2 rounded-xl border p-3 text-sm"
                style={{ borderColor: "var(--portal-glass-border)" }}
              >
                <div>
                  <p className="font-medium text-[var(--ink-primary)]">
                    {paper.exams?.name ?? "Exam"} — {paper.subjects?.name ?? "Subject"}
                  </p>
                  <p className="text-xs text-[var(--ink-muted)]">
                    {paper.file_name} · Uploaded {new Date(paper.uploaded_at).toLocaleDateString()}
                  </p>
                  {paper.notes && <p className="mt-1 text-xs text-[var(--ink-secondary)]">{paper.notes}</p>}
                </div>
                {paper.url && (
                  <a href={paper.url} target="_blank" rel="noreferrer" className="shrink-0 text-xs font-medium hover:underline" style={{ color: "var(--portal-accent)" }}>
                    View / Download
                  </a>
                )}
              </motion.li>
            ))}
          </motion.ul>
        )}
      </PortalGlassCard>
    </div>
  );
}
