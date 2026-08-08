import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { GraduationCap } from "lucide-react";
import { DataTable } from "@/components/ui/DataTable";
import { usePortalStudentId } from "@/context/PortalStudentContext";
import * as marksService from "@/services/portal/marks.service";
import { PortalGlassCard } from "./components/ui/PortalGlassCard";
import { PortalSkeleton } from "./components/ui/PortalSkeleton";
import { PortalEmptyState } from "./components/ui/PortalEmptyState";
import { PortalProgressBar } from "./components/ui/PortalProgressBar";
import { staggerContainer, fadeSlideUp } from "./components/ui/portalMotion";

export function PortalMarksPage() {
  const studentId = usePortalStudentId();
  const marksQuery = useQuery({
    queryKey: ["portal", "marks", studentId],
    queryFn: () => marksService.fetchMarks(studentId),
    enabled: !!studentId,
  });

  const byExam = useMemo(() => {
    const groups = new Map<string, { examName: string; examDate: string | null; rows: typeof marksQuery.data }>();
    for (const row of marksQuery.data ?? []) {
      const key = row.exam_id;
      if (!groups.has(key)) groups.set(key, { examName: row.exams?.name ?? "Exam", examDate: row.exams?.exam_date ?? null, rows: [] });
      groups.get(key)!.rows!.push(row);
    }
    return Array.from(groups.values()).sort((a, b) => (b.examDate ?? "").localeCompare(a.examDate ?? ""));
  }, [marksQuery.data]);

  return (
    <div className="space-y-6">
      <div className="border-l-4 pl-4" style={{ borderColor: "var(--portal-accent)" }}>
        <h1 className="text-2xl font-semibold text-[var(--ink-primary)]">Marks</h1>
        <p className="text-sm text-[var(--ink-muted)]">Subject-wise marks for every exam published so far.</p>
      </div>

      {marksQuery.isLoading ? (
        <div className="space-y-4">
          {Array.from({ length: 2 }).map((_, i) => (
            <PortalSkeleton key={i} className="h-48 w-full" />
          ))}
        </div>
      ) : byExam.length === 0 ? (
        <PortalGlassCard noHover>
          <PortalEmptyState title="No marks published yet" description="Results will appear here once your teacher publishes them." icon={GraduationCap} />
        </PortalGlassCard>
      ) : (
        <motion.div variants={staggerContainer} initial="hidden" animate="show" className="space-y-6">
          {byExam.map((group) => {
            const totalObtained = group.rows!.reduce((sum, r) => sum + Number(r.marks_obtained), 0);
            const totalMax = group.rows!.reduce((sum, r) => sum + Number(r.max_marks), 0);
            const percentage = totalMax > 0 ? Math.round((totalObtained / totalMax) * 10000) / 100 : null;
            return (
              <motion.div key={group.examName + group.examDate} variants={fadeSlideUp}>
                <PortalGlassCard noHover className="space-y-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <h2 className="text-lg font-semibold text-[var(--ink-primary)]">{group.examName}</h2>
                      {group.examDate && <p className="text-xs text-[var(--ink-muted)]">{group.examDate}</p>}
                    </div>
                    <p className="text-2xl font-semibold text-[var(--ink-primary)]">{percentage !== null ? `${percentage}%` : "—"}</p>
                  </div>
                  {percentage !== null && <PortalProgressBar percent={percentage} />}
                  <DataTable
                    rows={group.rows!}
                    rowKey={(r) => r.id}
                    emptyMessage="No subjects recorded."
                    columns={[
                      { header: "Subject", cell: (r) => r.subjects?.name ?? "—" },
                      { header: "Marks", cell: (r) => `${r.marks_obtained} / ${r.max_marks}` },
                      { header: "Grade", cell: (r) => r.grade ?? "—" },
                      { header: "Remarks", cell: (r) => r.remarks ?? "—" },
                    ]}
                  />
                </PortalGlassCard>
              </motion.div>
            );
          })}
        </motion.div>
      )}
    </div>
  );
}
