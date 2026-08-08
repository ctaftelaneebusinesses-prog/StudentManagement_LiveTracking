import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Modal } from "@/components/ui/Modal";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { useToast } from "@/components/ui/Toast";
import { getApiErrorMessage } from "@/lib/axios";
import * as feesService from "@/services/admin/fees.service";

const COMMON_TERMS = ["Tuition Fee", "Books Fee", "Uniform Fee", "Exam Fee", "Annual Fee", "Admission Fee", "Other"];

interface AddStudentFeeFormValues {
  term: string;
  amount: string;
  due_date: string;
  discount_amount: string;
  scholarship_amount: string;
}

const EMPTY_FORM: AddStudentFeeFormValues = { term: "", amount: "", due_date: "", discount_amount: "", scholarship_amount: "" };

interface AddStudentFeeModalProps {
  studentId: string | null;
  studentName?: string;
  onClose: () => void;
  onSuccess: () => void;
}

/** Adds a one-off fee item to a single student (e.g. a ₹10,000 Books Fee), distinct from the class-wide rows managed in the Fee Structures tab. The student is notified server-side once this is saved. */
export function AddStudentFeeModal({ studentId, studentName, onClose, onSuccess }: AddStudentFeeModalProps) {
  const toast = useToast();
  const queryClient = useQueryClient();
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<AddStudentFeeFormValues>({ defaultValues: EMPTY_FORM });

  useEffect(() => {
    if (studentId) reset(EMPTY_FORM);
  }, [studentId, reset]);

  const createMutation = useMutation({
    mutationFn: (values: AddStudentFeeFormValues) =>
      feesService.createFeeStructure({
        student_id: studentId!,
        term: values.term,
        amount: Number(values.amount),
        due_date: values.due_date || undefined,
        discount_amount: values.discount_amount ? Number(values.discount_amount) : undefined,
        scholarship_amount: values.scholarship_amount ? Number(values.scholarship_amount) : undefined,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin", "fees"] });
      toast.success("Fee added — the student has been notified.");
      onSuccess();
    },
    onError: (err) => toast.error(getApiErrorMessage(err, "Failed to add fee.")),
  });

  return (
    <Modal isOpen={!!studentId} onClose={onClose} title={studentName ? `Add fee — ${studentName}` : "Add fee"} size="md">
      <form className="space-y-4" onSubmit={handleSubmit((values) => createMutation.mutate(values))}>
        <div>
          <Input
            label="Category"
            list="fee-term-options"
            placeholder="e.g. Books Fee"
            error={errors.term?.message}
            {...register("term", { required: "Category is required" })}
          />
          <datalist id="fee-term-options">
            {COMMON_TERMS.map((t) => (
              <option key={t} value={t} />
            ))}
          </datalist>
        </div>
        <Input
          label="Amount (₹)"
          type="number"
          min={0}
          step="0.01"
          error={errors.amount?.message}
          {...register("amount", { required: "Amount is required", min: { value: 0, message: "Amount must be positive" } })}
        />
        <div className="grid grid-cols-2 gap-4">
          <Input
            label="Discount (₹, optional)"
            type="number"
            min={0}
            step="0.01"
            {...register("discount_amount", { min: { value: 0, message: "Must be 0 or more" } })}
          />
          <Input
            label="Scholarship (₹, optional)"
            type="number"
            min={0}
            step="0.01"
            {...register("scholarship_amount", { min: { value: 0, message: "Must be 0 or more" } })}
          />
        </div>
        <Input label="Due date (optional)" type="date" {...register("due_date")} />
        <Button type="submit" className="w-full" isLoading={isSubmitting || createMutation.isPending}>
          Add fee
        </Button>
      </form>
    </Modal>
  );
}
