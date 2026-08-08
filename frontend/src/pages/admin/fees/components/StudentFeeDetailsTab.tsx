import { useState } from "react";
import { Link } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Button } from "@/components/ui/Button";
import { DataTable } from "@/components/ui/DataTable";
import { ExportButtons } from "@/components/ui/ExportButtons";
import * as classesService from "@/services/admin/classes.service";
import { useStudentFeeDetails } from "../hooks/useStudentFeeDetails";
import { FeeStatusBadge } from "./FeeStatusBadge";
import { RecordPaymentModal } from "./RecordPaymentModal";
import { AddStudentFeeModal } from "./AddStudentFeeModal";
import { FeesTableSkeleton } from "./FeesSkeleton";
import { StudentFeeDetail, FeeStatus } from "@/types/fees.types";

const PAGE_SIZE = 20;

function formatBalance(balance: number): string {
  if (balance < 0) return `₹${Math.abs(balance).toFixed(2)} credit`;
  return `₹${balance.toFixed(2)}`;
}

const STATUS_OPTIONS = [
  { value: "all", label: "All statuses" },
  { value: "paid", label: "Paid" },
  { value: "partial", label: "Partially paid" },
  { value: "unpaid", label: "Unpaid" },
];

export function StudentFeeDetailsTab() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [classFilter, setClassFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | FeeStatus>("all");
  const [page, setPage] = useState(1);
  const [paymentTarget, setPaymentTarget] = useState<StudentFeeDetail | null>(null);
  const [addFeeTarget, setAddFeeTarget] = useState<StudentFeeDetail | null>(null);

  const { data, isLoading, isFetching } = useStudentFeeDetails({
    search: search || undefined,
    classId: classFilter || undefined,
    status: statusFilter,
    page,
    pageSize: PAGE_SIZE,
  });

  const { data: classes = [] } = useQuery({ queryKey: ["admin", "classes"], queryFn: classesService.fetchClasses });
  const classOptions = classes.map((c) => ({ value: c.id, label: `${c.name} - ${c.section}` }));

  const total = data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const rows = data?.items ?? [];

  if (isLoading) return <FeesTableSkeleton />;

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
          <Select
            label="Status"
            options={STATUS_OPTIONS}
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value as "all" | FeeStatus);
              setPage(1);
            }}
          />
        </div>
        <ExportButtons
          title="Student Fee Details"
          filename="student-fee-details"
          rows={rows}
          columns={[
            { header: "Admission No", accessor: (s) => s.admissionNo },
            { header: "Name", accessor: (s) => s.name },
            { header: "Class", accessor: (s) => s.className },
            { header: "Due", accessor: (s) => s.due.toFixed(2) },
            { header: "Paid", accessor: (s) => s.paid.toFixed(2) },
            { header: "Balance", accessor: (s) => formatBalance(s.balance) },
            { header: "Status", accessor: (s) => s.status },
          ]}
        />
      </div>

      <DataTable<StudentFeeDetail>
        rows={rows}
        rowKey={(s) => s.id}
        emptyMessage="No students match your filters."
        columns={[
          { header: "Admission No", cell: (s) => s.admissionNo },
          {
            header: "Name",
            cell: (s) => (
              <Link to={`/dashboard/admin/students/${s.id}`} className="text-brand-600 hover:underline">
                {s.name}
              </Link>
            ),
          },
          { header: "Class", cell: (s) => s.className },
          { header: "Due", cell: (s) => `₹${s.due.toFixed(2)}` },
          { header: "Paid", cell: (s) => `₹${s.paid.toFixed(2)}` },
          { header: "Balance", cell: (s) => formatBalance(s.balance) },
          { header: "Status", cell: (s) => <FeeStatusBadge status={s.status} /> },
          {
            header: "",
            cell: (s) => (
              <div className="flex justify-end gap-1">
                <Button variant="ghost" className="!px-2 !py-1 text-xs" onClick={() => setAddFeeTarget(s)}>
                  Add fee
                </Button>
                <Button variant="ghost" className="!px-2 !py-1 text-xs" onClick={() => setPaymentTarget(s)}>
                  Record payment
                </Button>
              </div>
            ),
            className: "text-right",
          },
        ]}
      />

      {total > 0 && (
        <div className="flex items-center justify-between text-sm text-slate-500 dark:text-slate-400">
          <p>
            Showing {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, total)} of {total}
            {isFetching && <span className="ml-2 text-xs">Refreshing…</span>}
          </p>
          <div className="flex gap-2">
            <Button variant="secondary" className="!px-3 !py-1 text-xs" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
              Previous
            </Button>
            <span className="self-center">
              Page {page} of {totalPages}
            </span>
            <Button
              variant="secondary"
              className="!px-3 !py-1 text-xs"
              disabled={page >= totalPages}
              onClick={() => setPage((p) => p + 1)}
            >
              Next
            </Button>
          </div>
        </div>
      )}

      <RecordPaymentModal
        studentId={paymentTarget?.id ?? null}
        studentName={paymentTarget?.name}
        onClose={() => setPaymentTarget(null)}
        onSuccess={() => {
          queryClient.invalidateQueries({ queryKey: ["admin", "fees"] });
          setPaymentTarget(null);
        }}
      />

      <AddStudentFeeModal
        studentId={addFeeTarget?.id ?? null}
        studentName={addFeeTarget?.name}
        onClose={() => setAddFeeTarget(null)}
        onSuccess={() => setAddFeeTarget(null)}
      />
    </div>
  );
}
