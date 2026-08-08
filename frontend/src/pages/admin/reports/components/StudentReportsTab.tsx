import { useState } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Button } from "@/components/ui/Button";
import { DataTable } from "@/components/ui/DataTable";
import { ExportButtons } from "@/components/ui/ExportButtons";
import { ErrorState } from "@/pages/admin/dashboard/components/states/ErrorState";
import { ReportsTabSkeleton } from "./ReportsSkeleton";
import * as reportsService from "@/services/admin/reports.service";
import * as classesService from "@/services/admin/classes.service";
import { useSchool } from "@/hooks/useSchool";

const PAGE_SIZE = 20;

export function StudentReportsTab() {
  const { selectedSchool } = useSchool();
  const [search, setSearch] = useState("");
  const [classFilter, setClassFilter] = useState("");
  const [page, setPage] = useState(1);

  const { data: classes = [] } = useQuery({ queryKey: ["admin", "classes"], queryFn: classesService.fetchClasses });
  const classOptions = classes.map((c) => ({ value: c.id, label: `${c.name} - ${c.section}` }));

  const query = useQuery({
    queryKey: ["admin", "reports", "students", selectedSchool.id, search, classFilter, page],
    queryFn: () =>
      reportsService.fetchStudentReport({
        search: search || undefined,
        classId: classFilter || undefined,
        page,
        pageSize: PAGE_SIZE,
      }),
  });

  if (query.isLoading) return <ReportsTabSkeleton stats={0} charts={0} />;
  if (query.isError) {
    return <ErrorState message={query.error instanceof Error ? query.error.message : undefined} onRetry={() => query.refetch()} />;
  }

  const total = query.data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const rows = query.data?.items ?? [];

  return (
    <div className="animate-fade-in space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="flex flex-wrap items-end gap-4">
          <Input
            label="Search"
            placeholder="Search by name or admission number"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
          />
          <Select
            label="Class"
            placeholder="All classes"
            options={classOptions}
            value={classFilter}
            onChange={(e) => {
              setClassFilter(e.target.value);
              setPage(1);
            }}
          />
        </div>
        <ExportButtons
          title="Student Reports"
          filename="student-reports"
          rows={rows}
          columns={[
            { header: "Admission No", accessor: (s) => s.admission_no },
            { header: "Name", accessor: (s) => s.users?.full_name ?? "—" },
            { header: "Class", accessor: (s) => (s.classes ? `${s.classes.name} ${s.classes.section}` : "—") },
            { header: "Attendance %", accessor: (s) => s.attendancePercentage ?? "—" },
            { header: "Exam Average %", accessor: (s) => s.examAveragePercentage ?? "—" },
          ]}
        />
      </div>

      <DataTable
        rows={rows}
        rowKey={(s) => s.id}
        emptyMessage="No students match your filters."
        columns={[
          { header: "Admission No", cell: (s) => s.admission_no },
          {
            header: "Name",
            cell: (s) => (
              <Link to={`/dashboard/admin/students/${s.id}`} className="text-accent-600 hover:underline">
                {s.users?.full_name ?? "—"}
              </Link>
            ),
          },
          { header: "Class", cell: (s) => (s.classes ? `${s.classes.name} ${s.classes.section}` : "—") },
          { header: "Attendance %", cell: (s) => (s.attendancePercentage !== null ? `${s.attendancePercentage}%` : "—") },
          { header: "Exam Average %", cell: (s) => (s.examAveragePercentage !== null ? `${s.examAveragePercentage}%` : "—") },
        ]}
      />

      {total > 0 && (
        <div className="flex items-center justify-between text-sm text-[var(--ink-muted)]">
          <p>
            Showing {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, total)} of {total}
          </p>
          <div className="flex gap-2">
            <Button variant="secondary" className="!px-3 !py-1 text-xs" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
              Previous
            </Button>
            <span className="self-center">
              Page {page} of {totalPages}
            </span>
            <Button variant="secondary" className="!px-3 !py-1 text-xs" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>
              Next
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
