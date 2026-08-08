import { FeeStatus } from "@/types/fees.types";

const STATUS_STYLES: Record<FeeStatus, string> = {
  paid: "bg-[var(--status-good)]/10 text-[var(--status-good)]",
  partial: "bg-[var(--status-warning)]/10 text-[var(--status-warning)]",
  unpaid: "bg-[var(--status-serious)]/10 text-[var(--status-serious)]",
};

const STATUS_LABELS: Record<FeeStatus, string> = {
  paid: "Paid",
  partial: "Partially paid",
  unpaid: "Unpaid",
};

export function FeeStatusBadge({ status }: { status: FeeStatus }) {
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold ${STATUS_STYLES[status]}`}>
      {STATUS_LABELS[status]}
    </span>
  );
}
