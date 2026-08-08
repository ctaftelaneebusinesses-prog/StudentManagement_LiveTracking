import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { FileText } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { useToast } from "@/components/ui/Toast";
import { useSchool } from "@/hooks/useSchool";
import { usePortalStudentId } from "@/context/PortalStudentContext";
import * as reportsService from "@/services/portal/reports.service";
import { downloadReportCardPdf } from "@/utils/reportCard";
import { getApiErrorMessage } from "@/lib/axios";
import { PortalGlassCard } from "./components/ui/PortalGlassCard";
import { PortalSkeleton } from "./components/ui/PortalSkeleton";
import { PortalEmptyState } from "./components/ui/PortalEmptyState";
import { PortalProgressBar } from "./components/ui/PortalProgressBar";
import { staggerContainer, fadeSlideUp } from "./components/ui/portalMotion";

export function PortalReportsPage() {
  const studentId = usePortalStudentId();
  const { selectedSchool } = useSchool();
  const toast = useToast();

  const reportQuery = useQuery({
    queryKey: ["portal", "report-card", studentId],
    queryFn: () => reportsService.fetchReportCard(studentId),
    enabled: !!studentId,
  });

  async function handleDownload() {
    if (!reportQuery.data) return;
    try {
      await downloadReportCardPdf(reportQuery.data, selectedSchool.name);
    } catch (err) {
      toast.error(getApiErrorMessage(err, "Failed to generate the report card."));
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3 border-l-4 pl-4" style={{ borderColor: "var(--portal-accent)" }}>
        <div>
          <h1 className="text-2xl font-semibold text-[var(--ink-primary)]">Reports</h1>
          <p className="text-sm text-[var(--ink-muted)]">Attendance and exam-wise academic reports.</p>
        </div>
        {reportQuery.data && (
          <Button onClick={handleDownload}>
            <FileText size={15} className="mr-1.5 inline" strokeWidth={1.75} />
            Download report card (PDF)
          </Button>
        )}
      </div>

      {reportQuery.isLoading ? (
        <PortalSkeleton className="h-64 w-full" />
      ) : !reportQuery.data ? (
        <PortalGlassCard noHover>
          <PortalEmptyState title="Report card not available yet" icon={FileText} />
        </PortalGlassCard>
      ) : (
        <motion.div variants={staggerContainer} initial="hidden" animate="show" className="space-y-6">
          <motion.div variants={fadeSlideUp}>
            <PortalGlassCard noHover className="space-y-2">
              <h2 className="text-lg font-semibold text-[var(--ink-primary)]">Attendance</h2>
              <p className="text-3xl font-semibold text-[var(--ink-primary)]">
                {reportQuery.data.attendance.percentage !== null ? `${reportQuery.data.attendance.percentage}%` : "—"}
              </p>
              {reportQuery.data.attendance.percentage !== null && <PortalProgressBar percent={reportQuery.data.attendance.percentage} />}
            </PortalGlassCard>
          </motion.div>

          {reportQuery.data.marks.exams.length === 0 ? (
            <motion.div variants={fadeSlideUp}>
              <PortalGlassCard noHover>
                <PortalEmptyState
                  title="No exam reports published yet"
                  description="Unit test, quarterly, half-yearly, and annual reports will appear here once published."
                  icon={FileText}
                />
              </PortalGlassCard>
            </motion.div>
          ) : (
            reportQuery.data.marks.exams.map((exam) => (
              <motion.div key={exam.examId} variants={fadeSlideUp}>
                <PortalGlassCard noHover className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-base font-semibold text-[var(--ink-primary)]">{exam.examName}</h3>
                      {exam.examDate && <p className="text-xs text-[var(--ink-muted)]">{exam.examDate}</p>}
                    </div>
                    <p className="text-xl font-semibold text-[var(--ink-primary)]">{exam.percentage !== null ? `${exam.percentage}%` : "—"}</p>
                  </div>
                  {exam.percentage !== null && <PortalProgressBar percent={exam.percentage} />}
                  <ul className="space-y-1 text-sm">
                    {exam.subjects.map((s) => (
                      <li key={s.subjectId} className="flex justify-between border-b py-1" style={{ borderColor: "var(--portal-glass-border)" }}>
                        <span className="text-[var(--ink-muted)]">{s.subjectName}</span>
                        <span className="text-[var(--ink-primary)]">
                          {s.marksObtained} / {s.maxMarks} {s.grade ? `(${s.grade})` : ""}
                        </span>
                      </li>
                    ))}
                  </ul>
                </PortalGlassCard>
              </motion.div>
            ))
          )}
        </motion.div>
      )}
    </div>
  );
}
