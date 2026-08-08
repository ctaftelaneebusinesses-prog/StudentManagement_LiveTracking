import { useState } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { DataTable } from "@/components/ui/DataTable";
import { ExportButtons } from "@/components/ui/ExportButtons";
import { ErrorState } from "@/pages/admin/dashboard/components/states/ErrorState";
import { ReportsTabSkeleton } from "./ReportsSkeleton";
import * as reportsService from "@/services/admin/reports.service";
import { useSchool } from "@/hooks/useSchool";

const PAGE_SIZE = 20;

export function TeacherReportsTab() {
  const { selectedSchool } = useSchool();
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);

  const query = useQuery({
    queryKey: ["admin", "reports", "teachers", selectedSchool.id, search, page],
    queryFn: () => reportsService.fetchTeacherReport({ search: search || undefined, page, pageSize: PAGE_SIZE }),
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
        <Input
          label="Search"
          placeholder="Search by name or employee ID"
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setPage(1);
          }}
        />
        <ExportButtons
          title="Teacher Reports"
          filename="teacher-reports"
          rows={rows}
          columns={[
            { header: "Employee ID", accessor: (t) => t.employee_id },
            { header: "Name", accessor: (t) => t.users?.full_name ?? "—" },
            { header: "Assignments", accessor: (t) => t.assignmentCount },
            { header: "Attendance % (this month)", accessor: (t) => t.attendancePercentageThisMonth ?? "—" },
            { header: "Pending Leaves", accessor: (t) => t.pendingLeaveCount },
          ]}
        />
      </div>

      <DataTable
        rows={rows}
        rowKey={(t) => t.id}
        emptyMessage="No teachers match your search."
        columns={[
          { header: "Employee ID", cell: (t) => t.employee_id },
          {
            header: "Name",
            cell: (t) => (
              <Link to={`/dashboard/admin/teachers/${t.id}`} className="text-accent-600 hover:underline">
                {t.users?.full_name ?? "—"}
              </Link>
            ),
          },
          { header: "Assignments", cell: (t) => t.assignmentCount },
          {
            header: "Attendance % (this month)",
            cell: (t) => (t.attendancePercentageThisMonth !== null ? `${t.attendancePercentageThisMonth}%` : "—"),
          },
          { header: "Pending Leaves", cell: (t) => t.pendingLeaveCount },
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
