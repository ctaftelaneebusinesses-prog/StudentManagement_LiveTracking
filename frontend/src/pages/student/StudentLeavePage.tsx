import { useState } from "react";
import { useForm } from "react-hook-form";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { CalendarCheck, CalendarClock, CalendarPlus, ListChecks } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { DatePicker } from "@/components/ui/DatePicker";
import { Textarea } from "@/components/ui/Textarea";
import { Button } from "@/components/ui/Button";
import { DataTable } from "@/components/ui/DataTable";
import { Badge, BadgeVariant } from "@/components/ui/Badge";
import { useToast } from "@/components/ui/Toast";
import * as leaveService from "@/services/student/leave.service";
import { getApiErrorMessage } from "@/lib/axios";
import { getMinLeaveDate, isLeaveCutoffPassed } from "@/utils/date";
import { StudentLeaveRequestRecord, StudentLeaveStatus } from "@/types/leave.types";
import { PortalGlassCard } from "@/pages/portal/components/ui/PortalGlassCard";
import { PortalStatCard } from "@/pages/portal/components/ui/PortalStatCard";
import { PortalModal } from "@/pages/portal/components/ui/PortalModal";
import { staggerContainer } from "@/pages/portal/components/ui/portalMotion";

const STATUS_BADGE: Record<StudentLeaveStatus, BadgeVariant> = {
  pending: "warning",
  approved: "success",
  rejected: "danger",
  cancelled: "neutral",
};

interface ApplyFormValues {
  start_date: string;
  end_date: string;
  reason: string;
}

export function StudentLeavePage() {
  const { user } = useAuth();
  const studentId = user?.id ?? "";
  const queryClient = useQueryClient();
  const toast = useToast();
  const [isModalOpen, setModalOpen] = useState(false);

  const requestsQuery = useQuery({
    queryKey: ["student", "leave-requests", studentId],
    queryFn: () => leaveService.fetchMyLeaveRequests(studentId),
    enabled: !!studentId,
  });

  const minDate = getMinLeaveDate();
  const {
    register,
    handleSubmit,
    reset,
    watch,
    setValue,
    formState: { isSubmitting, errors },
  } = useForm<ApplyFormValues>({
    defaultValues: { start_date: "", end_date: "", reason: "" },
  });
  const startDate = watch("start_date");

  const applyMutation = useMutation({
    mutationFn: (values: ApplyFormValues) => leaveService.applyForLeave(studentId, values),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["student", "leave-requests", studentId] });
      reset();
      setModalOpen(false);
      toast.success("Leave request submitted for approval.");
    },
    onError: (err) => toast.error(getApiErrorMessage(err, "Failed to submit leave request.")),
  });

  const pendingCount = (requestsQuery.data ?? []).filter((r) => r.status === "pending").length;
  const approvedCount = (requestsQuery.data ?? []).filter((r) => r.status === "approved").length;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-[var(--ink-primary)]">Leave</h1>
          <p className="text-sm text-[var(--ink-muted)]">Apply for leave and track its approval status.</p>
        </div>
        <Button onClick={() => setModalOpen(true)}>
          <CalendarPlus size={16} className="mr-1.5 inline" strokeWidth={1.75} />
          Apply for leave
        </Button>
      </div>

      <motion.div variants={staggerContainer} initial="hidden" animate="show" className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <PortalStatCard icon={ListChecks} label="Total requests" value={requestsQuery.data?.length ?? 0} />
        <PortalStatCard icon={CalendarClock} label="Pending" value={pendingCount} />
        <PortalStatCard icon={CalendarCheck} label="Approved" value={approvedCount} />
      </motion.div>

      <PortalGlassCard noHover className="space-y-4">
        <h2 className="text-lg font-semibold text-[var(--ink-primary)]">Leave history</h2>
        <DataTable<StudentLeaveRequestRecord>
          isLoading={requestsQuery.isLoading}
          rows={requestsQuery.data ?? []}
          rowKey={(r) => r.id}
          emptyMessage="You haven't applied for any leave yet."
          columns={[
            { header: "From", cell: (r) => r.start_date },
            { header: "To", cell: (r) => r.end_date },
            { header: "Reason", cell: (r) => r.reason },
            { header: "Requested by", cell: () => "You" },
            { header: "Status", cell: (r) => <Badge variant={STATUS_BADGE[r.status]}>{r.status}</Badge> },
          ]}
        />
      </PortalGlassCard>

      <PortalModal isOpen={isModalOpen} onClose={() => setModalOpen(false)} title="Apply for leave">
        <form className="space-y-4" onSubmit={handleSubmit((values) => applyMutation.mutate(values))} noValidate>
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
          <Textarea
            label="Reason"
            rows={3}
            error={errors.reason?.message}
            {...register("reason", { required: "Required", minLength: { value: 5, message: "Please provide a bit more detail" } })}
          />
          {applyMutation.isError && (
            <p className="text-sm text-[var(--status-serious)]">{getApiErrorMessage(applyMutation.error, "Failed to submit leave request.")}</p>
          )}
          <Button type="submit" className="w-full" isLoading={isSubmitting || applyMutation.isPending}>
            Submit request
          </Button>
        </form>
      </PortalModal>
    </div>
  );
}
