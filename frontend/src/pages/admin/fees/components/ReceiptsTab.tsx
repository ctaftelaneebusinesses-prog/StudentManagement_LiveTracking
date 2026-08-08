import { useState } from "react";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { DataTable } from "@/components/ui/DataTable";
import { usePaymentHistory } from "../hooks/usePaymentHistory";
import { ReceiptModal } from "./ReceiptModal";
import { FeesTableSkeleton } from "./FeesSkeleton";
import { PaymentHistoryItem } from "@/types/fees.types";

const PAGE_SIZE = 20;

export function ReceiptsTab() {
  const [search, setSearch] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [page, setPage] = useState(1);
  const [viewingPaymentId, setViewingPaymentId] = useState<string | null>(null);

  const { data, isLoading, isFetching } = usePaymentHistory({
    search: search || undefined,
    dateFrom: dateFrom || undefined,
    dateTo: dateTo || undefined,
    page,
    pageSize: PAGE_SIZE,
  });

  const total = data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const rows = data?.items ?? [];

  if (isLoading) return <FeesTableSkeleton />;

  return (
    <div className="animate-fade-in space-y-4">
      <div className="flex flex-wrap items-end gap-4">
        <Input
          label="Search"
          placeholder="Search by receipt no, student, or admission number"
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
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

      <DataTable<PaymentHistoryItem>
        rows={rows}
        rowKey={(p) => p.id}
        emptyMessage="No receipts match your filters."
        columns={[
          { header: "Receipt No", cell: (p) => p.receipt_no },
          { header: "Student", cell: (p) => p.students.users.full_name },
          { header: "Admission No", cell: (p) => p.students.admission_no },
          { header: "Date", cell: (p) => p.payment_date },
          { header: "Amount", cell: (p) => `₹${p.amount.toFixed(2)}` },
          {
            header: "",
            cell: (p) => (
              <Button variant="ghost" className="!px-2 !py-1 text-xs" onClick={() => setViewingPaymentId(p.id)}>
                View receipt
              </Button>
            ),
          },
        ]}
      />

      {total > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-3 text-sm text-slate-500 dark:text-slate-400">
          <p>
            Showing {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, total)} of {total}
            {isFetching && <span className="ml-2 text-xs">Refreshing…</span>}
          </p>
          <div className="flex flex-wrap gap-2">
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

      <ReceiptModal paymentId={viewingPaymentId} onClose={() => setViewingPaymentId(null)} />
    </div>
  );
}
