import { useState } from "react";
import { useForm } from "react-hook-form";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, Pencil, Trash2, Wallet } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Modal } from "@/components/ui/Modal";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { DataTable, Column } from "@/components/ui/DataTable";
import { EmptyState } from "@/components/ui/EmptyState";
import { useToast } from "@/components/ui/Toast";
import { getApiErrorMessage } from "@/lib/axios";
import * as feesService from "@/services/admin/fees.service";
import { FeeStructure } from "@/types/admin.types";

const COMMON_TERMS = ["Tuition Fee", "Transport Fee", "Exam Fee", "Annual Fee", "Admission Fee", "Other"];

interface FeeStructureFormValues {
  class_id: string;
  term: string;
  amount: string;
  due_date: string;
  discount_amount: string;
  scholarship_amount: string;
}

const EMPTY_FORM: FeeStructureFormValues = {
  class_id: "",
  term: "",
  amount: "",
  due_date: "",
  discount_amount: "",
  scholarship_amount: "",
};

export function FeeStructuresTab() {
  const queryClient = useQueryClient();
  const toast = useToast();
  const [isCreateOpen, setCreateOpen] = useState(false);
  const [editingStructure, setEditingStructure] = useState<FeeStructure | null>(null);
  const [deletingStructure, setDeletingStructure] = useState<FeeStructure | null>(null);

  // fetchFeeClasses (not classesService.fetchClasses) is deliberate — it's
  // gated by `fees.view`, not `classes.manage`, so this tab (shared by the
  // admin Fees module and the accountant portal) works for accountant too.
  const { data: classes = [] } = useQuery({ queryKey: ["fees", "classes"], queryFn: feesService.fetchFeeClasses });
  const classOptions = classes.map((c) => ({ value: c.id, label: `${c.name} - ${c.section}` }));

  const { data: structures = [], isLoading } = useQuery({
    queryKey: ["admin", "fees", "structures"],
    queryFn: () => feesService.fetchFeeStructures(),
  });

  function invalidate() {
    queryClient.invalidateQueries({ queryKey: ["admin", "fees", "structures"] });
  }

  const createForm = useForm<FeeStructureFormValues>({ defaultValues: EMPTY_FORM });
  const editForm = useForm<FeeStructureFormValues>({ defaultValues: EMPTY_FORM });

  const createMutation = useMutation({
    mutationFn: (values: FeeStructureFormValues) =>
      feesService.createFeeStructure({
        class_id: values.class_id,
        term: values.term,
        amount: Number(values.amount),
        due_date: values.due_date || undefined,
        discount_amount: values.discount_amount ? Number(values.discount_amount) : undefined,
        scholarship_amount: values.scholarship_amount ? Number(values.scholarship_amount) : undefined,
      }),
    onSuccess: () => {
      invalidate();
      createForm.reset(EMPTY_FORM);
      setCreateOpen(false);
    },
  });

  const updateMutation = useMutation({
    mutationFn: (values: FeeStructureFormValues) =>
      feesService.updateFeeStructure(editingStructure!.id, {
        class_id: values.class_id,
        term: values.term,
        amount: Number(values.amount),
        due_date: values.due_date || undefined,
        discount_amount: values.discount_amount ? Number(values.discount_amount) : undefined,
        scholarship_amount: values.scholarship_amount ? Number(values.scholarship_amount) : undefined,
      }),
    onSuccess: () => {
      invalidate();
      setEditingStructure(null);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => feesService.deleteFeeStructure(id),
    onSuccess: () => {
      invalidate();
      setDeletingStructure(null);
    },
    onError: (err) => toast.error(getApiErrorMessage(err, "Failed to remove fee structure.")),
  });

  function openEdit(structure: FeeStructure) {
    editForm.reset({
      class_id: structure.class_id ?? "",
      term: structure.term,
      amount: String(structure.amount),
      due_date: structure.due_date ?? "",
      discount_amount: structure.discount_amount ? String(structure.discount_amount) : "",
      scholarship_amount: structure.scholarship_amount ? String(structure.scholarship_amount) : "",
    });
    setEditingStructure(structure);
  }

  const columns: Column<FeeStructure>[] = [
    { header: "Term / Fee Type", cell: (s) => s.term },
    { header: "Class", cell: (s) => (s.classes ? `${s.classes.name} - ${s.classes.section}` : "—") },
    { header: "Amount", cell: (s) => `₹${s.amount.toLocaleString("en-IN")}` },
    {
      header: "Discount / Scholarship",
      cell: (s) =>
        s.discount_amount || s.scholarship_amount
          ? `₹${(s.discount_amount + s.scholarship_amount).toLocaleString("en-IN")}`
          : "—",
    },
    { header: "Due Date", cell: (s) => s.due_date ?? "—" },
    {
      header: "",
      cell: (s) => (
        <div className="flex justify-end gap-1">
          <Button variant="ghost" className="!p-1.5" title="Edit" onClick={() => openEdit(s)}>
            <Pencil size={14} />
          </Button>
          <Button variant="ghost" className="!p-1.5 text-red-600" title="Delete" onClick={() => setDeletingStructure(s)}>
            <Trash2 size={14} />
          </Button>
        </div>
      ),
      className: "text-right",
    },
  ];

  return (
    <div className="animate-fade-in space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-[var(--ink-primary)]">Fee structures</h2>
          <p className="text-sm text-[var(--ink-muted)]">Define what's due per class — tuition, transport, exam, annual fees, and any custom amount.</p>
        </div>
        <Button onClick={() => setCreateOpen(true)}>
          <Plus size={16} /> Add fee structure
        </Button>
      </div>

      {isLoading ? null : structures.length === 0 ? (
        <div className="rounded-2xl border border-black/[0.06] bg-white py-4 dark:border-white/[0.08] dark:bg-[#17171a]">
          <EmptyState icon={Wallet} title="No fee structures yet" description="Add one to start billing students for a class." />
        </div>
      ) : (
        <div className="rounded-2xl border border-black/[0.06] bg-white p-2 dark:border-white/[0.08] dark:bg-[#17171a]">
          <DataTable<FeeStructure> columns={columns} rows={structures} rowKey={(s) => s.id} isLoading={isLoading} />
        </div>
      )}

      {/* Create */}
      <Modal isOpen={isCreateOpen} onClose={() => setCreateOpen(false)} title="Add fee structure">
        <form className="space-y-4" onSubmit={createForm.handleSubmit((values) => createMutation.mutate(values))}>
          <Select
            label="Class"
            placeholder="Select class"
            options={classOptions}
            error={createForm.formState.errors.class_id?.message}
            {...createForm.register("class_id", { required: "Class is required" })}
          />
          <Input
            label="Term / Fee type"
            list="fee-term-options"
            placeholder="e.g. Tuition Fee"
            error={createForm.formState.errors.term?.message}
            {...createForm.register("term", { required: "Term is required" })}
          />
          <datalist id="fee-term-options">
            {COMMON_TERMS.map((t) => (
              <option key={t} value={t} />
            ))}
          </datalist>
          <Input
            label="Amount (₹)"
            type="number"
            min={0}
            step="0.01"
            error={createForm.formState.errors.amount?.message}
            {...createForm.register("amount", { required: "Amount is required", min: { value: 0, message: "Amount must be 0 or more" } })}
          />
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Input
              label="Discount (₹, optional)"
              type="number"
              min={0}
              step="0.01"
              {...createForm.register("discount_amount", { min: { value: 0, message: "Must be 0 or more" } })}
            />
            <Input
              label="Scholarship (₹, optional)"
              type="number"
              min={0}
              step="0.01"
              {...createForm.register("scholarship_amount", { min: { value: 0, message: "Must be 0 or more" } })}
            />
          </div>
          <Input label="Due date (optional)" type="date" {...createForm.register("due_date")} />
          {createMutation.isError && (
            <p className="text-sm text-red-600">{getApiErrorMessage(createMutation.error, "Failed to create fee structure.")}</p>
          )}
          <Button type="submit" className="w-full" isLoading={createMutation.isPending}>
            Add fee structure
          </Button>
        </form>
      </Modal>

      {/* Edit */}
      <Modal isOpen={!!editingStructure} onClose={() => setEditingStructure(null)} title="Edit fee structure">
        <form className="space-y-4" onSubmit={editForm.handleSubmit((values) => updateMutation.mutate(values))}>
          <Select
            label="Class"
            placeholder="Select class"
            options={classOptions}
            error={editForm.formState.errors.class_id?.message}
            {...editForm.register("class_id", { required: "Class is required" })}
          />
          <Input
            label="Term / Fee type"
            error={editForm.formState.errors.term?.message}
            {...editForm.register("term", { required: "Term is required" })}
          />
          <Input
            label="Amount (₹)"
            type="number"
            min={0}
            step="0.01"
            error={editForm.formState.errors.amount?.message}
            {...editForm.register("amount", { required: "Amount is required", min: { value: 0, message: "Amount must be 0 or more" } })}
          />
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Input
              label="Discount (₹, optional)"
              type="number"
              min={0}
              step="0.01"
              {...editForm.register("discount_amount", { min: { value: 0, message: "Must be 0 or more" } })}
            />
            <Input
              label="Scholarship (₹, optional)"
              type="number"
              min={0}
              step="0.01"
              {...editForm.register("scholarship_amount", { min: { value: 0, message: "Must be 0 or more" } })}
            />
          </div>
          <Input label="Due date (optional)" type="date" {...editForm.register("due_date")} />
          {updateMutation.isError && (
            <p className="text-sm text-red-600">{getApiErrorMessage(updateMutation.error, "Failed to update fee structure.")}</p>
          )}
          <Button type="submit" className="w-full" isLoading={updateMutation.isPending}>
            Save changes
          </Button>
        </form>
      </Modal>

      {/* Delete */}
      <ConfirmDialog
        isOpen={!!deletingStructure}
        title="Delete fee structure"
        message={`Delete the "${deletingStructure?.term}" fee structure for ${deletingStructure?.classes ? `${deletingStructure.classes.name} - ${deletingStructure.classes.section}` : "this class"}? Existing payment records are kept, just unlinked from this structure.`}
        confirmLabel="Delete"
        isLoading={deleteMutation.isPending}
        onConfirm={() => deletingStructure && deleteMutation.mutate(deletingStructure.id)}
        onCancel={() => setDeletingStructure(null)}
      />
    </div>
  );
}
