import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { CalendarClock, Receipt, Wallet, WalletCards } from "lucide-react";
import { DataTable } from "@/components/ui/DataTable";
import { Button } from "@/components/ui/Button";
import { Badge, BadgeVariant } from "@/components/ui/Badge";
import { useToast } from "@/components/ui/Toast";
import { useSchool } from "@/hooks/useSchool";
import { usePortalStudentId } from "@/context/PortalStudentContext";
import * as feesService from "@/services/portal/fees.service";
import * as profileService from "@/services/portal/profile.service";
import { downloadFeeReceipt } from "@/utils/feeReceipt";
import { getApiErrorMessage } from "@/lib/axios";
import { PortalGlassCard } from "./components/ui/PortalGlassCard";
import { PortalSkeleton } from "./components/ui/PortalSkeleton";
import { PortalEmptyState } from "./components/ui/PortalEmptyState";
import { PortalStatCard } from "./components/ui/PortalStatCard";
import { PortalProgressBar } from "./components/ui/PortalProgressBar";
import { staggerContainer } from "./components/ui/portalMotion";

const PAYMENT_METHOD_LABELS: Record<string, string> = {
  cash: "Cash",
  card: "Card",
  bank_transfer: "Bank Transfer",
  online: "Online",
  cheque: "Cheque",
  other: "Other",
};

const TRANSPORT_FEE_BADGE: Record<"paid" | "unpaid" | "partial", BadgeVariant> = {
  paid: "success",
  unpaid: "danger",
  partial: "warning",
};

export function PortalFeesPage() {
  const studentId = usePortalStudentId();
  const { selectedSchool } = useSchool();
  const toast = useToast();

  const summaryQuery = useQuery({
    queryKey: ["portal", "fees-summary", studentId],
    queryFn: () => feesService.fetchFeeSummary(studentId),
    enabled: !!studentId,
  });
  const paymentsQuery = useQuery({
    queryKey: ["portal", "fees-payments", studentId],
    queryFn: () => feesService.fetchPayments(studentId),
    enabled: !!studentId,
  });
  const profileQuery = useQuery({
    queryKey: ["portal", "profile", studentId],
    queryFn: () => profileService.fetchProfile(studentId),
    enabled: !!studentId,
  });

  const nextDue = (summaryQuery.data?.structures ?? [])
    .filter((s) => s.due_date)
    .sort((a, b) => (a.due_date! < b.due_date! ? -1 : 1))[0];

  const totalDue = summaryQuery.data?.totalDue ?? 0;
  const totalPaid = summaryQuery.data?.totalPaid ?? 0;
  const collectedPercent = totalDue > 0 ? Math.min(100, Math.round((totalPaid / totalDue) * 100)) : 0;

  const transportFee = summaryQuery.data?.transportFee;
  const feeLines = [
    ...(summaryQuery.data?.structures ?? []).map((s) => ({
      key: s.id,
      term: s.term,
      amount: s.override_amount ?? s.amount,
      due_date: s.due_date,
      status: null as null | "paid" | "unpaid" | "partial",
    })),
    ...(transportFee
      ? [
          {
            key: "transport-fee",
            term: "Transport Fee",
            amount: transportFee.fee_amount,
            due_date: transportFee.fee_due_date,
            status: transportFee.payment_status,
          },
        ]
      : []),
  ];

  function handleDownloadReceipt(payment: NonNullable<typeof paymentsQuery.data>[number]) {
    const profile = profileQuery.data;
    try {
      void downloadFeeReceipt({
        id: payment.id,
        receiptNo: payment.receipt_no,
        amount: payment.amount,
        paymentDate: payment.payment_date,
        paymentMethod: payment.payment_method,
        referenceNo: payment.reference_no,
        notes: payment.notes,
        createdAt: payment.created_at,
        studentName: profile?.users?.full_name ?? "",
        admissionNo: profile?.admission_no ?? "",
        className: profile?.classes ? `${profile.classes.name} ${profile.classes.section}` : "",
        recordedByName: null,
        schoolName: selectedSchool.name,
      });
    } catch (err) {
      toast.error(getApiErrorMessage(err, "Failed to generate the receipt."));
    }
  }

  return (
    <div className="space-y-6">
      <div className="border-l-4 pl-4" style={{ borderColor: "var(--portal-accent)" }}>
        <h1 className="text-2xl font-semibold text-[var(--ink-primary)]">Fee Details</h1>
        <p className="text-sm text-[var(--ink-muted)]">Fee summary, structure, and payment history.</p>
      </div>

      {summaryQuery.isLoading ? (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <PortalSkeleton key={i} className="h-24 w-full" />
          ))}
        </div>
      ) : (
        <>
          <motion.div variants={staggerContainer} initial="hidden" animate="show" className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            <PortalStatCard icon={WalletCards} label="Total Fee" value={`₹${totalDue.toFixed(0)}`} />
            <PortalStatCard icon={Wallet} label="Paid" value={`₹${totalPaid.toFixed(0)}`} />
            <PortalStatCard icon={Wallet} label="Pending" value={`₹${Math.max(0, summaryQuery.data?.balance ?? 0).toFixed(0)}`} />
            <PortalStatCard icon={CalendarClock} label="Next Due Date" value={nextDue?.due_date ?? "—"} />
          </motion.div>
          <PortalGlassCard noHover>
            <PortalProgressBar percent={collectedPercent} label="Fee collected" />
          </PortalGlassCard>
        </>
      )}

      <PortalGlassCard noHover className="space-y-4">
        <h2 className="text-lg font-semibold text-[var(--ink-primary)]">Fee Structure</h2>
        {summaryQuery.isLoading ? (
          <PortalSkeleton className="h-24 w-full" />
        ) : feeLines.length === 0 ? (
          <PortalEmptyState title="No fee structure configured yet" icon={Receipt} />
        ) : (
          <DataTable
            rows={feeLines}
            rowKey={(s) => s.key}
            emptyMessage="No fee structure configured yet."
            columns={[
              { header: "Term", cell: (s) => s.term ?? "—" },
              { header: "Amount", cell: (s) => `₹${Number(s.amount).toFixed(2)}` },
              { header: "Due Date", cell: (s) => s.due_date ?? "—" },
              {
                header: "Status",
                cell: (s) =>
                  s.status ? <Badge variant={TRANSPORT_FEE_BADGE[s.status]}>{s.status}</Badge> : <span className="text-slate-400">—</span>,
              },
            ]}
          />
        )}
      </PortalGlassCard>

      <PortalGlassCard noHover className="space-y-4">
        <h2 className="text-lg font-semibold text-[var(--ink-primary)]">Payment History</h2>
        {paymentsQuery.isLoading ? (
          <PortalSkeleton className="h-24 w-full" />
        ) : !paymentsQuery.data?.length ? (
          <PortalEmptyState title="No payments recorded yet" icon={Wallet} />
        ) : (
          <DataTable
            rows={paymentsQuery.data}
            rowKey={(p) => p.id}
            emptyMessage="No payments recorded yet."
            columns={[
              { header: "Receipt No.", cell: (p) => p.receipt_no },
              { header: "Date", cell: (p) => new Date(p.payment_date).toLocaleDateString() },
              { header: "Amount", cell: (p) => `₹${Number(p.amount).toFixed(2)}` },
              { header: "Method", cell: (p) => PAYMENT_METHOD_LABELS[p.payment_method] ?? p.payment_method },
              {
                header: "",
                className: "text-right",
                cell: (p) => (
                  <Button variant="secondary" className="!px-3 !py-1.5 text-xs" onClick={() => handleDownloadReceipt(p)}>
                    Download receipt
                  </Button>
                ),
              },
            ]}
          />
        )}
      </PortalGlassCard>
    </div>
  );
}
