import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ChevronLeft, ChevronRight, ScrollText, Search } from "lucide-react";
import * as superAdminService from "@/services/superAdmin.service";
import { AuditLogEntry } from "@/types/superAdmin.types";
import { DataTable, Column } from "@/components/ui/DataTable";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Avatar } from "@/components/ui/Avatar";
import { PageHeader } from "./components/PageHeader";

const PAGE_SIZE = 25;

/** Human labels for the action codes written by platformAudit.service.ts. */
const ACTION_LABELS: Record<string, string> = {
  "school.created": "School created",
  "school.updated": "School updated",
  "school.activated": "School activated",
  "school.deactivated": "School deactivated",
  "school.bulk_activated": "Bulk school activation",
  "school.bulk_deactivated": "Bulk school deactivation",
  "school.deleted": "School deleted",
  "school_admin.created": "School Admin created",
  "school_admin.updated": "School Admin updated",
  "school_admin.activated": "School Admin activated",
  "school_admin.deactivated": "School Admin deactivated",
  "school_admin.password_reset": "Password reset",
  "school_admin.schools_assigned": "Schools assigned",
  "school_admin.school_removed": "School assignment removed",
};

function actionLabel(action: string): string {
  return ACTION_LABELS[action] ?? action;
}

/** Destructive/access-removing actions read red; restorative ones read green. */
function actionVariant(action: string): "danger" | "success" | "info" | "neutral" {
  if (action.includes("deactivat") || action.includes("deleted") || action.includes("removed")) return "danger";
  if (action.includes("activated") || action.includes("created")) return "success";
  if (action.includes("assigned") || action.includes("password")) return "info";
  return "neutral";
}

function formatTimestamp(iso: string): { date: string; time: string } {
  const d = new Date(iso);
  return {
    date: d.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }),
    time: d.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" }),
  };
}

/** §22 — the platform-wide administrative audit trail. */
export function SuperAdminAuditLogPage() {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [action, setAction] = useState("");

  const actionsQuery = useQuery({
    queryKey: ["super-admin", "audit-actions"],
    queryFn: superAdminService.fetchAuditActions,
  });

  const logQuery = useQuery({
    queryKey: ["super-admin", "audit-log", page, search, action],
    queryFn: () =>
      superAdminService.fetchAuditLog({
        page,
        pageSize: PAGE_SIZE,
        search: search.trim() || undefined,
        action: action || undefined,
      }),
  });

  const total = logQuery.data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const columns: Column<AuditLogEntry>[] = [
    {
      header: "Action",
      cell: (row) => (
        <div className="flex flex-col gap-1">
          <Badge variant={actionVariant(row.action)}>{actionLabel(row.action)}</Badge>
        </div>
      ),
    },
    {
      header: "Performed by",
      cell: (row) => (
        <div className="flex items-center gap-2">
          <Avatar name={row.actor_name ?? row.actor_email ?? "System"} size="sm" />
          <div className="min-w-0">
            <p className="truncate text-sm font-medium text-[var(--ink-primary)]">
              {row.actor_name ?? "Unknown"}
            </p>
            <p className="truncate text-xs text-[var(--ink-muted)]">{row.actor_email ?? "—"}</p>
          </div>
        </div>
      ),
    },
    {
      header: "Affected",
      cell: (row) => (
        <div className="min-w-0">
          <p className="truncate text-sm text-[var(--ink-primary)]">{row.target_label ?? "—"}</p>
          <p className="truncate text-xs capitalize text-[var(--ink-muted)]">
            {row.target_type?.replace("_", " ") ?? ""}
          </p>
        </div>
      ),
    },
    {
      header: "School",
      cell: (row) => (
        <span className="text-sm text-[var(--ink-secondary)]">{row.school_name ?? "—"}</span>
      ),
    },
    {
      header: "Impact",
      cell: (row) => <ImpactSummary metadata={row.metadata} />,
    },
    {
      header: "Date & time",
      cell: (row) => {
        const { date, time } = formatTimestamp(row.created_at);
        return (
          <div className="whitespace-nowrap">
            <p className="text-sm text-[var(--ink-primary)]">{date}</p>
            <p className="text-xs text-[var(--ink-muted)]">{time}</p>
          </div>
        );
      },
    },
    {
      header: "Status",
      cell: (row) => (
        <Badge variant={row.status === "success" ? "success" : "danger"}>{row.status}</Badge>
      ),
    },
  ];

  return (
    <div>
      <PageHeader
        title="Audit Log"
        subtitle={`${total.toLocaleString("en-IN")} recorded platform action${total === 1 ? "" : "s"}`}
      />

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <div className="relative min-w-[220px] flex-1">
          <Search
            size={15}
            strokeWidth={1.9}
            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[var(--ink-muted)]"
          />
          <input
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            placeholder="Search by admin, school or affected account…"
            className="w-full rounded-xl border border-black/[0.08] bg-white py-2 pl-9 pr-3 text-sm text-[var(--ink-primary)] placeholder:text-[var(--ink-muted)] focus:border-accent-400 focus:outline-none focus:ring-2 focus:ring-accent-500/20 dark:border-white/[0.1] dark:bg-[#17171a]"
          />
        </div>

        <select
          value={action}
          onChange={(e) => {
            setAction(e.target.value);
            setPage(1);
          }}
          className="rounded-xl border border-black/[0.08] bg-white px-3 py-2 text-sm text-[var(--ink-primary)] focus:border-accent-400 focus:outline-none focus:ring-2 focus:ring-accent-500/20 dark:border-white/[0.1] dark:bg-[#17171a]"
        >
          <option value="">All actions</option>
          {(actionsQuery.data ?? []).map((code) => (
            <option key={code} value={code}>
              {actionLabel(code)}
            </option>
          ))}
        </select>
      </div>

      <div className="overflow-x-auto">
        <DataTable
          columns={columns}
          rows={logQuery.data?.items ?? []}
          rowKey={(row) => row.id}
          isLoading={logQuery.isLoading}
          emptyMessage="No platform actions have been recorded yet."
        />
      </div>

      {(logQuery.data?.items.length ?? 0) === 0 && !logQuery.isLoading && total === 0 && (
        <p className="mt-3 flex items-center justify-center gap-1.5 text-xs text-[var(--ink-muted)]">
          <ScrollText size={13} strokeWidth={1.9} />
          Creating a school or School Admin will start populating this log.
        </p>
      )}

      {totalPages > 1 && (
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
          <p className="text-xs text-[var(--ink-muted)]">
            Page {page} of {totalPages}
          </p>
          <div className="flex gap-2">
            <Button variant="secondary" onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1}>
              <ChevronLeft size={15} strokeWidth={2} />
              Previous
            </Button>
            <Button
              variant="secondary"
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page >= totalPages}
            >
              Next
              <ChevronRight size={15} strokeWidth={2} />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

/** Renders the few metadata keys worth surfacing inline; the rest stay in the row's JSON. */
function ImpactSummary({ metadata }: { metadata: Record<string, unknown> }) {
  const parts: string[] = [];

  const usersAffected = metadata.usersAffected;
  if (typeof usersAffected === "number") parts.push(`${usersAffected} user${usersAffected === 1 ? "" : "s"}`);

  const schoolCount = metadata.schoolCount;
  if (typeof schoolCount === "number") parts.push(`${schoolCount} school${schoolCount === 1 ? "" : "s"}`);

  const deactivated = metadata.schoolsDeactivated;
  if (Array.isArray(deactivated) && deactivated.length > 0) parts.push(`${deactivated.length} school(s) off`);

  const reactivated = metadata.schoolsReactivated;
  if (Array.isArray(reactivated) && reactivated.length > 0) parts.push(`${reactivated.length} school(s) on`);

  if (parts.length === 0) return <span className="text-xs text-[var(--ink-muted)]">—</span>;
  return <span className="whitespace-nowrap text-xs text-[var(--ink-secondary)]">{parts.join(" · ")}</span>;
}
