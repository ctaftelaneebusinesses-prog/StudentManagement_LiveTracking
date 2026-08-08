import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { CheckCircle2, XCircle } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { DataTable } from "@/components/ui/DataTable";
import { ErrorState } from "@/pages/admin/dashboard/components/states/ErrorState";
import { SettingsCard } from "./SettingsCard";
import * as auditLogService from "@/services/admin/auditLog.service";

const PAGE_SIZE = 10;

function Pagination({ page, setPage, total }: { page: number; setPage: (updater: (p: number) => number) => void; total: number }) {
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  if (total === 0) return null;
  return (
    <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-sm text-[var(--ink-muted)]">
      <p>
        Showing {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, total)} of {total}
      </p>
      <div className="flex flex-wrap gap-2">
        <Button variant="secondary" className="!px-3 !py-1 text-xs" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
          Previous
        </Button>
        <span className="self-center">
          Page {page} of {totalPages}
        </span>
        <Button variant="secondary" className="!px-3 !py-1 text-xs" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>
          Next
        </Button>
      </div>
    </div>
  );
}

function LoginHistoryCard() {
  const [page, setPage] = useState(1);
  const query = useQuery({
    queryKey: ["admin", "audit", "login-history", page],
    queryFn: () => auditLogService.fetchLoginHistory({ page, pageSize: PAGE_SIZE }),
  });

  return (
    <SettingsCard title="Login History" subtitle="Every login attempt, success or failure">
      {query.isError ? (
        <ErrorState message={query.error instanceof Error ? query.error.message : undefined} onRetry={() => query.refetch()} />
      ) : (
        <>
          <DataTable
            isLoading={query.isLoading}
            rows={query.data?.items ?? []}
            rowKey={(r) => r.id}
            emptyMessage="No login attempts recorded yet."
            columns={[
              {
                header: "",
                cell: (r) =>
                  r.success ? (
                    <CheckCircle2 size={16} className="text-[var(--status-good)]" />
                  ) : (
                    <XCircle size={16} className="text-[var(--delta-bad)]" />
                  ),
              },
              { header: "Email", cell: (r) => r.email },
              { header: "User", cell: (r) => r.users?.full_name ?? "—" },
              { header: "IP Address", cell: (r) => r.ip_address ?? "—" },
              { header: "When", cell: (r) => new Date(r.created_at).toLocaleString() },
            ]}
          />
          <Pagination page={page} setPage={setPage} total={query.data?.total ?? 0} />
        </>
      )}
    </SettingsCard>
  );
}

function ActivityLogCard() {
  const [page, setPage] = useState(1);
  const query = useQuery({
    queryKey: ["admin", "audit", "activity-log", page],
    queryFn: () => auditLogService.fetchActivityLog({ page, pageSize: PAGE_SIZE }),
  });

  return (
    <SettingsCard title="Activity Log" subtitle="Curated admin actions — user/role changes, settings updates, password changes">
      {query.isError ? (
        <ErrorState message={query.error instanceof Error ? query.error.message : undefined} onRetry={() => query.refetch()} />
      ) : (
        <>
          <DataTable
            isLoading={query.isLoading}
            rows={query.data?.items ?? []}
            rowKey={(r) => r.id}
            emptyMessage="No activity recorded yet."
            columns={[
              { header: "Action", cell: (r) => <span className="font-mono text-xs">{r.action}</span> },
              { header: "By", cell: (r) => r.users?.full_name ?? "System" },
              { header: "When", cell: (r) => new Date(r.created_at).toLocaleString() },
            ]}
          />
          <Pagination page={page} setPage={setPage} total={query.data?.total ?? 0} />
        </>
      )}
    </SettingsCard>
  );
}

export function SecurityLogsTab() {
  return (
    <div className="animate-fade-in space-y-6">
      <LoginHistoryCard />
      <ActivityLogCard />
    </div>
  );
}
