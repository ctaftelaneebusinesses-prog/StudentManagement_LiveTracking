import { useState } from "react";
import { useForm } from "react-hook-form";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CalendarPlus } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Select } from "@/components/ui/Select";
import { Input } from "@/components/ui/Input";
import { DatePicker } from "@/components/ui/DatePicker";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { DataTable } from "@/components/ui/DataTable";
import { Badge, BadgeVariant } from "@/components/ui/Badge";
import { Skeleton } from "@/components/ui/Skeleton";
import { useToast } from "@/components/ui/Toast";
import * as leaveRequestsService from "@/services/admin/leaveRequests.service";
import { getApiErrorMessage } from "@/lib/axios";
import { getMinLeaveDate, isLeaveCutoffPassed } from "@/utils/date";
import { LeaveRequest, LeaveRequestStatus } from "@/types/admin.types";
import { LeaveType } from "@/types/teacher.types";

const LEAVE_TYPE_OPTIONS: { value: LeaveType; label: string }[] = [
  { value: "casual", label: "Casual Leave" },
  { value: "sick", label: "Sick Leave" },
  { value: "other", label: "Other Leave" },
];

const STATUS_BADGE: Record<LeaveRequestStatus, BadgeVariant> = {
  pending: "warning",
  approved: "success",
  rejected: "danger",
};

interface ApplyFormValues {
  leave_type: LeaveType;
  start_date: string;
  end_date: string;
  reason: string;
}

/** Principal self-service leave — apply and track status; only admin/super_admin can approve (never another principal), enforced server-side. */
export function MyLeavePage() {
  const queryClient = useQueryClient();
  const toast = useToast();
  const [isModalOpen, setModalOpen] = useState(false);

  const summaryQuery = useQuery({ queryKey: ["principal", "leave-summary"], queryFn: leaveRequestsService.fetchMyLeaveSummary });
  const requestsQuery = useQuery({ queryKey: ["principal", "leave-requests"], queryFn: leaveRequestsService.fetchMyLeaveRequests });

  const minDate = getMinLeaveDate();
  const {
    register,
    handleSubmit,
    reset,
    watch,
    setValue,
    formState: { isSubmitting, errors },
  } = useForm<ApplyFormValues>({
    defaultValues: { leave_type: "casual", start_date: "", end_date: "", reason: "" },
  });
  const startDate = watch("start_date");

  const applyMutation = useMutation({
    mutationFn: (values: ApplyFormValues) =>
      leaveRequestsService.applyForMyLeave({ ...values, reason: values.reason || undefined }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["principal", "leave-requests"] });
      queryClient.invalidateQueries({ queryKey: ["principal", "leave-summary"] });
      reset();
      setModalOpen(false);
      toast.success("Leave request submitted to the admin for approval.");
    },
    onError: (err) => toast.error(getApiErrorMessage(err, "Failed to submit leave request.")),
  });

  const summary = summaryQuery.data;

  return (
    <div className="animate-fade-in space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-[var(--ink-primary)]">My Leave</h1>
          <p className="text-sm text-[var(--ink-muted)]">Your leave requests are reviewed by the school admin.</p>
        </div>
        <Button onClick={() => setModalOpen(true)}>
          <CalendarPlus size={16} className="mr-1.5 inline" strokeWidth={1.75} />
          Apply for leave
        </Button>
      </div>

      {summaryQuery.isLoading || !summary ? (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-24 w-full" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <Card className="text-center">
            <p className="text-3xl font-semibold text-[var(--ink-primary)]">{summary.totalEntitlement}</p>
            <p className="mt-0.5 text-sm text-[var(--ink-muted)]">Total Entitlement</p>
          </Card>
          <Card className="text-center">
            <p className="text-3xl font-semibold text-[var(--ink-primary)]">{summary.totalUsed}</p>
            <p className="mt-0.5 text-sm text-[var(--ink-muted)]">Leave Used</p>
          </Card>
          <Card className="text-center">
            <p className="text-3xl font-semibold text-brand-600">{summary.totalRemaining}</p>
            <p className="mt-0.5 text-sm text-[var(--ink-muted)]">Leave Remaining</p>
          </Card>
          <Card className="text-center">
            <p className="text-3xl font-semibold text-[var(--ink-primary)]">{summary.pendingCount}</p>
            <p className="mt-0.5 text-sm text-[var(--ink-muted)]">Pending Requests</p>
          </Card>
        </div>
      )}

      <Card className="space-y-4">
        <h2 className="text-lg font-semibold text-[var(--ink-primary)]">My leave requests</h2>
        <DataTable<LeaveRequest>
          isLoading={requestsQuery.isLoading}
          rows={requestsQuery.data ?? []}
          rowKey={(r) => r.id}
          emptyMessage="You haven't applied for any leave yet."
          columns={[
            { header: "From", cell: (r) => r.start_date },
            { header: "To", cell: (r) => r.end_date },
            { header: "Reason", cell: (r) => r.reason ?? "—" },
            { header: "Status", cell: (r) => <Badge variant={STATUS_BADGE[r.status]}>{r.status}</Badge> },
            {
              header: "Reviewed by",
              cell: (r) => (r.reviewed_by_role ? "Admin" : "—"),
            },
          ]}
        />
      </Card>

      <Modal isOpen={isModalOpen} onClose={() => setModalOpen(false)} title="Apply for leave">
        <form className="space-y-4" onSubmit={handleSubmit((values) => applyMutation.mutate(values))}>
          <Select label="Leave type" options={LEAVE_TYPE_OPTIONS} {...register("leave_type", { required: true })} />
          {isLeaveCutoffPassed() && (
            <p className="text-xs text-[var(--status-warning)]">
              It's past 6:00 PM, so today is no longer available — the earliest you can apply for is tomorrow.
            </p>
          )}
          <div className="grid grid-cols-2 gap-4">
            <input
              type="hidden"
              {...register("start_date", { required: "Required", validate: (v) => v >= minDate || "Cannot be a past date" })}
            />
            <DatePicker
              label="From"
              value={startDate}
              minDate={minDate}
              error={errors.start_date?.message}
              onChange={(iso) => setValue("start_date", iso, { shouldValidate: true })}
            />
            <input
              type="hidden"
              {...register("end_date", { required: "Required", validate: (v) => v >= startDate || "Cannot be before the start date" })}
            />
            <DatePicker
              label="To"
              value={watch("end_date")}
              minDate={startDate || minDate}
              error={errors.end_date?.message}
              onChange={(iso) => setValue("end_date", iso, { shouldValidate: true })}
            />
          </div>
          <Input label="Reason (optional)" {...register("reason")} />
          {applyMutation.isError && (
            <p className="text-sm text-red-600">{getApiErrorMessage(applyMutation.error, "Failed to submit leave request.")}</p>
          )}
          <Button type="submit" className="w-full" isLoading={isSubmitting || applyMutation.isPending}>
            Submit request
          </Button>
        </form>
      </Modal>
    </div>
  );
}
