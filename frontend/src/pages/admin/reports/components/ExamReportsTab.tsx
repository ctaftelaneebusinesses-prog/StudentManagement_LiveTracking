import { useQuery } from "@tanstack/react-query";
import { DataTable } from "@/components/ui/DataTable";
import { ExportButtons } from "@/components/ui/ExportButtons";
import { StatCard } from "@/pages/admin/dashboard/components/StatCard";
import { ChartCard } from "@/pages/admin/dashboard/components/ChartCard";
import { EmptyState } from "@/components/ui/EmptyState";
import { ErrorState } from "@/pages/admin/dashboard/components/states/ErrorState";
import { ReportsTabSkeleton } from "./ReportsSkeleton";
import { ExamByClassChart } from "./charts/ExamByClassChart";
import * as reportsService from "@/services/admin/reports.service";
import { useSchool } from "@/hooks/useSchool";
import { StatCardData } from "@/types/adminDashboard.types";

function flatTrend(): StatCardData["trend"] {
  return { direction: "flat", percent: 0, upIsGood: true };
}

export function ExamReportsTab() {
  const { selectedSchool } = useSchool();

  const query = useQuery({
    queryKey: ["admin", "reports", "exams", selectedSchool.id],
    queryFn: reportsService.fetchExamReportSummary,
  });

  if (query.isLoading) return <ReportsTabSkeleton stats={3} charts={1} />;
  if (query.isError) {
    return <ErrorState message={query.error instanceof Error ? query.error.message : undefined} onRetry={() => query.refetch()} />;
  }

  const data = query.data;
  if (!data) return <EmptyState title="No exam data yet" description="Exams and marks will show up here once recorded." />;

  const { exams, analytics } = data;

  const statCards: StatCardData[] = [
    {
      id: "total-exams",
      label: "Total Exams",
      value: analytics.totalExams,
      description: "Exams with recorded marks",
      trend: flatTrend(),
      spark: Array.from({ length: 12 }, () => analytics.totalExams),
      icon: "exam",
    },
    {
      id: "total-students",
      label: "Students Assessed",
      value: analytics.totalStudents,
      description: "Unique students with marks",
      trend: flatTrend(),
      spark: Array.from({ length: 12 }, () => analytics.totalStudents),
      icon: "students",
    },
    {
      id: "avg-pct",
      label: "Overall Average",
      value: analytics.averagePercentage ?? 0,
      displayValue: analytics.averagePercentage !== null ? `${analytics.averagePercentage}%` : "—",
      description: "School-wide average across all exams",
      trend: flatTrend(),
      spark: Array.from({ length: 12 }, () => analytics.averagePercentage ?? 0),
      icon: "exam",
    },
  ];

  return (
    <div className="animate-fade-in space-y-6">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {statCards.map((s) => (
          <StatCard key={s.id} data={s} />
        ))}
      </div>

      <ChartCard title="Average Performance by Class" subtitle="Across all exams">
        {analytics.byClass.length === 0 ? (
          <EmptyState title="No exam marks recorded yet" />
        ) : (
          <ExamByClassChart data={analytics.byClass} />
        )}
      </ChartCard>

      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-sm font-semibold text-[var(--ink-primary)]">Exam-wise summary</h3>
        <ExportButtons
          title="Exam Reports — Exam-wise Summary"
          filename="exam-reports-exam-wise"
          rows={exams}
          columns={[
            { header: "Exam", accessor: (r) => r.examName },
            { header: "Date", accessor: (r) => r.examDate ?? "—" },
            { header: "Class", accessor: (r) => r.className },
            { header: "Students", accessor: (r) => r.studentCount },
            { header: "Average %", accessor: (r) => r.averagePercentage ?? "—" },
            { header: "Pass", accessor: (r) => r.passCount },
            { header: "Fail", accessor: (r) => r.failCount },
          ]}
        />
      </div>

      <DataTable
        rows={exams}
        rowKey={(r) => r.examId}
        emptyMessage="No exams with recorded marks yet."
        columns={[
          { header: "Exam", cell: (r) => r.examName },
          { header: "Date", cell: (r) => r.examDate ?? "—" },
          { header: "Class", cell: (r) => r.className },
          { header: "Students", cell: (r) => r.studentCount },
          { header: "Average %", cell: (r) => (r.averagePercentage !== null ? `${r.averagePercentage}%` : "—") },
          { header: "Pass", cell: (r) => r.passCount },
          { header: "Fail", cell: (r) => r.failCount },
        ]}
      />
    </div>
  );
}
