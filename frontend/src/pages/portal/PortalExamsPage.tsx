import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { CalendarDays, FileText } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { usePortalStudentId } from "@/context/PortalStudentContext";
import * as examsService from "@/services/portal/exams.service";
import * as homeworkService from "@/services/student/homework.service";
import { QuestionPaperRecord } from "@/types/teacher.types";
import { PortalGlassCard } from "./components/ui/PortalGlassCard";
import { PortalSkeleton } from "./components/ui/PortalSkeleton";
import { PortalEmptyState } from "./components/ui/PortalEmptyState";
import { PortalModal } from "./components/ui/PortalModal";
import { staggerContainer, fadeSlideUp } from "./components/ui/portalMotion";

export function PortalExamsPage() {
  const studentId = usePortalStudentId();
  const [scheduleExamId, setScheduleExamId] = useState<string | null>(null);
  const [viewingDoc, setViewingDoc] = useState<QuestionPaperRecord | null>(null);

  const examsQuery = useQuery({
    queryKey: ["portal", "exams", studentId],
    queryFn: () => examsService.fetchExams(studentId),
    enabled: !!studentId,
  });
  const questionPapersQuery = useQuery({
    queryKey: ["portal", "question-papers", studentId],
    queryFn: () => homeworkService.fetchQuestionPapers(studentId),
    enabled: !!studentId,
  });
  const scheduleQuery = useQuery({
    queryKey: ["portal", "exam-schedule", studentId, scheduleExamId],
    queryFn: () => examsService.fetchExamSchedule(studentId, scheduleExamId!),
    enabled: !!studentId && !!scheduleExamId,
  });

  const today = new Date().toISOString().slice(0, 10);
  const exams = examsQuery.data ?? [];
  const scheduleExam = exams.find((e) => e.id === scheduleExamId);

  return (
    <div className="space-y-6">
      <div className="border-l-4 pl-4" style={{ borderColor: "var(--portal-accent)" }}>
        <h1 className="text-2xl font-semibold text-[var(--ink-primary)]">Examinations</h1>
        <p className="text-sm text-[var(--ink-muted)]">Exam schedule and question papers published by the school.</p>
      </div>

      <PortalGlassCard noHover className="space-y-4">
        <h2 className="text-lg font-semibold text-[var(--ink-primary)]">Exam Timetable</h2>
        {examsQuery.isLoading ? (
          <PortalSkeleton className="h-32 w-full" />
        ) : exams.length === 0 ? (
          <PortalEmptyState title="No exams scheduled yet" icon={CalendarDays} />
        ) : (
          <motion.ul variants={staggerContainer} initial="hidden" animate="show" className="space-y-2">
            {exams.map((exam) => {
              const upcoming = !!exam.exam_date && exam.exam_date >= today;
              return (
                <motion.li key={exam.id} variants={fadeSlideUp}>
                  <button
                    type="button"
                    onClick={() => setScheduleExamId(exam.id)}
                    className="flex w-full flex-wrap items-center justify-between gap-2 rounded-xl border p-3 text-left text-sm transition-colors hover:bg-black/[0.02] dark:hover:bg-white/[0.04]"
                    style={{ borderColor: "var(--portal-glass-border)" }}
                  >
                    <div>
                      <p className="font-medium text-[var(--ink-primary)]">{exam.name}</p>
                      <p className="text-xs text-[var(--ink-muted)]">{exam.exam_date ?? "Date not set"}</p>
                    </div>
                    {upcoming && <Badge variant="info">Upcoming</Badge>}
                  </button>
                </motion.li>
              );
            })}
          </motion.ul>
        )}
      </PortalGlassCard>

      <PortalGlassCard noHover className="space-y-4">
        <h2 className="text-lg font-semibold text-[var(--ink-primary)]">Question Papers</h2>
        {questionPapersQuery.isLoading ? (
          <PortalSkeleton className="h-24 w-full" />
        ) : !questionPapersQuery.data?.length ? (
          <PortalEmptyState title="No question papers published yet" icon={FileText} />
        ) : (
          <ul className="space-y-2">
            {questionPapersQuery.data.map((doc) => (
              <li key={doc.id} className="flex items-center justify-between rounded-xl border p-3 text-sm" style={{ borderColor: "var(--portal-glass-border)" }}>
                <div>
                  <p className="font-medium text-[var(--ink-primary)]">{doc.exams?.name ?? "Exam"}</p>
                  <p className="text-xs text-[var(--ink-muted)]">{doc.exams?.subjects?.name ?? "General"} — {doc.file_name ?? "Written question paper"}</p>
                </div>
                {doc.url ? (
                  <a href={doc.url} target="_blank" rel="noreferrer" className="text-xs font-medium hover:underline" style={{ color: "var(--portal-accent)" }}>
                    View
                  </a>
                ) : doc.content ? (
                  <button type="button" className="text-xs font-medium hover:underline" style={{ color: "var(--portal-accent)" }} onClick={() => setViewingDoc(doc)}>
                    View
                  </button>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </PortalGlassCard>

      <PortalModal isOpen={!!scheduleExamId} onClose={() => setScheduleExamId(null)} title={scheduleExam?.name ?? "Exam schedule"}>
        {scheduleQuery.isLoading ? (
          <PortalSkeleton className="h-32 w-full" />
        ) : !scheduleQuery.data?.length ? (
          <p className="text-sm text-[var(--ink-muted)]">No subject-wise schedule published for this exam yet.</p>
        ) : (
          <ul className="space-y-2">
            {scheduleQuery.data.map((entry) => (
              <li key={entry.id} className="flex items-center justify-between rounded-xl border p-3 text-sm" style={{ borderColor: "var(--portal-glass-border)" }}>
                <div>
                  <p className="font-medium text-[var(--ink-primary)]">{entry.subjects?.name ?? "—"}</p>
                  <p className="text-xs text-[var(--ink-muted)]">
                    {entry.exam_date} · {entry.start_time.slice(0, 5)}–{entry.end_time.slice(0, 5)}
                    {entry.room ? ` · Room ${entry.room}` : ""}
                  </p>
                </div>
                {entry.max_marks != null && <span className="text-xs text-[var(--ink-muted)]">{entry.max_marks} marks</span>}
              </li>
            ))}
          </ul>
        )}
      </PortalModal>

      <PortalModal isOpen={!!viewingDoc} onClose={() => setViewingDoc(null)} title={viewingDoc?.exams?.name ?? "Question paper"} size="xl">
        {viewingDoc?.content && (
          <div
            className="prose max-w-none text-sm text-[var(--ink-secondary)] [&_h2]:text-lg [&_h2]:font-semibold [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:list-decimal [&_ol]:pl-5"
            dangerouslySetInnerHTML={{ __html: viewingDoc.content }}
          />
        )}
      </PortalModal>
    </div>
  );
}
