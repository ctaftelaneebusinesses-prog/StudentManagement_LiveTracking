import { ReactNode } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Trophy, CheckCircle2, CircleDashed } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { DataTable, Column } from "@/components/ui/DataTable";
import { getApiErrorMessage } from "@/lib/axios";
import * as examsService from "@/services/admin/exams.service";
import { Exam, ExamMark } from "@/types/exam.types";
import { EmptyState } from "@/components/ui/EmptyState";
import { ExamsTableSkeleton } from "./ExamsSkeleton";
import { ExamStatusBadge } from "./ExamStatusBadge";

export function ResultsTab({ exam, picker }: { exam: Exam | null; picker: ReactNode }) {
  const queryClient = useQueryClient();

  const marksQuery = useQuery({
    queryKey: ["admin", "exams", exam?.id, "marks"],
    queryFn: () => examsService.fetchMarksForExam(exam!.id),
    enabled: !!exam,
  });

  const publishMutation = useMutation({
    mutationFn: (isPublished: boolean) => examsService.publishExam(exam!.id, isPublished),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin", "exams"] });
    },
  });

  if (!exam) {
    return (
      <div className="animate-fade-in space-y-4">
        {picker}
        <div className="rounded-2xl border border-black/[0.06] bg-white py-4 dark:border-white/[0.08] dark:bg-[#17171a]">
          <EmptyState icon={Trophy} title="Select an exam" description="Choose an exam above to review and publish its results." />
        </div>
      </div>
    );
  }

  const marks = marksQuery.data ?? [];

  const columns: Column<ExamMark>[] = [
    { header: "Student", cell: (m) => m.students?.users?.full_name ?? "—" },
    { header: "Admission No", cell: (m) => m.students?.admission_no ?? "—" },
    { header: "Subject", cell: (m) => m.subjects?.name ?? "—" },
    { header: "Marks", cell: (m) => `${m.marks_obtained} / ${m.max_marks}` },
    { header: "Grade", cell: (m) => m.grade ?? "—" },
  ];

  return (
    <div className="animate-fade-in space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-4">
        {picker}
        <div className="flex items-center gap-3">
          <ExamStatusBadge isPublished={exam.is_published} />
          {exam.is_published ? (
            <Button
              variant="secondary"
              onClick={() => publishMutation.mutate(false)}
              isLoading={publishMutation.isPending}
            >
              <CircleDashed size={16} /> Unpublish
            </Button>
          ) : (
            <Button onClick={() => publishMutation.mutate(true)} isLoading={publishMutation.isPending}>
              <CheckCircle2 size={16} /> Publish results
            </Button>
          )}
        </div>
      </div>

      {publishMutation.isError && (
        <p className="text-sm text-red-600">{getApiErrorMessage(publishMutation.error, "Failed to update publish status.")}</p>
      )}

      <div className="rounded-2xl border border-black/[0.06] bg-white p-5 dark:border-white/[0.08] dark:bg-[#17171a]">
        <p className="text-sm text-[var(--ink-secondary)]">
          {exam.is_published
            ? "Results are visible to students for this exam."
            : "Results are still in draft — students cannot see marks for this exam yet."}
        </p>
      </div>

      {marksQuery.isLoading ? (
        <ExamsTableSkeleton />
      ) : marks.length === 0 ? (
        <div className="rounded-2xl border border-black/[0.06] bg-white py-4 dark:border-white/[0.08] dark:bg-[#17171a]">
          <EmptyState icon={Trophy} title="No marks recorded yet" description="Marks entered by teachers for this exam will show up here." />
        </div>
      ) : (
        <div className="rounded-2xl border border-black/[0.06] bg-white p-2 dark:border-white/[0.08] dark:bg-[#17171a]">
          <DataTable<ExamMark> columns={columns} rows={marks} rowKey={(m) => m.id} isLoading={false} />
        </div>
      )}
    </div>
  );
}
