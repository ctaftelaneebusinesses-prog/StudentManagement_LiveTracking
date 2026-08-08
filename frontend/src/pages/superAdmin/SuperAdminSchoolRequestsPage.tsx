import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CheckCircle2, Clock, MailQuestion, MapPin, User, XCircle } from "lucide-react";
import * as schoolRequestService from "@/services/schoolRequest.service";
import { SchoolRequest, SchoolRequestStatus } from "@/types/schoolRequest.types";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Modal } from "@/components/ui/Modal";
import { Textarea } from "@/components/ui/Textarea";
import { EmptyState } from "@/components/ui/EmptyState";
import { Skeleton } from "@/components/ui/Skeleton";
import { useToast } from "@/components/ui/Toast";
import { PageHeader } from "./components/PageHeader";

type FilterTab = "pending" | "approved" | "rejected" | "all";

/**
 * §6/§8, extended by request: a school_admin can no longer create a school
 * directly (only super_admin holds platform.manage_schools since
 * 066_super_admin_multi_school.sql) — this is where their requests land for
 * review. Approving creates the real school and assigns it to the requester;
 * rejecting creates nothing. See 068_school_creation_requests.sql.
 */
export function SuperAdminSchoolRequestsPage() {
  const toast = useToast();
  const queryClient = useQueryClient();
  const [tab, setTab] = useState<FilterTab>("pending");
  const [reviewTarget, setReviewTarget] = useState<{ request: SchoolRequest; approve: boolean } | null>(null);
  const [reviewerNotes, setReviewerNotes] = useState("");

  const requestsQuery = useQuery({
    queryKey: ["super-admin", "school-requests", tab],
    queryFn: () => schoolRequestService.listAllRequests(tab === "all" ? undefined : (tab as SchoolRequestStatus)),
  });

  const reviewMutation = useMutation({
    mutationFn: async ({ request, approve }: { request: SchoolRequest; approve: boolean }) =>
      approve
        ? schoolRequestService.approveRequest(request.id, reviewerNotes || undefined)
        : { request: await schoolRequestService.rejectRequest(request.id, reviewerNotes || undefined) },
    onSuccess: (_result, variables) => {
      toast.success(
        variables.approve
          ? `${variables.request.payload.name} approved and added to the platform.`
          : `Request for ${variables.request.payload.name} rejected.`
      );
      setReviewTarget(null);
      setReviewerNotes("");
      queryClient.invalidateQueries({ queryKey: ["super-admin"] });
      queryClient.invalidateQueries({ queryKey: ["super-admin", "school-requests"] });
    },
    onError: (err: Error) => {
      const message = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      toast.error(message ?? err.message ?? "Couldn't process this request");
    },
  });

  const requests = requestsQuery.data ?? [];
  const pendingCount = requests.filter((r) => r.status === "pending").length;

  return (
    <div>
      <PageHeader
        title="School Requests"
        subtitle="School Admins request new schools here — nothing is added until you approve it."
      />

      <div className="mb-4 flex rounded-xl border border-black/[0.08] bg-white p-0.5 dark:border-white/[0.1] dark:bg-[#17171a]">
        {(["pending", "approved", "rejected", "all"] as FilterTab[]).map((value) => (
          <button
            key={value}
            type="button"
            onClick={() => setTab(value)}
            className={`rounded-lg px-3 py-1.5 text-xs font-medium capitalize transition-colors ${
              tab === value
                ? "bg-accent-500/10 text-accent-600 dark:text-accent-300"
                : "text-[var(--ink-muted)] hover:text-[var(--ink-primary)]"
            }`}
          >
            {value}
            {value === "pending" && tab !== "pending" && pendingCount > 0 && ` (${pendingCount})`}
          </button>
        ))}
      </div>

      {requestsQuery.isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-[140px] rounded-2xl" />
          ))}
        </div>
      ) : requests.length === 0 ? (
        <div className="rounded-2xl border border-black/[0.06] bg-white py-8 dark:border-white/[0.08] dark:bg-[#17171a]">
          <EmptyState icon={MailQuestion} title={`No ${tab === "all" ? "" : tab} requests`} />
        </div>
      ) : (
        <div className="space-y-3">
          {requests.map((request, i) => (
            <RequestRow
              key={request.id}
              request={request}
              index={i}
              onApprove={() => setReviewTarget({ request, approve: true })}
              onReject={() => setReviewTarget({ request, approve: false })}
            />
          ))}
        </div>
      )}

      <Modal
        isOpen={Boolean(reviewTarget)}
        onClose={() => setReviewTarget(null)}
        title={reviewTarget?.approve ? "Approve this school?" : "Reject this request?"}
      >
        {reviewTarget && (
          <div>
            <p className="text-sm text-[var(--ink-secondary)]">
              {reviewTarget.approve ? (
                <>
                  <span className="font-medium text-[var(--ink-primary)]">{reviewTarget.request.payload.name}</span>{" "}
                  will be created and assigned to{" "}
                  <span className="font-medium text-[var(--ink-primary)]">
                    {reviewTarget.request.users?.full_name}
                  </span>
                  .
                </>
              ) : (
                <>
                  The request for{" "}
                  <span className="font-medium text-[var(--ink-primary)]">{reviewTarget.request.payload.name}</span>{" "}
                  will be rejected. No school is created.
                </>
              )}
            </p>

            <div className="mt-4">
              <Textarea
                label="Note to the requester (optional)"
                value={reviewerNotes}
                onChange={(e) => setReviewerNotes(e.target.value)}
                rows={3}
                placeholder={reviewTarget.approve ? "Any context for the School Admin…" : "Why is this being rejected?"}
              />
            </div>

            <div className="mt-6 flex justify-end gap-3">
              <Button variant="secondary" onClick={() => setReviewTarget(null)} disabled={reviewMutation.isPending}>
                Cancel
              </Button>
              <Button
                variant={reviewTarget.approve ? "primary" : "danger"}
                onClick={() => reviewMutation.mutate(reviewTarget)}
                isLoading={reviewMutation.isPending}
              >
                {reviewTarget.approve ? "Approve & create school" : "Reject request"}
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}

function RequestRow({
  request,
  index,
  onApprove,
  onReject,
}: {
  request: SchoolRequest;
  index: number;
  onApprove: () => void;
  onReject: () => void;
}) {
  const StatusIcon = { pending: Clock, approved: CheckCircle2, rejected: XCircle }[request.status];
  const variant = { pending: "warning", approved: "success", rejected: "danger" } as const;
  const location = [request.payload.city, request.payload.district, request.payload.state]
    .filter(Boolean)
    .join(", ");

  return (
    <div
      style={{ animationDelay: `${index * 40}ms` }}
      className="animate-slide-up rounded-2xl border border-black/[0.06] bg-white p-4 shadow-sm dark:border-white/[0.08] dark:bg-[#17171a]"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="truncate text-sm font-semibold text-[var(--ink-primary)]">{request.payload.name}</p>
            <Badge variant={variant[request.status]}>
              <StatusIcon size={11} strokeWidth={2.2} />
              {request.status}
            </Badge>
          </div>
          <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-[var(--ink-muted)]">
            <span className="flex items-center gap-1">
              <User size={12} strokeWidth={1.9} />
              {request.users?.full_name} · {request.users?.email}
            </span>
            {location && (
              <span className="flex items-center gap-1">
                <MapPin size={12} strokeWidth={1.9} />
                {location}
              </span>
            )}
            <span>
              {new Date(request.created_at).toLocaleDateString("en-IN", {
                day: "2-digit",
                month: "short",
                year: "numeric",
              })}
            </span>
          </div>
          {request.payload.requester_notes && (
            <p className="mt-2 rounded-lg bg-black/[0.03] p-2.5 text-xs text-[var(--ink-secondary)] dark:bg-white/[0.05]">
              &ldquo;{request.payload.requester_notes}&rdquo;
            </p>
          )}
          {request.status !== "pending" && request.reviewer_notes && (
            <p className="mt-2 text-xs text-[var(--ink-muted)]">Reviewer note: {request.reviewer_notes}</p>
          )}
        </div>

        {request.status === "pending" && (
          <div className="flex shrink-0 gap-2">
            <Button variant="secondary" onClick={onReject}>
              Reject
            </Button>
            <Button onClick={onApprove}>Approve</Button>
          </div>
        )}
      </div>
    </div>
  );
}
