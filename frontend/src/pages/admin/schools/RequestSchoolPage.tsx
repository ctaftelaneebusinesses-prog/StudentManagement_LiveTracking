import { FormEvent, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Building2, CheckCircle2, Clock, MailQuestion, XCircle } from "lucide-react";
import * as schoolRequestService from "@/services/schoolRequest.service";
import { SchoolRequest, SchoolRequestPayload } from "@/types/schoolRequest.types";
import { Input } from "@/components/ui/Input";
import { Textarea } from "@/components/ui/Textarea";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { EmptyState } from "@/components/ui/EmptyState";
import { Skeleton } from "@/components/ui/Skeleton";
import { useToast } from "@/components/ui/Toast";

const EMPTY_FORM: SchoolRequestPayload = {
  name: "",
  code: "",
  principal_name: "",
  address: "",
  phone: "",
  email: "",
  city: "",
  district: "",
  state: "",
  pin_code: "",
  country: "",
  requester_notes: "",
};

/**
 * §5/§8, extended by request: since 066_super_admin_multi_school.sql only a
 * super_admin holds platform.manage_schools and can create a school directly,
 * a school_admin's "Add School" is this request instead — nothing is created
 * until a super_admin reviews and approves it (068_school_creation_requests.sql).
 */
export function RequestSchoolPage() {
  const toast = useToast();
  const queryClient = useQueryClient();
  const [form, setForm] = useState<SchoolRequestPayload>(EMPTY_FORM);
  const [error, setError] = useState<string>();

  const requestsQuery = useQuery({
    queryKey: ["school-requests", "mine"],
    queryFn: schoolRequestService.listMyRequests,
  });

  const createMutation = useMutation({
    mutationFn: schoolRequestService.createRequest,
    onSuccess: () => {
      toast.success("Request sent — a Super Admin will review it shortly.");
      setForm(EMPTY_FORM);
      queryClient.invalidateQueries({ queryKey: ["school-requests", "mine"] });
    },
    onError: (err: Error) => {
      const message = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      toast.error(message ?? err.message ?? "Couldn't send the request");
    },
  });

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (form.name.trim().length < 2) {
      setError("Enter the school's name");
      return;
    }
    setError(undefined);

    const cleaned = Object.fromEntries(
      Object.entries(form).filter(([, value]) => typeof value === "string" && value.trim().length > 0)
    ) as SchoolRequestPayload;
    createMutation.mutate(cleaned);
  }

  const requests = requestsQuery.data ?? [];

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_380px]">
      <section className="rounded-2xl border border-black/[0.06] bg-white p-5 shadow-sm dark:border-white/[0.08] dark:bg-[#17171a]">
        <div className="mb-4 flex items-center gap-2.5">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-accent-50 text-accent-600 dark:bg-accent-900/40 dark:text-accent-300">
            <Building2 size={18} strokeWidth={1.85} />
          </span>
          <div>
            <h1 className="text-base font-semibold text-[var(--ink-primary)]">Request a New School</h1>
            <p className="text-xs text-[var(--ink-muted)]">
              Submitted requests are reviewed by a Super Admin — the school is added, and assigned to you, only
              after approval.
            </p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Input
              label="School name"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              error={error}
              autoComplete="off"
            />
            <Input
              label="School code (optional)"
              value={form.code ?? ""}
              onChange={(e) => setForm({ ...form, code: e.target.value })}
              placeholder="Auto-generated if left blank"
              autoComplete="off"
            />
            <Input
              label="Principal name (optional)"
              value={form.principal_name ?? ""}
              onChange={(e) => setForm({ ...form, principal_name: e.target.value })}
              autoComplete="off"
            />
            <Input
              label="Contact email (optional)"
              type="email"
              value={form.email ?? ""}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              autoComplete="off"
            />
            <Input
              label="Contact phone (optional)"
              value={form.phone ?? ""}
              onChange={(e) => setForm({ ...form, phone: e.target.value })}
              autoComplete="off"
            />
            <Input
              label="City (optional)"
              value={form.city ?? ""}
              onChange={(e) => setForm({ ...form, city: e.target.value })}
              autoComplete="off"
            />
            <Input
              label="District (optional)"
              value={form.district ?? ""}
              onChange={(e) => setForm({ ...form, district: e.target.value })}
              autoComplete="off"
            />
            <Input
              label="State (optional)"
              value={form.state ?? ""}
              onChange={(e) => setForm({ ...form, state: e.target.value })}
              autoComplete="off"
            />
          </div>

          <Input
            label="Address (optional)"
            value={form.address ?? ""}
            onChange={(e) => setForm({ ...form, address: e.target.value })}
            autoComplete="off"
          />

          <Textarea
            label="Notes for the reviewer (optional)"
            value={form.requester_notes ?? ""}
            onChange={(e) => setForm({ ...form, requester_notes: e.target.value })}
            rows={3}
            placeholder="Why is this school being added? Any context helps the Super Admin review faster."
          />

          <div className="flex justify-end">
            <Button type="submit" isLoading={createMutation.isPending}>
              Send request
            </Button>
          </div>
        </form>
      </section>

      <section>
        <h2 className="mb-3 text-[11px] font-semibold uppercase tracking-wider text-[var(--ink-muted)]">
          Your requests
        </h2>

        {requestsQuery.isLoading ? (
          <div className="space-y-3">
            {Array.from({ length: 2 }).map((_, i) => (
              <Skeleton key={i} className="h-[92px] rounded-2xl" />
            ))}
          </div>
        ) : requests.length === 0 ? (
          <div className="rounded-2xl border border-black/[0.06] bg-white py-8 dark:border-white/[0.08] dark:bg-[#17171a]">
            <EmptyState
              icon={MailQuestion}
              title="No requests yet"
              description="Submit the form to request your first school."
            />
          </div>
        ) : (
          <div className="space-y-3">
            {requests.map((request) => (
              <RequestCard key={request.id} request={request} />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

function RequestCard({ request }: { request: SchoolRequest }) {
  const StatusIcon = { pending: Clock, approved: CheckCircle2, rejected: XCircle }[request.status];
  const variant = { pending: "warning", approved: "success", rejected: "danger" } as const;

  return (
    <div className="rounded-2xl border border-black/[0.06] bg-white p-4 shadow-sm dark:border-white/[0.08] dark:bg-[#17171a]">
      <div className="flex items-start justify-between gap-2">
        <p className="min-w-0 truncate text-sm font-semibold text-[var(--ink-primary)]">{request.payload.name}</p>
        <Badge variant={variant[request.status]}>
          <StatusIcon size={11} strokeWidth={2.2} />
          {request.status}
        </Badge>
      </div>
      <p className="mt-1 text-xs text-[var(--ink-muted)]">
        Requested {new Date(request.created_at).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })}
      </p>
      {request.status !== "pending" && request.reviewer_notes && (
        <p className="mt-2 rounded-lg bg-black/[0.03] p-2 text-xs text-[var(--ink-secondary)] dark:bg-white/[0.05]">
          {request.reviewer_notes}
        </p>
      )}
      {request.status === "approved" && (
        <p className="mt-2 text-xs text-emerald-600 dark:text-emerald-400">
          School added — you can switch to it from the school selector.
        </p>
      )}
    </div>
  );
}
