import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { DataTable } from "@/components/ui/DataTable";
import { Badge, BadgeVariant } from "@/components/ui/Badge";
import { ExportButtons } from "@/components/ui/ExportButtons";
import * as transportService from "@/services/transport.service";
import { TransportFeeRecord, TransportPaymentStatus } from "@/types/transport.types";
import { ExportColumn } from "@/utils/export";

const PAYMENT_STATUS_OPTIONS: { value: TransportPaymentStatus; label: string }[] = [
  { value: "unpaid", label: "Unpaid" },
  { value: "partial", label: "Partial" },
  { value: "paid", label: "Paid" },
];

const PAYMENT_STATUS_BADGE: Record<TransportPaymentStatus, BadgeVariant> = {
  unpaid: "danger",
  partial: "warning",
  paid: "success",
};

export function FeesTab() {
  const [editing, setEditing] = useState<TransportFeeRecord | null>(null);
  const { data = [], isLoading } = useQuery({ queryKey: ["transport", "fees"], queryFn: transportService.fetchTransportFees });

  const exportColumns: ExportColumn<TransportFeeRecord>[] = [
    { header: "Admission No", accessor: (r) => r.students?.admission_no ?? "" },
    { header: "Name", accessor: (r) => r.students?.users?.full_name ?? "" },
    { header: "Class", accessor: (r) => (r.students?.classes ? `${r.students.classes.name} - ${r.students.classes.section}` : "") },
    { header: "Route", accessor: (r) => r.pickup_points?.routes?.name ?? "" },
    { header: "Fee amount", accessor: (r) => r.fee_amount ?? "" },
    { header: "Payment status", accessor: (r) => r.payment_status },
    { header: "Due date", accessor: (r) => r.fee_due_date ?? "" },
  ];

  return (
    <div className="animate-fade-in space-y-4">
      <div className="flex justify-end">
        <ExportButtons title="Transport Fees" columns={exportColumns} rows={data} filename="transport-fees" />
      </div>

      <Card>
        <DataTable<TransportFeeRecord>
          isLoading={isLoading}
          rows={data}
          rowKey={(r) => r.student_id}
          emptyMessage="No students are assigned to transport yet. Assign students from the Routes & Stops tab first."
          columns={[
            { header: "Admission No", cell: (r) => r.students?.admission_no ?? "—" },
            { header: "Name", cell: (r) => r.students?.users?.full_name ?? "—" },
            { header: "Class", cell: (r) => (r.students?.classes ? `${r.students.classes.name} - ${r.students.classes.section}` : "—") },
            { header: "Route", cell: (r) => r.pickup_points?.routes?.name ?? "—" },
            { header: "Fee amount", cell: (r) => (r.fee_amount != null ? `₹${r.fee_amount}` : "Not set") },
            { header: "Payment status", cell: (r) => <Badge variant={PAYMENT_STATUS_BADGE[r.payment_status]}>{r.payment_status}</Badge> },
            { header: "Due date", cell: (r) => r.fee_due_date ?? "—" },
            {
              header: "",
              cell: (r) => (
                <Button variant="ghost" className="!px-2 !py-1 text-xs" onClick={() => setEditing(r)}>
                  {r.fee_amount != null ? "Update fee" : "Add fee"}
                </Button>
              ),
            },
          ]}
        />
      </Card>

      {editing && <FeeFormModal key={editing.student_id} record={editing} onClose={() => setEditing(null)} />}
    </div>
  );
}

function FeeFormModal({ record, onClose }: { record: TransportFeeRecord; onClose: () => void }) {
  const queryClient = useQueryClient();
  const [amount, setAmount] = useState(record.fee_amount != null ? String(record.fee_amount) : "");
  const [status, setStatus] = useState<TransportPaymentStatus>(record.payment_status);
  const [dueDate, setDueDate] = useState(record.fee_due_date ?? "");

  const mutation = useMutation({
    mutationFn: () =>
      transportService.setTransportFee(record.student_id, {
        fee_amount: amount === "" ? undefined : Number(amount),
        payment_status: status,
        fee_due_date: dueDate || undefined,
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["transport", "fees"] });
      void queryClient.invalidateQueries({ queryKey: ["transport", "route-students"] });
      onClose();
    },
  });

  return (
    <Modal isOpen onClose={onClose} title={`Transport fee — ${record.students?.users?.full_name ?? "Student"}`}>
      <div className="space-y-4">
        <Input label="Fee amount" type="number" min="0" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} />
        <Select
          label="Payment status"
          options={PAYMENT_STATUS_OPTIONS}
          value={status}
          onChange={(e) => setStatus(e.target.value as TransportPaymentStatus)}
        />
        <Input label="Due date (optional)" type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
        <Button className="w-full" isLoading={mutation.isPending} onClick={() => mutation.mutate()}>
          Save
        </Button>
      </div>
    </Modal>
  );
}
