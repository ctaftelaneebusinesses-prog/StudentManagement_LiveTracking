import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, CreditCard, Plus, Receipt } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { DataTable } from "@/components/ui/DataTable";
import { EmptyState } from "@/components/ui/EmptyState";
import { Spinner } from "@/components/ui/Spinner";
import { Avatar } from "@/components/ui/Avatar";
import { RecordPaymentModal } from "@/pages/admin/fees/components/RecordPaymentModal";
import { AddStudentFeeModal } from "@/pages/admin/fees/components/AddStudentFeeModal";
import { ReceiptModal } from "@/pages/admin/fees/components/ReceiptModal";
import { FeeStructureSection } from "@/pages/admin/fees/components/FeeStructureSection";
import * as feesService from "@/services/admin/fees.service";
import { FeeSummary } from "@/types/admin.types";

const METHOD_LABELS: Record<string, string> = {
  cash: "Cash",
  card: "Card",
  bank_transfer: "Bank transfer",
  online: "Online",
  cheque: "Cheque",
  other: "Other",
};

function currency(value: number): string {
  return `₹${value.toLocaleString("en-IN")}`;
}

export function AccountantStudentFeeProfilePage() {
  const { studentId } = useParams<{ studentId: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [recordingPayment, setRecordingPayment] = useState(false);
  const [addingFee, setAddingFee] = useState(false);
  const [viewingPaymentId, setViewingPaymentId] = useState<string | null>(null);

  const { data: summary, isLoading } = useQuery<FeeSummary>({
    queryKey: ["fees", "summary", studentId],
    queryFn: () => feesService.fetchFeeSummary(studentId!),
    enabled: !!studentId,
  });

  function invalidate() {
    queryClient.invalidateQueries({ queryKey: ["fees", "summary", studentId] });
    queryClient.invalidateQueries({ queryKey: ["admin", "fees"] });
  }

  if (isLoading || !summary) {
    return (
      <div className="flex justify-center py-16">
        <Spinner label="Loading fee profile..." />
      </div>
    );
  }

  const { student } = summary;

  return (
    <div className="animate-fade-in space-y-6">
      <button
        type="button"
        onClick={() => navigate("/dashboard/accountant/students")}
        className="inline-flex items-center gap-1.5 text-sm font-medium text-[var(--ink-secondary)] hover:text-[var(--ink-primary)]"
      >
        <ArrowLeft size={15} strokeWidth={1.75} /> Back to Students
      </button>

      <Card className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <Avatar src={student.avatarUrl} name={student.name} size="md" className="h-16 w-16 text-xl" />
          <div>
            <h1 className="text-xl font-semibold text-[var(--ink-primary)]">{student.name}</h1>
            <p className="text-sm text-[var(--ink-muted)]">
              {student.admissionNo} · {student.className} {student.rollNo ? `· Roll No ${student.rollNo}` : ""}
            </p>
            <p className="mt-1 text-xs text-[var(--ink-muted)]">
              Parent: {student.parentName ?? "—"} {student.parentContact ? `· ${student.parentContact}` : ""}
              {student.contactNumber ? ` · Student: ${student.contactNumber}` : ""}
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="secondary" onClick={() => setAddingFee(true)}>
            <Plus size={16} className="mr-1.5 inline" strokeWidth={1.75} /> Add fee
          </Button>
          <Button onClick={() => setRecordingPayment(true)}>
            <CreditCard size={16} className="mr-1.5 inline" strokeWidth={1.75} /> Record payment
          </Button>
        </div>
      </Card>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 xl:grid-cols-6">
        {[
          { label: "Total Fee", value: summary.totalGross },
          { label: "Discount", value: summary.totalDiscount },
          { label: "Scholarship", value: summary.totalScholarship },
          { label: "Total Paid", value: summary.totalPaid },
          { label: "Pending", value: summary.balance },
          { label: "Net Due", value: summary.totalDue },
        ].map((item) => (
          <Card key={item.label} className="text-center">
            <p className="text-xs text-[var(--ink-muted)]">{item.label}</p>
            <p className="mt-1 text-lg font-semibold text-[var(--ink-primary)]">{currency(item.value)}</p>
          </Card>
        ))}
      </div>
      {summary.dueDate && (
        <p className="text-sm text-[var(--ink-muted)]">
          Next due date: <span className="font-medium text-[var(--ink-primary)]">{new Date(summary.dueDate).toLocaleDateString("en-IN")}</span>
        </p>
      )}

      <Card>
        <FeeStructureSection
          studentId={studentId!}
          structures={summary.structures}
          transportFee={summary.transportFee}
          onChanged={invalidate}
          canManageTransportFee={false}
        />
      </Card>

      <Card>
        <h2 className="mb-3 text-sm font-semibold text-[var(--ink-primary)]">Payment History</h2>
        {summary.payments.length === 0 ? (
          <EmptyState icon={Receipt} title="No payments yet" description="Payments recorded for this student will show up here." />
        ) : (
          <DataTable
            rows={summary.payments}
            rowKey={(p) => p.id}
            columns={[
              { header: "Receipt No", cell: (p) => p.receipt_no },
              { header: "Date", cell: (p) => new Date(p.payment_date).toLocaleDateString("en-IN") },
              { header: "Mode", cell: (p) => METHOD_LABELS[p.payment_method] ?? p.payment_method },
              { header: "Amount Paid", cell: (p) => currency(p.amount) },
              {
                header: "",
                className: "text-right",
                cell: (p) => (
                  <Button variant="ghost" className="!px-2 !py-1 text-xs" onClick={() => setViewingPaymentId(p.id)}>
                    View / print receipt
                  </Button>
                ),
              },
            ]}
          />
        )}
      </Card>

      <RecordPaymentModal
        studentId={recordingPayment ? studentId! : null}
        studentName={student.name}
        onClose={() => setRecordingPayment(false)}
        onSuccess={() => {
          invalidate();
          setRecordingPayment(false);
        }}
      />
      <AddStudentFeeModal
        studentId={addingFee ? studentId! : null}
        studentName={student.name}
        onClose={() => setAddingFee(false)}
        onSuccess={() => {
          invalidate();
          setAddingFee(false);
        }}
      />
      <ReceiptModal paymentId={viewingPaymentId} onClose={() => setViewingPaymentId(null)} />
    </div>
  );
}
