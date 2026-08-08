import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, X } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { DataTable, Column } from "@/components/ui/DataTable";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { Textarea } from "@/components/ui/Textarea";
import { Select } from "@/components/ui/Select";
import { useToast } from "@/components/ui/Toast";
import { getApiErrorMessage } from "@/lib/axios";
import {
  listRegistrationRequests,
  reviewRegistrationRequest,
  RegistrationRequest,
} from "@/services/admin/registrationRequests.service";

const STATUS_VARIANT: Record<string, "neutral" | "success" | "danger"> = {
  pending: "neutral",
  approved: "success",
  rejected: "danger",
};

const ROLE_LABEL: Record<string, string> = {
  principal: "Principal",
  teacher: "Teacher",
  accountant: "Accountant",
  driver: "Driver",
  extracurricular_staff: "Extracurricular Staff",
  student: "Student",
};

interface RegistrationApprovalsViewProps {
  title: string;
  description: string;
  emptyMessage: string;
}

/** Shared by the Admin/Principal "Registration Approvals" page and the Teacher "Student Registrations" page — the backend scopes GET /registration-requests to whatever queue the caller's role/permission matches, so this component doesn't need to know which one it is. */
export function RegistrationApprovalsView({ title, description, emptyMessage }: RegistrationApprovalsViewProps) {
  const toast = useToast();
  const queryClient = useQueryClient();
  const [statusFilter, setStatusFilter] = useState<"pending" | "approved" | "rejected" | "">("pending");
  const [actionTarget, setActionTarget] = useState<{ request: RegistrationRequest; action: "approve" | "reject" } | null>(null);
  const [notes, setNotes] = useState("");

  const { data: requests = [], isLoading } = useQuery({
    queryKey: ["registration-requests", statusFilter],
    queryFn: () => listRegistrationRequests(statusFilter || undefined),
  });

  const reviewMutation = useMutation({
    mutationFn: ({ id, action, notes }: { id: string; action: "approve" | "reject"; notes?: string }) =>
      reviewRegistrationRequest(id, action, notes),
    onSuccess: () => {
      toast.success(actionTarget?.action === "approve" ? "Registration approved." : "Registration rejected.");
      queryClient.invalidateQueries({ queryKey: ["registration-requests"] });
      setActionTarget(null);
      setNotes("");
    },
    onError: (err) => toast.error(getApiErrorMessage(err, "Couldn't complete that action.")),
  });

  const columns: Column<RegistrationRequest>[] = [
    { header: "Name", cell: (r) => r.users?.full_name ?? "—" },
    { header: "Email", cell: (r) => r.users?.email ?? "—" },
    { header: "Role", cell: (r) => ROLE_LABEL[r.roles?.name ?? ""] ?? r.roles?.name ?? "—" },
    { header: "Submitted", cell: (r) => new Date(r.created_at).toLocaleDateString() },
    { header: "Status", cell: (r) => <Badge variant={STATUS_VARIANT[r.status]}>{r.status}</Badge> },
    {
      header: "Actions",
      cell: (r) =>
        r.status === "pending" ? (
          <div className="flex gap-2">
            <Button variant="secondary" onClick={() => setActionTarget({ request: r, action: "approve" })}>
              <Check className="h-3.5 w-3.5" /> Approve
            </Button>
            <Button variant="danger" onClick={() => setActionTarget({ request: r, action: "reject" })}>
              <X className="h-3.5 w-3.5" /> Reject
            </Button>
          </div>
        ) : (
          <span className="text-xs text-slate-400">{r.reviewed_at ? new Date(r.reviewed_at).toLocaleDateString() : "—"}</span>
        ),
    },
  ];

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold text-slate-900 dark:text-white">{title}</h1>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{description}</p>
      </div>

      <div className="max-w-xs">
        <Select
          label="Status"
          options={[
            { value: "pending", label: "Pending" },
            { value: "approved", label: "Approved" },
            { value: "rejected", label: "Rejected" },
          ]}
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as typeof statusFilter)}
        />
      </div>

      <Card className="p-0">
        <DataTable columns={columns} rows={requests} rowKey={(r) => r.id} isLoading={isLoading} emptyMessage={emptyMessage} />
      </Card>

      <Modal
        isOpen={!!actionTarget}
        onClose={() => setActionTarget(null)}
        title={actionTarget?.action === "approve" ? "Approve registration" : "Reject registration"}
        size="md"
      >
        {actionTarget && (
          <div className="space-y-4">
            <p className="text-sm text-slate-600 dark:text-slate-300">
              {actionTarget.action === "approve" ? "Approve" : "Reject"} {actionTarget.request.users?.full_name}'s registration?
            </p>
            <Textarea label="Notes (optional)" rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} />
            <div className="flex justify-end gap-2">
              <Button variant="secondary" onClick={() => setActionTarget(null)}>
                Cancel
              </Button>
              <Button
                variant={actionTarget.action === "approve" ? "primary" : "danger"}
                isLoading={reviewMutation.isPending}
                onClick={() => reviewMutation.mutate({ id: actionTarget.request.id, action: actionTarget.action, notes: notes || undefined })}
              >
                {actionTarget.action === "approve" ? "Approve" : "Reject"}
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
