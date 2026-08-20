import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, X } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Skeleton } from "@/components/ui/Skeleton";
import { DataTable } from "@/components/ui/DataTable";
import { EmptyState } from "@/components/ui/EmptyState";
import { Badge, BadgeVariant } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { useToast } from "@/components/ui/Toast";
import * as profileChangeRequestService from "@/services/teacher/profileChangeRequest.service";
import { getApiErrorMessage } from "@/lib/axios";
import { ProfileChangeRequest, ProfileChangeStatus } from "@/types/portal.types";

const CHANGE_STATUS_BADGE: Record<ProfileChangeStatus, BadgeVariant> = {
  pending: "warning",
  approved: "success",
  rejected: "danger",
  cancelled: "neutral",
};

function studentLabel(r: ProfileChangeRequest): string {
  const name = r.student?.users?.full_name ?? "Unknown student";
  const klass = r.student?.classes ? `${r.student.classes.name} - ${r.student.classes.section}` : null;
  return klass ? `${name} (${klass})` : name;
}

export function ProfileApprovalPage() {
  const queryClient = useQueryClient();
  const toast = useToast();
  const [confirmTarget, setConfirmTarget] = useState<{ id: string; status: "approved" | "rejected" } | null>(null);

  const queueQuery = useQuery({
    queryKey: ["teacher", "profile-change-queue"],
    queryFn: () => profileChangeRequestService.fetchProfileChangeQueue(),
  });

  const reviewMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: "approved" | "rejected" }) =>
      profileChangeRequestService.reviewProfileChangeRequest(id, status),
    onSuccess: (updated) => {
      queryClient.invalidateQueries({ queryKey: ["teacher", "profile-change-queue"] });
      setConfirmTarget(null);
      if (updated.alreadyReviewed) {
        toast.info("This request was already reviewed by someone else.");
      } else {
        toast.success(`Profile change request ${updated.status}.`);
      }
    },
    onError: (err) => {
      toast.error(getApiErrorMessage(err, "Failed to update the request."));
      setConfirmTarget(null);
    },
  });

  const all = queueQuery.data ?? [];
  const pending = all.filter((r) => r.status === "pending");
  const history = all.filter((r) => r.status !== "pending");

  return (
    <div className="animate-fade-in space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-[var(--ink-primary)]">Profile Approval</h1>
        <p className="mt-1 text-sm text-[var(--ink-muted)]">
          Review profile changes requested by students/parents in your class. Approve to update the student record, or reject to keep the existing data.
        </p>
      </div>

      <Card className="space-y-4">
        <h2 className="text-lg font-semibold text-[var(--ink-primary)]">Pending requests</h2>
        {queueQuery.isLoading ? (
          <Skeleton className="h-24 w-full" />
        ) : pending.length === 0 ? (
          <EmptyState title="No pending requests" description="Profile change requests from your class will appear here." />
        ) : (
          <DataTable<ProfileChangeRequest>
            rows={pending}
            rowKey={(r) => r.id}
            emptyMessage="No pending requests."
            columns={[
              { header: "Student", cell: (r) => studentLabel(r) },
              {
                header: "Requested Field",
                cell: (r) => (
                  <div className="space-y-0.5">
                    {Object.keys(r.changes).map((field) => (
                      <p key={field} className="capitalize">{field.replace(/_/g, " ")}</p>
                    ))}
                  </div>
                ),
              },
              {
                header: "Old Value",
                cell: (r) => (
                  <div className="space-y-0.5">
                    {Object.values(r.changes).map((edit, i) => (
                      <p key={i} className="text-[var(--ink-muted)]">{String(edit.from ?? "—")}</p>
                    ))}
                  </div>
                ),
              },
              {
                header: "New Value",
                cell: (r) => (
                  <div className="space-y-0.5">
                    {Object.values(r.changes).map((edit, i) => (
                      <p key={i} className="text-[var(--ink-primary)]">{String(edit.to ?? "—")}</p>
                    ))}
                  </div>
                ),
              },
              { header: "Date", cell: (r) => new Date(r.created_at).toLocaleDateString() },
              {
                header: "",
                cell: (r) => (
                  <div className="flex shrink-0 gap-1.5">
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
        )}
      </Card>

      <Card className="space-y-4">
        <h2 className="text-lg font-semibold text-[var(--ink-primary)]">History</h2>
        <DataTable<ProfileChangeRequest>
          isLoading={queueQuery.isLoading}
          rows={history}
          rowKey={(r) => r.id}
          emptyMessage="No reviewed requests yet."
          columns={[
            { header: "Student", cell: (r) => studentLabel(r) },
            { header: "Fields", cell: (r) => Object.keys(r.changes).join(", ") },
            { header: "Date", cell: (r) => new Date(r.created_at).toLocaleDateString() },
            { header: "Status", cell: (r) => <Badge variant={CHANGE_STATUS_BADGE[r.status]}>{r.status}</Badge> },
          ]}
        />
      </Card>

      <ConfirmDialog
        isOpen={!!confirmTarget}
        title="Reject profile change request"
        message="Are you sure you want to reject this request?"
        confirmLabel="Reject"
        isLoading={reviewMutation.isPending}
        onConfirm={() => confirmTarget && reviewMutation.mutate(confirmTarget)}
        onCancel={() => setConfirmTarget(null)}
      />
    </div>
  );
}
