import { ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { BarChart3, Users, TrendingUp, TrendingDown, Percent } from "lucide-react";
import { DataTable, Column } from "@/components/ui/DataTable";
import { ExportButtons } from "@/components/ui/ExportButtons";
import * as examsService from "@/services/admin/exams.service";
import { Exam, ExamReportStudent } from "@/types/exam.types";
import { ExportColumn } from "@/utils/export";
import { EmptyState } from "@/components/ui/EmptyState";
import { ErrorState } from "@/pages/admin/dashboard/components/states/ErrorState";
import { ExamStatCardsSkeleton, ExamsTableSkeleton } from "./ExamsSkeleton";

function StatTile({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof Users;
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-2xl border border-black/[0.06] bg-white p-5 dark:border-white/[0.08] dark:bg-[#17171a]">
      <div className="flex items-center gap-2.5">
        <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-accent-500/10 text-accent-600 dark:text-accent-400">
          <Icon size={17} strokeWidth={1.75} />
        </span>
        <span className="text-xs font-medium text-[var(--ink-muted)]">{label}</span>
      </div>
      <p className="mt-4 text-2xl font-semibold text-[var(--ink-primary)]">{value}</p>
    </div>
  );
}

const EXPORT_COLUMNS: ExportColumn<ExamReportStudent>[] = [
  { header: "Admission No", accessor: (r) => r.admissionNo },
  { header: "Student", accessor: (r) => r.studentName },
  { header: "Marks", accessor: (r) => `${r.obtained}/${r.max}` },
  { header: "Percentage", accessor: (r) => (r.percentage ?? 0).toFixed(1) },
  { header: "Grade", accessor: (r) => r.grade },
];

export function ReportsTab({ exam, picker }: { exam: Exam | null; picker: ReactNode }) {
  const reportQuery = useQuery({
    queryKey: ["admin", "exams", exam?.id, "report"],
    queryFn: () => examsService.fetchExamReport(exam!.id),
    enabled: !!exam,
  });

  if (!exam) {
    return (
      <div className="animate-fade-in space-y-4">
        {picker}
        <div className="rounded-2xl border border-black/[0.06] bg-white py-4 dark:border-white/[0.08] dark:bg-[#17171a]">
          <EmptyState icon={BarChart3} title="Select an exam" description="Choose an exam above to view its performance report." />
        </div>
      </div>
    );
  }

  if (reportQuery.isLoading) {
    return (
      <div className="animate-fade-in space-y-4">
        {picker}
        <ExamStatCardsSkeleton />
        <ExamsTableSkeleton />
      </div>
    );
  }

  if (reportQuery.isError || !reportQuery.data) {
    return (
      <div className="animate-fade-in space-y-4">
        {picker}
        <ErrorState
          message={reportQuery.error instanceof Error ? reportQuery.error.message : undefined}
          onRetry={() => reportQuery.refetch()}
        />
      </div>
    );
  }

  const { students, stats } = reportQuery.data;

  const columns: Column<ExamReportStudent>[] = [
    { header: "Admission No", cell: (r) => r.admissionNo },
    { header: "Student", cell: (r) => <span className="font-medium text-[var(--ink-primary)]">{r.studentName}</span> },
    { header: "Marks", cell: (r) => `${r.obtained} / ${r.max}` },
    { header: "Percentage", cell: (r) => (r.percentage !== null ? `${r.percentage}%` : "—") },
    { header: "Grade", cell: (r) => r.grade },
  ];

  return (
    <div className="animate-fade-in space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-4">
        {picker}
        <ExportButtons
          title={`${exam.name} — Exam Report`}
          columns={EXPORT_COLUMNS}
          rows={students}
          filename={`${exam.name.replace(/\s+/g, "_")}_report`}
        />
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatTile icon={Users} label="Students" value={String(stats.totalStudents)} />
        <StatTile icon={Percent} label="Average" value={stats.averagePercentage !== null ? `${stats.averagePercentage}%` : "—"} />
        <StatTile icon={TrendingUp} label="Highest" value={stats.highestPercentage !== null ? `${stats.highestPercentage}%` : "—"} />
        <StatTile icon={TrendingDown} label="Lowest" value={stats.lowestPercentage !== null ? `${stats.lowestPercentage}%` : "—"} />
      </div>

      <div className="rounded-2xl border border-black/[0.06] bg-white p-5 dark:border-white/[0.08] dark:bg-[#17171a]">
        <p className="text-sm text-[var(--ink-secondary)]">
          <span className="font-semibold text-[var(--status-good)]">{stats.passCount} passed</span>
          {" · "}
          <span className="font-semibold text-[var(--status-serious)]">{stats.failCount} failed</span>
          {stats.passPercentage !== null && <span className="text-[var(--ink-muted)]"> · {stats.passPercentage}% pass rate</span>}
        </p>
      </div>

      {students.length === 0 ? (
        <div className="rounded-2xl border border-black/[0.06] bg-white py-4 dark:border-white/[0.08] dark:bg-[#17171a]">
          <EmptyState icon={BarChart3} title="No marks recorded yet" description="Once marks are entered for this exam, the report will appear here." />
        </div>
      ) : (
        <div className="rounded-2xl border border-black/[0.06] bg-white p-2 dark:border-white/[0.08] dark:bg-[#17171a]">
          <DataTable<ExamReportStudent> columns={columns} rows={students} rowKey={(r) => r.studentId} isLoading={false} />
        </div>
      )}
    </div>
  );
}
