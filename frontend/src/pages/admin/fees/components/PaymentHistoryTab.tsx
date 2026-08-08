import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Button } from "@/components/ui/Button";
import { DataTable } from "@/components/ui/DataTable";
import { ExportButtons } from "@/components/ui/ExportButtons";
import * as feesService from "@/services/admin/fees.service";
import { usePaymentHistory } from "../hooks/usePaymentHistory";
import { FeesTableSkeleton } from "./FeesSkeleton";
import { PaymentHistoryItem, PaymentMethod } from "@/types/fees.types";

const PAGE_SIZE = 20;

const METHOD_OPTIONS = [
  { value: "cash", label: "Cash" },
  { value: "card", label: "Card" },
  { value: "bank_transfer", label: "Bank transfer" },
  { value: "online", label: "Online" },
  { value: "cheque", label: "Cheque" },
  { value: "other", label: "Other" },
];

const METHOD_LABELS: Record<PaymentMethod, string> = {
  cash: "Cash",
  card: "Card",
  bank_transfer: "Bank transfer",
  online: "Online",
  cheque: "Cheque",
  other: "Other",
};

export function PaymentHistoryTab() {
  const [search, setSearch] = useState("");
  const [classFilter, setClassFilter] = useState("");
  const [methodFilter, setMethodFilter] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [page, setPage] = useState(1);

  const { data, isLoading, isFetching } = usePaymentHistory({
    search: search || undefined,
    classId: classFilter || undefined,
    method: (methodFilter || undefined) as PaymentMethod | undefined,
    dateFrom: dateFrom || undefined,
    dateTo: dateTo || undefined,
    page,
    pageSize: PAGE_SIZE,
  });

  const { data: classes = [] } = useQuery({ queryKey: ["fees", "classes"], queryFn: feesService.fetchFeeClasses });
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
            placeholder="Search by student, admission no, or receipt no"
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
            label="Method"
            placeholder="All methods"
            options={METHOD_OPTIONS}
            value={methodFilter}
            onChange={(e) => {
              setMethodFilter(e.target.value);
              setPage(1);
            }}
          />
          <Input
            label="From"
            type="date"
            value={dateFrom}
            onChange={(e) => {
              setDateFrom(e.target.value);
              setPage(1);
            }}
          />
          <Input
            label="To"
            type="date"
            value={dateTo}
            onChange={(e) => {
              setDateTo(e.target.value);
              setPage(1);
            }}
          />
        </div>
        <ExportButtons
          title="Payment History"
          filename="payment-history"
          rows={rows}
          columns={[
            { header: "Date", accessor: (p) => p.payment_date },
            { header: "Student", accessor: (p) => p.students.users.full_name },
            { header: "Admission No", accessor: (p) => p.students.admission_no },
            { header: "Class", accessor: (p) => (p.students.classes ? `${p.students.classes.name} - ${p.students.classes.section}` : "—") },
            { header: "Amount", accessor: (p) => p.amount.toFixed(2) },
            { header: "Method", accessor: (p) => METHOD_LABELS[p.payment_method] },
            { header: "Reference", accessor: (p) => p.reference_no ?? "—" },
            { header: "Receipt No", accessor: (p) => p.receipt_no },
          ]}
        />
      </div>

      <DataTable<PaymentHistoryItem>
        rows={rows}
        rowKey={(p) => p.id}
        emptyMessage="No payments match your filters."
        columns={[
          { header: "Date", cell: (p) => p.payment_date },
          { header: "Student", cell: (p) => p.students.users.full_name },
          { header: "Class", cell: (p) => (p.students.classes ? `${p.students.classes.name} - ${p.students.classes.section}` : "—") },
          { header: "Amount", cell: (p) => `₹${p.amount.toFixed(2)}` },
          { header: "Method", cell: (p) => METHOD_LABELS[p.payment_method] },
          { header: "Reference", cell: (p) => p.reference_no ?? "—" },
          { header: "Receipt No", cell: (p) => p.receipt_no },
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
    </div>
  );
}
