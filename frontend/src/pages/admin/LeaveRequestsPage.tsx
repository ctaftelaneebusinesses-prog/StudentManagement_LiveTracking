import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, X } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { Card } from "@/components/ui/Card";
import { Select } from "@/components/ui/Select";
import { Button } from "@/components/ui/Button";
import { DataTable } from "@/components/ui/DataTable";
import { Badge, BadgeVariant } from "@/components/ui/Badge";
import { Tabs } from "@/components/ui/Tabs";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { useToast } from "@/components/ui/Toast";
import * as leaveRequestsService from "@/services/admin/leaveRequests.service";
import { getApiErrorMessage } from "@/lib/axios";
import { LeaveRequest, LeaveRequestApplicantRole, LeaveRequestStatus } from "@/types/admin.types";

const PAGE_SIZE = 15;

const STATUS_BADGE: Record<LeaveRequestStatus, BadgeVariant> = {
  pending: "warning",
  approved: "success",
  rejected: "danger",
};

const STATUS_OPTIONS = [
  { value: "", label: "All statuses" },
  { value: "pending", label: "Pending" },
  { value: "approved", label: "Approved" },
  { value: "rejected", label: "Rejected" },
];

/**
 * The school-wide leave review dashboard — distinct from the per-teacher
 * "Leave requests" card already on admin/teachers/TeacherProfilePage.tsx
 * (which logs/reviews leave for one teacher at a time). This is the
 * dedicated "Leave Requests" sidebar destination: every teacher's and
 * principal's request, filterable and paginated. A principal viewer never
 * sees the Principal Leave tab at all — the backend also enforces this
 * (listLeaveRequests forces applicant_role='teacher' for a principal
 * caller), so hiding the tab here is presentation, not the actual guard.
 */
export function LeaveRequestsPage() {
  const { hasRole } = useAuth();
  const isPrincipal = hasRole("principal");
  const [tab, setTab] = useState<LeaveRequestApplicantRole>("teacher");
  const [status, setStatus] = useState<LeaveRequestStatus | "">("");
  const [page, setPage] = useState(1);

  return (
    <div className="animate-fade-in space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-[var(--ink-primary)]">Leave Requests</h1>
        <p className="text-sm text-[var(--ink-muted)]">Review and act on leave requests across the school.</p>
      </div>

      {!isPrincipal && (
        <Tabs<LeaveRequestApplicantRole>
          active={tab}
          onChange={(key) => {
            setTab(key);
            setPage(1);
          }}
          tabs={[
            { key: "teacher", label: "Teacher Leave" },
            { key: "principal", label: "Principal Leave" },
          ]}
        />
      )}

      <LeaveRequestsTable applicantRole={isPrincipal ? "teacher" : tab} status={status} onStatusChange={(s) => { setStatus(s); setPage(1); }} page={page} onPageChange={setPage} />
    </div>
  );
}

function LeaveRequestsTable({
  applicantRole,
  status,
  onStatusChange,
  page,
  onPageChange,
}: {
  applicantRole: LeaveRequestApplicantRole;
  status: LeaveRequestStatus | "";
  onStatusChange: (status: LeaveRequestStatus | "") => void;
  page: number;
  onPageChange: (page: number) => void;
}) {
  const queryClient = useQueryClient();
  const toast = useToast();
  const [confirmTarget, setConfirmTarget] = useState<{ id: string; status: "approved" | "rejected" } | null>(null);

  const queryKey = ["admin", "leave-requests", applicantRole, status, page];
  const listQuery = useQuery({
    queryKey,
    queryFn: () =>
      leaveRequestsService.fetchLeaveRequests({
        applicantRole,
        status: status || undefined,
        page,
        pageSize: PAGE_SIZE,
      }),
  });

  const reviewMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: "approved" | "rejected" }) =>
      leaveRequestsService.reviewLeaveRequest(id, status),
    onSuccess: (updated) => {
      queryClient.invalidateQueries({ queryKey: ["admin", "leave-requests"] });
      setConfirmTarget(null);
      if (updated.alreadyReviewed) {
        toast.info(
          updated.reviewed_by_role
            ? `Already reviewed by ${updated.reviewed_by_role === "principal" ? "the principal" : "an admin"}.`
            : "This request was already reviewed."
        );
      } else {
        toast.success(`Leave request ${updated.status}.`);
      }
    },
    onError: (err) => {
      toast.error(getApiErrorMessage(err, "Failed to update the leave request."));
      setConfirmTarget(null);
    },
  });

  const total = listQuery.data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <>
      <Card className="space-y-4">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <Select
            label="Status"
            options={STATUS_OPTIONS}
            value={status}
            onChange={(e) => onStatusChange(e.target.value as LeaveRequestStatus | "")}
          />
        </div>

        <DataTable<LeaveRequest>
          isLoading={listQuery.isLoading}
          rows={listQuery.data?.items ?? []}
          rowKey={(r) => r.id}
          emptyMessage="No leave requests found."
          columns={[
            { header: "Name", cell: (r) => r.users?.full_name ?? "—" },
            { header: "From", cell: (r) => r.start_date },
            { header: "To", cell: (r) => r.end_date },
            { header: "Reason", cell: (r) => r.reason ?? "—" },
            { header: "Status", cell: (r) => <Badge variant={STATUS_BADGE[r.status]}>{r.status}</Badge> },
            {
              header: "Reviewed by",
              cell: (r) => (r.reviewed_by_role ? (r.reviewed_by_role === "principal" ? "Principal" : "Admin") : "—"),
            },
            {
              header: "",
              className: "text-right",
              cell: (r) =>
                r.status === "pending" ? (
                  <div className="flex justify-end gap-1.5">
                    <Button
                      variant="secondary"
                      className="!p-1.5 text-[var(--status-good)]"
                      title="Approve"
                      onClick={() => reviewMutation.mutate({ id: r.id, status: "approved" })}
                      isLoading={
                        reviewMutation.isPending && reviewMutation.variables?.id === r.id && reviewMutation.variables?.status === "approved"
                      }
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
                ) : null,
            },
          ]}
        />

        {total > 0 && (
          <div className="flex flex-wrap items-center justify-between gap-2 text-sm text-[var(--ink-muted)]">
            <p>
              Showing {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, total)} of {total}
            </p>
            <div className="flex gap-2">
              <Button variant="secondary" className="!px-3 !py-1 text-xs" disabled={page <= 1} onClick={() => onPageChange(page - 1)}>
                Previous
              </Button>
              <span className="self-center">
                Page {page} of {totalPages}
              </span>
              <Button
                variant="secondary"
                className="!px-3 !py-1 text-xs"
                disabled={page >= totalPages}
                onClick={() => onPageChange(page + 1)}
              >
                Next
              </Button>
            </div>
          </div>
        )}
      </Card>

      <ConfirmDialog
        isOpen={!!confirmTarget}
        title="Reject leave request"
        message="Are you sure you want to reject this leave request?"
        confirmLabel="Reject"
        isLoading={reviewMutation.isPending}
        onConfirm={() => confirmTarget && reviewMutation.mutate(confirmTarget)}
        onCancel={() => setConfirmTarget(null)}
      />
    </>
  );
}
