import { useState } from "react";
import { useForm } from "react-hook-form";
import { useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Modal } from "@/components/ui/Modal";
import { DataTable } from "@/components/ui/DataTable";
import { Badge, BadgeVariant } from "@/components/ui/Badge";
import { useToast } from "@/components/ui/Toast";
import * as feesService from "@/services/admin/fees.service";
import * as transportService from "@/services/transport.service";
import { FeeStructure, TransportFeeSummary } from "@/types/admin.types";

const TRANSPORT_FEE_BADGE: Record<"paid" | "unpaid" | "partial", BadgeVariant> = {
  paid: "success",
  unpaid: "danger",
  partial: "warning",
};

interface FeeStructureSectionProps {
  studentId: string;
  structures: FeeStructure[];
  transportFee: TransportFeeSummary | null;
  /** Called after any fee line is adjusted, edited, removed, or its transport fee changed, so the caller can refetch the fee summary. */
  onChanged: () => void;
  /** Set to false when the current user doesn't hold transport.manage (e.g. accountant) — hides the Transport Fee row's Edit action rather than exposing an action that would 403. */
  canManageTransportFee?: boolean;
}

/**
 * The "Fee structure" table on a student's fee page, with per-line actions:
 * a class-level fee can be overridden for this one student ("Adjust"), a
 * per-student ad hoc fee item can be edited/removed directly ("Edit"), and
 * the transport fee (a separate table entirely — student_pickup_points, not
 * fee_structures) can be edited if the caller holds transport.manage.
 * Shared between the admin Student Profile page and the accountant Student
 * Fee Profile page, which both show the same fee summary.
 */
export function FeeStructureSection({
  studentId,
  structures,
  transportFee,
  onChanged,
  canManageTransportFee = true,
}: FeeStructureSectionProps) {
  const toast = useToast();

  const [adjustTarget, setAdjustTarget] = useState<FeeStructure | null>(null);
  const {
    register: registerOverride,
    handleSubmit: handleOverrideSubmit,
    reset: resetOverride,
    formState: { isSubmitting: isOverrideSubmitting },
  } = useForm({ defaultValues: { override_amount: "", reason: "" } });

  const overrideMutation = useMutation({
    mutationFn: (vars: { feeStructureId: string; override_amount: number; reason?: string }) =>
      feesService.upsertStudentFeeOverride(studentId, vars.feeStructureId, {
        override_amount: vars.override_amount,
        reason: vars.reason,
      }),
    onSuccess: () => {
      onChanged();
      setAdjustTarget(null);
      toast.success("Fee adjusted for this student");
    },
  });

  const removeOverrideMutation = useMutation({
    mutationFn: (feeStructureId: string) => feesService.deleteStudentFeeOverride(studentId, feeStructureId),
    onSuccess: () => {
      onChanged();
      setAdjustTarget(null);
      toast.success("Fee reset to the class default");
    },
  });

  function openAdjustModal(structure: FeeStructure) {
    setAdjustTarget(structure);
    resetOverride({
      override_amount: String(structure.override_amount ?? structure.amount),
      reason: structure.override_reason ?? "",
    });
  }

  // Per-student ad hoc fee items (fee_structures rows with student_id set,
  // e.g. a one-off "Books Fee") aren't a class-wide default to override —
  // they're already this student's own amount, so editing them means
  // updating the row directly via the existing fee_structures endpoints.
  const [editItemTarget, setEditItemTarget] = useState<FeeStructure | null>(null);
  const {
    register: registerEditItem,
    handleSubmit: handleEditItemSubmit,
    reset: resetEditItem,
    formState: { isSubmitting: isEditItemSubmitting },
  } = useForm({ defaultValues: { amount: "" } });

  const updateFeeItemMutation = useMutation({
    mutationFn: (vars: { id: string; amount: number }) => feesService.updateFeeStructure(vars.id, { amount: vars.amount }),
    onSuccess: () => {
      onChanged();
      setEditItemTarget(null);
      toast.success("Fee updated");
    },
  });

  const deleteFeeItemMutation = useMutation({
    mutationFn: (id: string) => feesService.deleteFeeStructure(id),
    onSuccess: () => {
      onChanged();
      setEditItemTarget(null);
      toast.success("Fee removed");
    },
  });

  function openEditItemModal(structure: FeeStructure) {
    setEditItemTarget(structure);
    resetEditItem({ amount: String(structure.amount) });
  }

  // The Transport Fee row isn't a fee_structures row at all — it's the
  // student's transport assignment fee (student_pickup_points.fee_amount,
  // already per-student), edited via the same transport-fees endpoint the
  // Transport module's Fees tab uses.
  const [isTransportFeeOpen, setTransportFeeOpen] = useState(false);
  const {
    register: registerTransportFee,
    handleSubmit: handleTransportFeeSubmit,
    reset: resetTransportFee,
    formState: { isSubmitting: isTransportFeeSubmitting },
  } = useForm({ defaultValues: { fee_amount: "" } });

  const transportFeeMutation = useMutation({
    mutationFn: (amount: number) => transportService.setTransportFee(studentId, { fee_amount: amount }),
    onSuccess: () => {
      onChanged();
      setTransportFeeOpen(false);
      toast.success("Transport fee updated");
    },
  });

  function openTransportFeeModal() {
    resetTransportFee({ fee_amount: String(transportFee?.fee_amount ?? "") });
    setTransportFeeOpen(true);
  }

  const feeLines = [
    ...structures.map((s) => ({
      key: s.id,
      term: s.term,
      amount: s.override_amount ?? Number(s.amount),
      due_date: s.due_date,
      status: null as null | "paid" | "unpaid" | "partial",
      structure: s as FeeStructure | null,
    })),
    ...(transportFee
      ? [
          {
            key: "transport-fee",
            term: "Transport Fee",
            amount: transportFee.fee_amount,
            due_date: transportFee.fee_due_date,
            status: transportFee.payment_status,
            structure: null,
          },
        ]
      : []),
  ];

  return (
    <div>
      <h3 className="mb-2 text-sm font-medium text-slate-700 dark:text-slate-300">
        Fee structure ({structures.length + (transportFee ? 1 : 0)})
      </h3>
      <DataTable
        rows={feeLines}
        rowKey={(s) => s.key}
        emptyMessage="No fee structure defined for this student's class yet."
        columns={[
          { header: "Term", cell: (s) => s.term },
          {
            header: "Amount",
            cell: (s) =>
              s.structure?.override_amount != null ? (
                <span>
                  <span className="text-slate-400 line-through">₹{Number(s.structure.original_amount ?? s.structure.amount).toFixed(2)}</span>{" "}
                  <span className="font-medium text-slate-800 dark:text-slate-100">₹{Number(s.structure.override_amount).toFixed(2)}</span>
                </span>
              ) : (
                `₹${s.amount.toFixed(2)}`
              ),
          },
          { header: "Due date", cell: (s) => s.due_date ?? "—" },
          {
            header: "Status",
            cell: (s) =>
              s.status ? <Badge variant={TRANSPORT_FEE_BADGE[s.status]}>{s.status}</Badge> : <span className="text-slate-400">—</span>,
          },
          {
            header: "",
            cell: (s) => {
              if (s.structure?.class_id) {
                return (
                  <Button variant="ghost" className="!px-2 !py-1 text-xs" onClick={() => openAdjustModal(s.structure!)}>
                    {s.structure.override_amount != null ? "Adjusted" : "Adjust"}
                  </Button>
                );
              }
              if (s.structure) {
                return (
                  <Button variant="ghost" className="!px-2 !py-1 text-xs" onClick={() => openEditItemModal(s.structure!)}>
                    Edit
                  </Button>
                );
              }
              if (s.key === "transport-fee" && canManageTransportFee) {
                return (
                  <Button variant="ghost" className="!px-2 !py-1 text-xs" onClick={openTransportFeeModal}>
                    Edit
                  </Button>
                );
              }
              return null;
            },
          },
        ]}
      />

      <Modal isOpen={!!adjustTarget} onClose={() => setAdjustTarget(null)} title="Adjust fee for this student">
        {adjustTarget && (
          <form
            className="space-y-4"
            onSubmit={handleOverrideSubmit((values) =>
              overrideMutation.mutate({
                feeStructureId: adjustTarget.id,
                override_amount: Number(values.override_amount),
                reason: values.reason || undefined,
              })
            )}
          >
            <p className="text-sm text-slate-500 dark:text-slate-400">
              Class fee for {adjustTarget.term}: ₹{Number(adjustTarget.original_amount ?? adjustTarget.amount).toFixed(2)}. Set what this
              student alone should owe for this fee.
            </p>
            <Input label="Amount for this student" type="number" step="0.01" {...registerOverride("override_amount", { required: true })} />
            <Input label="Reason (optional)" {...registerOverride("reason")} />
            <div className="flex gap-2">
              <Button type="submit" className="flex-1" isLoading={isOverrideSubmitting || overrideMutation.isPending}>
                Save
              </Button>
              {adjustTarget.override_amount != null && (
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => removeOverrideMutation.mutate(adjustTarget.id)}
                  isLoading={removeOverrideMutation.isPending}
                >
                  Reset to class fee
                </Button>
              )}
            </div>
          </form>
        )}
      </Modal>

      <Modal isOpen={!!editItemTarget} onClose={() => setEditItemTarget(null)} title="Edit fee">
        {editItemTarget && (
          <form
            className="space-y-4"
            onSubmit={handleEditItemSubmit((values) =>
              updateFeeItemMutation.mutate({ id: editItemTarget.id, amount: Number(values.amount) })
            )}
          >
            <p className="text-sm text-slate-500 dark:text-slate-400">{editItemTarget.term}</p>
            <Input label="Amount" type="number" step="0.01" {...registerEditItem("amount", { required: true })} />
            <div className="flex gap-2">
              <Button type="submit" className="flex-1" isLoading={isEditItemSubmitting || updateFeeItemMutation.isPending}>
                Save
              </Button>
              <Button
                type="button"
                variant="ghost"
                onClick={() => deleteFeeItemMutation.mutate(editItemTarget.id)}
                isLoading={deleteFeeItemMutation.isPending}
              >
                Remove fee
              </Button>
            </div>
          </form>
        )}
      </Modal>

      {canManageTransportFee && (
        <Modal isOpen={isTransportFeeOpen} onClose={() => setTransportFeeOpen(false)} title="Edit transport fee">
          <form
            className="space-y-4"
            onSubmit={handleTransportFeeSubmit((values) => transportFeeMutation.mutate(Number(values.fee_amount)))}
          >
            <Input label="Amount" type="number" step="0.01" {...registerTransportFee("fee_amount", { required: true })} />
            <Button type="submit" className="w-full" isLoading={isTransportFeeSubmitting || transportFeeMutation.isPending}>
              Save
            </Button>
          </form>
        </Modal>
      )}
    </div>
  );
}
