import { useQuery } from "@tanstack/react-query";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { Spinner } from "@/components/ui/Spinner";
import * as feesService from "@/services/admin/fees.service";
import { downloadFeeReceipt } from "@/utils/feeReceipt";

const METHOD_LABELS: Record<string, string> = {
  cash: "Cash",
  card: "Card",
  bank_transfer: "Bank transfer",
  online: "Online",
  cheque: "Cheque",
  other: "Other",
};

export function ReceiptModal({ paymentId, onClose }: { paymentId: string | null; onClose: () => void }) {
  const { data: receipt, isLoading } = useQuery({
    queryKey: ["admin", "fees", "receipt", paymentId],
    queryFn: () => feesService.fetchReceipt(paymentId!),
    enabled: !!paymentId,
  });

  return (
    <Modal isOpen={!!paymentId} onClose={onClose} title="Fee Receipt">
      {isLoading || !receipt ? (
        <Spinner label="Loading receipt..." />
      ) : (
        <div className="space-y-5">
          <div className="flex items-start justify-between border-b border-slate-200 pb-4 dark:border-white/10">
            <div>
              <p className="text-sm font-semibold text-slate-900 dark:text-white">{receipt.schoolName}</p>
              <p className="text-xs text-slate-500 dark:text-slate-400">Fee payment receipt</p>
            </div>
            <div className="text-right">
              <p className="text-xs text-slate-500 dark:text-slate-400">Receipt No</p>
              <p className="text-sm font-semibold text-slate-900 dark:text-white">{receipt.receiptNo}</p>
            </div>
          </div>

          <dl className="grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
            <div>
              <dt className="text-xs text-slate-500 dark:text-slate-400">Student</dt>
              <dd className="font-medium text-slate-800 dark:text-slate-100">{receipt.studentName}</dd>
            </div>
            <div>
              <dt className="text-xs text-slate-500 dark:text-slate-400">Admission No</dt>
              <dd className="font-medium text-slate-800 dark:text-slate-100">{receipt.admissionNo}</dd>
            </div>
            <div>
              <dt className="text-xs text-slate-500 dark:text-slate-400">Class</dt>
              <dd className="font-medium text-slate-800 dark:text-slate-100">{receipt.className || "—"}</dd>
            </div>
            <div>
              <dt className="text-xs text-slate-500 dark:text-slate-400">Date</dt>
              <dd className="font-medium text-slate-800 dark:text-slate-100">
                {new Date(receipt.paymentDate).toLocaleDateString("en-IN")}
              </dd>
            </div>
            <div>
              <dt className="text-xs text-slate-500 dark:text-slate-400">Payment method</dt>
              <dd className="font-medium text-slate-800 dark:text-slate-100">{METHOD_LABELS[receipt.paymentMethod] ?? receipt.paymentMethod}</dd>
            </div>
            <div>
              <dt className="text-xs text-slate-500 dark:text-slate-400">Reference No</dt>
              <dd className="font-medium text-slate-800 dark:text-slate-100">{receipt.referenceNo || "—"}</dd>
            </div>
          </dl>

          <div className="rounded-xl bg-brand-50 px-4 py-3 dark:bg-white/5">
            <p className="text-xs font-medium text-slate-500 dark:text-slate-400">Amount Paid</p>
            <p className="text-2xl font-semibold text-slate-900 dark:text-white">₹{receipt.amount.toFixed(2)}</p>
          </div>

          {receipt.notes && <p className="text-xs italic text-slate-500 dark:text-slate-400">Notes: {receipt.notes}</p>}

          <Button className="w-full" onClick={() => downloadFeeReceipt(receipt)}>
            Download PDF
          </Button>
        </div>
      )}
    </Modal>
  );
}
