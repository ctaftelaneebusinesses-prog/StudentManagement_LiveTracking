import { useState } from "react";
import { useForm } from "react-hook-form";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Layers, PlusCircle, RefreshCw, Trash2 } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Button } from "@/components/ui/Button";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { useToast } from "@/components/ui/Toast";
import { getApiErrorMessage } from "@/lib/axios";
import * as feesService from "@/services/admin/fees.service";
import { ClassSectionSelects, ClassSectionValue } from "@/pages/admin/teachers/components/ClassSectionSelects";
import { academicYearOptions, resolveClassId } from "@/utils/classPicker";
import { useFeeClasses } from "../hooks/useFeeClasses";

type Scope = "school" | "class";
type Action = "assign" | "update" | "remove";

const EMPTY_CLASS_SELECTION: ClassSectionValue = { academicYearId: "", className: "", section: "" };

const ACTIONS: { key: Action; label: string; icon: typeof PlusCircle }[] = [
  { key: "assign", label: "Bulk Assign", icon: PlusCircle },
  { key: "update", label: "Bulk Update", icon: RefreshCw },
  { key: "remove", label: "Bulk Remove", icon: Trash2 },
];

interface FormValues {
  term: string;
  amount: string;
  due_date: string;
  discount_amount: string;
  scholarship_amount: string;
}

const EMPTY_FORM: FormValues = { term: "", amount: "", due_date: "", discount_amount: "", scholarship_amount: "" };

export function BulkFeeManagementTab() {
  const toast = useToast();
  const queryClient = useQueryClient();
  const [action, setAction] = useState<Action>("assign");
  const [scope, setScope] = useState<Scope>("class");
  const [schoolYearId, setSchoolYearId] = useState("");
  const [classSelection, setClassSelection] = useState<ClassSectionValue>(EMPTY_CLASS_SELECTION);
  const [confirmingRemove, setConfirmingRemove] = useState(false);

  const classesQuery = useFeeClasses();
  const classes = classesQuery.data ?? [];
  const yearOptions = academicYearOptions(classes);
  const classId =
    scope === "class" ? resolveClassId(classes, classSelection.academicYearId, classSelection.className, classSelection.section) : undefined;

  const { register, handleSubmit, reset, watch } = useForm<FormValues>({ defaultValues: EMPTY_FORM });
  const term = watch("term");

  function invalidate() {
    queryClient.invalidateQueries({ queryKey: ["admin", "fees"] });
    queryClient.invalidateQueries({ queryKey: ["fees"] });
  }

  const assignMutation = useMutation({
    mutationFn: (values: FormValues) =>
      feesService.bulkAssignFees({
        scope,
        classIds: classId ? [classId] : undefined,
        academicYearId: scope === "school" ? schoolYearId || undefined : undefined,
        term: values.term,
        amount: Number(values.amount),
        due_date: values.due_date || undefined,
        discount_amount: values.discount_amount ? Number(values.discount_amount) : undefined,
        scholarship_amount: values.scholarship_amount ? Number(values.scholarship_amount) : undefined,
      }),
    onSuccess: (result) => {
      invalidate();
      reset(EMPTY_FORM);
      toast.success(`Assigned to ${result.created} record(s)${result.skipped ? `, skipped ${result.skipped} duplicate(s)` : ""}.`);
    },
    onError: (err) => toast.error(getApiErrorMessage(err, "Failed to bulk-assign fees.")),
  });

  const updateMutation = useMutation({
    mutationFn: (values: FormValues) =>
      feesService.bulkUpdateFees({
        classIds: classId ? [classId] : undefined,
        academicYearId: scope === "school" ? schoolYearId || undefined : undefined,
        term: values.term || undefined,
        patch: {
          amount: values.amount ? Number(values.amount) : undefined,
          due_date: values.due_date || undefined,
          discount_amount: values.discount_amount ? Number(values.discount_amount) : undefined,
          scholarship_amount: values.scholarship_amount ? Number(values.scholarship_amount) : undefined,
        },
      }),
    onSuccess: (result) => {
      invalidate();
      reset(EMPTY_FORM);
      toast.success(`Updated ${result.updated} record(s).`);
    },
    onError: (err) => toast.error(getApiErrorMessage(err, "Failed to bulk-update fees.")),
  });

  const removeMutation = useMutation({
    mutationFn: () =>
      feesService.bulkRemoveFees({
        classIds: classId ? [classId] : undefined,
        academicYearId: scope === "school" ? schoolYearId || undefined : undefined,
        term: term || undefined,
      }),
    onSuccess: (result) => {
      invalidate();
      setConfirmingRemove(false);
      toast.success(`Removed ${result.removed} record(s)${result.skipped ? `, skipped ${result.skipped} with existing payments` : ""}.`);
    },
    onError: (err) => {
      setConfirmingRemove(false);
      toast.error(getApiErrorMessage(err, "Failed to bulk-remove fees."));
    },
  });

  const canSubmit = scope === "school" || !!classId;

  return (
    <div className="animate-fade-in space-y-4">
      <div>
        <h2 className="text-lg font-semibold text-[var(--ink-primary)]">Bulk fee management</h2>
        <p className="text-sm text-[var(--ink-muted)]">Assign, update, or remove fees across the whole school or one class at once.</p>
      </div>

      <div className="flex flex-wrap gap-1 rounded-xl border border-black/[0.06] bg-white p-1 dark:border-white/[0.08] dark:bg-[#17171a]">
        {ACTIONS.map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            type="button"
            onClick={() => setAction(key)}
            className={`inline-flex items-center gap-2 rounded-lg px-3.5 py-2 text-sm font-medium transition-colors ${
              action === key ? "bg-accent-600 text-white shadow-sm" : "text-[var(--ink-secondary)] hover:bg-black/[0.04] dark:hover:bg-white/[0.06]"
            }`}
          >
            <Icon size={16} strokeWidth={1.75} />
            {label}
          </button>
        ))}
      </div>

      <Card className="space-y-4">
        <div className="flex flex-wrap items-end gap-4">
          <Select
            label="Scope"
            options={[
              { value: "class", label: "Selected class" },
              { value: "school", label: "Entire school" },
            ]}
            value={scope}
            onChange={(e) => setScope(e.target.value as Scope)}
          />
          {scope === "class" ? (
            <ClassSectionSelects classes={classes} value={classSelection} onChange={setClassSelection} />
          ) : (
            <Select
              label="Academic year (optional)"
              placeholder="All years"
              options={yearOptions}
              value={schoolYearId}
              onChange={(e) => setSchoolYearId(e.target.value)}
            />
          )}
        </div>
        {scope === "class" && !classId && (
          <p className="flex items-center gap-1.5 text-xs text-[var(--ink-muted)]">
            <Layers size={13} /> Select a full academic year, class, and section above to continue.
          </p>
        )}
      </Card>

      {action !== "remove" ? (
        <Card>
          <form
            className="space-y-4"
            onSubmit={handleSubmit((values) => (action === "assign" ? assignMutation.mutate(values) : updateMutation.mutate(values)))}
          >
            <Input
              label={action === "assign" ? "Term / Fee type" : "Term / Fee type (optional filter — leave blank to match all terms)"}
              placeholder="e.g. Tuition Fee"
              {...register("term", action === "assign" ? { required: "Term is required" } : {})}
            />
            <div className="grid grid-cols-2 gap-4">
              <Input
                label={action === "assign" ? "Amount (₹)" : "Amount (₹, optional)"}
                type="number"
                min={0}
                step="0.01"
                {...register("amount", action === "assign" ? { required: "Amount is required" } : {})}
              />
              <Input label="Due date (optional)" type="date" {...register("due_date")} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <Input label="Discount (₹, optional)" type="number" min={0} step="0.01" {...register("discount_amount")} />
              <Input label="Scholarship (₹, optional)" type="number" min={0} step="0.01" {...register("scholarship_amount")} />
            </div>
            <Button
              type="submit"
              className="w-full"
              disabled={!canSubmit}
              isLoading={assignMutation.isPending || updateMutation.isPending}
            >
              {action === "assign" ? "Assign fee to matching students" : "Update matching fee records"}
            </Button>
          </form>
        </Card>
      ) : (
        <Card className="space-y-4">
          <Input
            label="Term / Fee type (optional filter — leave blank to match all terms)"
            placeholder="e.g. Tuition Fee"
            {...register("term")}
          />
          <Button
            variant="danger"
            className="w-full"
            disabled={!canSubmit}
            onClick={() => setConfirmingRemove(true)}
          >
            <Trash2 size={16} className="mr-1.5 inline" strokeWidth={1.75} />
            Remove matching fee records
          </Button>
        </Card>
      )}

      <ConfirmDialog
        isOpen={confirmingRemove}
        title="Remove fee records"
        message="This removes every matching fee record that has no payments recorded against it (records with payments are skipped, not deleted). This cannot be undone. Continue?"
        confirmLabel="Remove"
        isLoading={removeMutation.isPending}
        onConfirm={() => removeMutation.mutate()}
        onCancel={() => setConfirmingRemove(false)}
      />
    </div>
  );
}
