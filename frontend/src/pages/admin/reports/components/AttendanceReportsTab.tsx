import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Select } from "@/components/ui/Select";
import { Input } from "@/components/ui/Input";
import { DataTable } from "@/components/ui/DataTable";
import { ExportButtons } from "@/components/ui/ExportButtons";
import { StatCard } from "@/pages/admin/dashboard/components/StatCard";
import { ChartCard } from "@/pages/admin/dashboard/components/ChartCard";
import { EmptyState } from "@/components/ui/EmptyState";
import { ErrorState } from "@/pages/admin/dashboard/components/states/ErrorState";
import { ReportsTabSkeleton } from "./ReportsSkeleton";
import { AttendanceTrendChart } from "./charts/AttendanceTrendChart";
import { AttendanceByClassChart } from "./charts/AttendanceByClassChart";
import * as reportsService from "@/services/admin/reports.service";
import * as classesService from "@/services/admin/classes.service";
import { useSchool } from "@/hooks/useSchool";
import { StatCardData } from "@/types/adminDashboard.types";

function flatTrend(good: boolean): StatCardData["trend"] {
  return { direction: "flat", percent: 0, upIsGood: good };
}

export function AttendanceReportsTab() {
  const { selectedSchool } = useSchool();
  const [searchParams] = useSearchParams();
  const focusAbsent = searchParams.get("focus") === "absent";
  const [classFilter, setClassFilter] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [showAbsentHighlight, setShowAbsentHighlight] = useState(focusAbsent);

  useEffect(() => {
    if (!focusAbsent) return;
    const timer = setTimeout(() => setShowAbsentHighlight(false), 1500);
    return () => clearTimeout(timer);
  }, [focusAbsent]);

  const { data: classes = [] } = useQuery({ queryKey: ["admin", "classes"], queryFn: classesService.fetchClasses });
  const classOptions = classes.map((c) => ({ value: c.id, label: `${c.name} - ${c.section}` }));
  const classNameById = useMemo(() => new Map(classes.map((c) => [c.id, `${c.name} ${c.section}`])), [classes]);

  const query = useQuery({
    queryKey: ["admin", "reports", "attendance", selectedSchool.id, classFilter, from, to],
    queryFn: () =>
      reportsService.fetchAttendanceReport({
        classId: classFilter || undefined,
        from: from || undefined,
        to: to || undefined,
      }),
  });

  if (query.isLoading) return <ReportsTabSkeleton stats={4} charts={2} />;
  if (query.isError) {
    return <ErrorState message={query.error instanceof Error ? query.error.message : undefined} onRetry={() => query.refetch()} />;
  }

  const data = query.data;
  if (!data) return <EmptyState title="No attendance data yet" description="Attendance records will show up here once marked." />;

  const { overall, trend, byClass, studentWise } = data;

  const statCards: StatCardData[] = [
    {
      id: "overall-pct",
      label: "Overall Attendance",
      value: overall.present_pct ?? 0,
      displayValue: overall.present_pct !== null ? `${overall.present_pct}%` : "—",
      description: "Present rate across all records",
      trend: flatTrend(true),
      spark: Array.from({ length: 12 }, () => overall.present_pct ?? 0),
      icon: "attendance",
    },
    {
      id: "present-count",
      label: "Present",
      value: overall.present_count,
      description: "Total present markings",
      trend: flatTrend(true),
      spark: Array.from({ length: 12 }, () => overall.present_count),
      icon: "attendance",
    },
    {
      id: "absent-count",
      label: "Absent",
      value: overall.absent_count,
      description: "Total absent markings",
      trend: flatTrend(false),
      spark: Array.from({ length: 12 }, () => overall.absent_count),
      icon: "absent",
    },
    {
      id: "leave-count",
      label: "On Leave",
      value: overall.leave_count,
      description: "Total leave markings",
      trend: flatTrend(false),
      spark: Array.from({ length: 12 }, () => overall.leave_count),
      icon: "leave",
    },
  ];

  const studentRowsBase = studentWise.map((s) => ({ ...s, className: s.class_id ? classNameById.get(s.class_id) ?? "—" : "—" }));
  const studentRows = focusAbsent
    ? [...studentRowsBase].sort((a, b) => b.absent_count - a.absent_count)
    : studentRowsBase;

  return (
    <div className="animate-fade-in space-y-6">
      <div className="flex flex-wrap items-end gap-4">
        <Select label="Class" placeholder="All classes" options={classOptions} value={classFilter} onChange={(e) => setClassFilter(e.target.value)} />
        <Input label="From" type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
        <Input label="To" type="date" value={to} onChange={(e) => setTo(e.target.value)} />
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {statCards.map((s) => (
          <StatCard key={s.id} data={s} highlighted={s.id === "absent-count" && showAbsentHighlight} />
        ))}
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <ChartCard title="Attendance Trend" subtitle={from || to ? "Selected range" : "All recorded dates"}>
          {trend.length === 0 ? (
            <EmptyState title="No trend data" description="No attendance has been recorded for this range yet." />
          ) : (
            <AttendanceTrendChart data={trend} />
          )}
        </ChartCard>
        <ChartCard title="Attendance by Class" subtitle="Present % per class">
          {byClass.length === 0 ? (
            <EmptyState title="No classes found" />
          ) : (
            <AttendanceByClassChart data={byClass} />
          )}
        </ChartCard>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-sm font-semibold text-[var(--ink-primary)]">Student-wise breakdown</h3>
        <ExportButtons
          title="Attendance — Student-wise"
          filename="attendance-student-wise"
          rows={studentRows}
          columns={[
            { header: "Student", accessor: (r) => r.student_name },
            { header: "Class", accessor: (r) => r.className },
            { header: "Present", accessor: (r) => r.present_count },
            { header: "Absent", accessor: (r) => r.absent_count },
            { header: "Late", accessor: (r) => r.late_count },
            { header: "Total Marked", accessor: (r) => r.total_marked },
            { header: "Present %", accessor: (r) => r.present_pct ?? "—" },
          ]}
        />
      </div>

      <DataTable
        rows={studentRows}
        rowKey={(r) => r.student_id}
        emptyMessage="No student attendance records match your filters."
        columns={[
          { header: "Student", cell: (r) => r.student_name },
          { header: "Class", cell: (r) => r.className },
          { header: "Present", cell: (r) => r.present_count },
          { header: "Absent", cell: (r) => r.absent_count },
          { header: "Late", cell: (r) => r.late_count },
          { header: "Total Marked", cell: (r) => r.total_marked },
          { header: "Present %", cell: (r) => (r.present_pct !== null ? `${r.present_pct}%` : "—") },
        ]}
      />
    </div>
  );
}
