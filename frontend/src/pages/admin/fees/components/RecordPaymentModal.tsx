import { useForm } from "react-hook-form";
import { useMutation } from "@tanstack/react-query";
import { Modal } from "@/components/ui/Modal";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Button } from "@/components/ui/Button";
import { getApiErrorMessage } from "@/lib/axios";
import * as feesService from "@/services/admin/fees.service";
import { RecordPaymentInput } from "@/services/admin/fees.service";

interface PaymentFormValues {
  amount: string;
  payment_method: RecordPaymentInput["payment_method"];
  reference_no: string;
  notes: string;
}

interface RecordPaymentModalProps {
  studentId: string | null;
  studentName?: string;
  onClose: () => void;
  onSuccess: () => void;
}

export function RecordPaymentModal({ studentId, studentName, onClose, onSuccess }: RecordPaymentModalProps) {
  const {
    register,
    handleSubmit,
    reset,
    formState: { isSubmitting },
  } = useForm<PaymentFormValues>({
    defaultValues: { amount: "", payment_method: "cash", reference_no: "", notes: "" },
  });

  const mutation = useMutation({
    mutationFn: (values: PaymentFormValues) => {
      if (!studentId) throw new Error("No student selected");
      return feesService.recordPayment(studentId, {
        amount: Number(values.amount),
        payment_method: values.payment_method,
        reference_no: values.reference_no || undefined,
        notes: values.notes || undefined,
      });
    },
    onSuccess: () => {
      reset();
      onSuccess();
    },
  });

  return (
    <Modal isOpen={!!studentId} onClose={onClose} title={studentName ? `Record payment — ${studentName}` : "Record payment"}>
      <form className="space-y-4" onSubmit={handleSubmit((values) => mutation.mutate(values))}>
        <Input label="Amount" type="number" step="0.01" {...register("amount", { required: true })} />
        <Select
          label="Payment method"
          options={[
            { value: "cash", label: "Cash" },
            { value: "card", label: "Card" },
            { value: "bank_transfer", label: "Bank transfer" },
            { value: "online", label: "Online" },
            { value: "cheque", label: "Cheque" },
            { value: "other", label: "Other" },
          ]}
          {...register("payment_method")}
        />
        <Input label="Reference number (optional)" {...register("reference_no")} />
        <Input label="Notes (optional)" {...register("notes")} />
        {mutation.isError && (
          <p className="text-sm text-red-600">{getApiErrorMessage(mutation.error, "Failed to record payment. Please try again.")}</p>
        )}
        <Button type="submit" className="w-full" isLoading={isSubmitting || mutation.isPending}>
          Record payment
        </Button>
      </form>
    </Modal>
  );
}
