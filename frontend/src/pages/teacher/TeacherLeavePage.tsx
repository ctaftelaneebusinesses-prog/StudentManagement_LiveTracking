import { useState } from "react";
import { useForm } from "react-hook-form";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CalendarPlus, Check, X } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Select } from "@/components/ui/Select";
import { Input } from "@/components/ui/Input";
import { DatePicker } from "@/components/ui/DatePicker";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { DataTable } from "@/components/ui/DataTable";
import { Badge, BadgeVariant } from "@/components/ui/Badge";
import { Skeleton } from "@/components/ui/Skeleton";
import { Tabs } from "@/components/ui/Tabs";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { useToast } from "@/components/ui/Toast";
import * as leaveService from "@/services/teacher/leave.service";
import * as portalService from "@/services/teacher/portal.service";
import { getApiErrorMessage } from "@/lib/axios";
import { getMinLeaveDate, isLeaveCutoffPassed } from "@/utils/date";
import { LeaveRequestRecord, LeaveStatus, LeaveType } from "@/types/teacher.types";
import { StudentLeaveQueueRecord, StudentLeaveStatus } from "@/types/leave.types";

const LEAVE_TYPE_OPTIONS: { value: LeaveType; label: string }[] = [
  { value: "casual", label: "Casual Leave" },
  { value: "sick", label: "Sick Leave" },
  { value: "other", label: "Other Leave" },
];

const STATUS_BADGE: Record<LeaveStatus, BadgeVariant> = {
  pending: "warning",
  approved: "success",
  rejected: "danger",
};

const STUDENT_STATUS_BADGE: Record<StudentLeaveStatus, BadgeVariant> = {
  pending: "warning",
  approved: "success",
  rejected: "danger",
  cancelled: "neutral",
};

interface ApplyFormValues {
  leave_type: LeaveType;
  start_date: string;
  end_date: string;
  reason: string;
}

type LeaveTab = "mine" | "students";

export function TeacherLeavePage() {
  const queryClient = useQueryClient();
  const toast = useToast();
  const [isModalOpen, setModalOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<LeaveTab>("mine");

  const dashboardQuery = useQuery({ queryKey: ["teacher", "dashboard"], queryFn: portalService.fetchDashboard });
  const isClassTeacher = dashboardQuery.data?.classes.some((c) => c.isHomeroom) ?? false;

  const summaryQuery = useQuery({ queryKey: ["teacher", "leave-summary"], queryFn: leaveService.fetchLeaveSummary });
  const requestsQuery = useQuery({ queryKey: ["teacher", "leave-requests"], queryFn: leaveService.fetchMyLeaveRequests });

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
    mutationFn: (values: ApplyFormValues) => leaveService.applyForLeave({ ...values, reason: values.reason || undefined }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["teacher", "leave-requests"] });
      queryClient.invalidateQueries({ queryKey: ["teacher", "leave-summary"] });
      queryClient.invalidateQueries({ queryKey: ["teacher", "dashboard"] });
      reset();
      setModalOpen(false);
      toast.success("Leave request submitted for approval");
    },
  });

  const summary = summaryQuery.data;

  return (
    <div className="animate-fade-in space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-[var(--ink-primary)]">Leave Management</h1>
          <p className="text-sm text-[var(--ink-muted)]">Your leave balance is set by the school administration.</p>
        </div>
        <Button onClick={() => setModalOpen(true)}>
          <CalendarPlus size={16} className="mr-1.5 inline" strokeWidth={1.75} />
          Apply for leave
        </Button>
      </div>

      {isClassTeacher && (
        <Tabs<LeaveTab>
          active={activeTab}
          onChange={setActiveTab}
          tabs={[
            { key: "mine", label: "My leave" },
            { key: "students", label: "Student requests" },
          ]}
        />
      )}

      {activeTab === "students" && isClassTeacher ? (
        <StudentLeaveQueue />
      ) : (
        <>
          {summaryQuery.isLoading || !summary ? (
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
              {Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className="h-24 w-full" />
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
              <StatTile label="Total Entitlement" value={summary.totalEntitlement} />
              <StatTile label="Leave Used" value={summary.totalUsed} />
              <StatTile label="Leave Remaining" value={summary.totalRemaining} highlight />
              <StatTile label="Pending Requests" value={summary.pendingCount} />
            </div>
          )}

          {summary && (
            <Card className="space-y-4">
              <h2 className="text-lg font-semibold text-[var(--ink-primary)]">Leave breakdown</h2>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                {(["casual", "sick", "other"] as LeaveType[]).map((type) => (
                  <div key={type} className="rounded-xl border border-black/[0.06] p-4 dark:border-white/[0.08]">
                    <p className="text-sm font-medium capitalize text-[var(--ink-secondary)]">{type} Leave</p>
                    <p className="mt-1 text-2xl font-semibold text-[var(--ink-primary)]">
                      {summary.remaining[type]} <span className="text-sm font-normal text-[var(--ink-muted)]">/ {summary.policy[type]} left</span>
                    </p>
                    <p className="mt-1 text-xs text-[var(--ink-muted)]">{summary.used[type]} used this year</p>
                  </div>
                ))}
              </div>
            </Card>
          )}

          <Card className="space-y-4">
            <h2 className="text-lg font-semibold text-[var(--ink-primary)]">My leave requests</h2>
            <DataTable<LeaveRequestRecord>
              isLoading={requestsQuery.isLoading}
              rows={requestsQuery.data ?? []}
              rowKey={(r) => r.id}
              emptyMessage="You haven't applied for any leave yet."
              columns={[
                { header: "Type", cell: (r) => <span className="capitalize">{r.leave_type}</span> },
                { header: "From", cell: (r) => r.start_date },
                { header: "To", cell: (r) => r.end_date },
                { header: "Reason", cell: (r) => r.reason ?? "—" },
                { header: "Status", cell: (r) => <Badge variant={STATUS_BADGE[r.status]}>{r.status}</Badge> },
              ]}
            />
          </Card>
        </>
      )}

      <Modal isOpen={isModalOpen} onClose={() => setModalOpen(false)} title="Apply for leave">
        <form className="space-y-4" onSubmit={handleSubmit((values) => applyMutation.mutate(values))}>
          <Select label="Leave type" options={LEAVE_TYPE_OPTIONS} {...register("leave_type", { required: true })} />
          {isLeaveCutoffPassed() && (
            <p className="text-xs text-[var(--status-warning)]">
              It's past 6:00 PM, so today is no longer available — the earliest you can apply for is tomorrow.
            </p>
          )}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
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

function StatTile({ label, value, highlight }: { label: string; value: number; highlight?: boolean }) {
  return (
    <Card className="text-center">
      <p className={`text-3xl font-semibold ${highlight ? "text-brand-600" : "text-[var(--ink-primary)]"}`}>{value}</p>
      <p className="mt-0.5 text-sm text-[var(--ink-muted)]">{label}</p>
    </Card>
  );
}

/** The class teacher's approval queue for their homeroom students' leave requests. */
function StudentLeaveQueue() {
  const queryClient = useQueryClient();
  const toast = useToast();
  const [confirmTarget, setConfirmTarget] = useState<{ id: string; status: "approved" | "rejected" } | null>(null);

  const queueQuery = useQuery({
    queryKey: ["teacher", "student-leave-queue"],
    queryFn: () => leaveService.fetchStudentLeaveQueue(),
  });

  const reviewMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: "approved" | "rejected" }) => leaveService.reviewStudentLeave(id, status),
    onSuccess: (updated) => {
      queryClient.invalidateQueries({ queryKey: ["teacher", "student-leave-queue"] });
      setConfirmTarget(null);
      if (updated.alreadyReviewed) {
        toast.info("This request was already reviewed by someone else.");
      } else {
        toast.success(`Leave request ${updated.status}.`);
      }
    },
    onError: (err) => {
      toast.error(getApiErrorMessage(err, "Failed to update the leave request."));
      setConfirmTarget(null);
    },
  });

  const pending = (queueQuery.data ?? []).filter((r) => r.status === "pending");
  const history = (queueQuery.data ?? []).filter((r) => r.status !== "pending");

  return (
    <>
      <Card className="space-y-4">
        <h2 className="text-lg font-semibold text-[var(--ink-primary)]">Pending student leave requests</h2>
        <DataTable<StudentLeaveQueueRecord>
          isLoading={queueQuery.isLoading}
          rows={pending}
          rowKey={(r) => r.id}
          emptyMessage="No pending leave requests from your students."
          columns={[
            { header: "Student", cell: (r) => r.student?.users?.full_name ?? "—" },
            { header: "Class", cell: (r) => (r.student?.classes ? `${r.student.classes.name} - ${r.student.classes.section}` : "—") },
            { header: "From", cell: (r) => r.start_date },
            { header: "To", cell: (r) => r.end_date },
            { header: "Reason", cell: (r) => r.reason },
            {
              header: "",
              className: "text-right",
              cell: (r) => (
                <div className="flex justify-end gap-1.5">
                  <Button
                    variant="secondary"
                    className="!p-1.5 text-[var(--status-good)]"
                    title="Approve"
                    onClick={() => reviewMutation.mutate({ id: r.id, status: "approved" })}
                    isLoading={reviewMutation.isPending && reviewMutation.variables?.id === r.id && reviewMutation.variables?.status === "approved"}
                  >
                    <Check size={15} strokeWidth={2} />
                  </Button>
                  <Button
                    variant="secondary"
                    className="!p-1.5 text-[var(--status-serious)]"
                    title="Reject"
                    onClick={() => setConfirmTarget({ id: r.id, status: "rejected" })}
                  >
                    <X size={15} strokeWidth={2} />
                  </Button>
                </div>
              ),
            },
          ]}
        />
      </Card>

      <Card className="space-y-4">
        <h2 className="text-lg font-semibold text-[var(--ink-primary)]">History</h2>
        <DataTable<StudentLeaveQueueRecord>
          isLoading={queueQuery.isLoading}
          rows={history}
          rowKey={(r) => r.id}
          emptyMessage="No reviewed requests yet."
          columns={[
            { header: "Student", cell: (r) => r.student?.users?.full_name ?? "—" },
            { header: "From", cell: (r) => r.start_date },
            { header: "To", cell: (r) => r.end_date },
            { header: "Status", cell: (r) => <Badge variant={STUDENT_STATUS_BADGE[r.status]}>{r.status}</Badge> },
          ]}
        />
      </Card>

      <ConfirmDialog
        isOpen={!!confirmTarget}
        title="Reject leave request"
        message="Are you sure you want to reject this student's leave request?"
        confirmLabel="Reject"
        isLoading={reviewMutation.isPending}
        onConfirm={() => confirmTarget && reviewMutation.mutate(confirmTarget)}
        onCancel={() => setConfirmTarget(null)}
      />
    </>
  );
}
