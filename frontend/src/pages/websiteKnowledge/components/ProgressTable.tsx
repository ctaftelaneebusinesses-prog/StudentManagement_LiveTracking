import { useMemo, useState } from "react";
import { Eye, Search } from "lucide-react";
import { DataTable, Column } from "@/components/ui/DataTable";
import { Avatar } from "@/components/ui/Avatar";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { AssessmentStatus, ProgressRow } from "@/types/websiteKnowledge.types";
import { StatusBadge } from "./StatusBadge";
import { formatDateTime, formatPercentage } from "../utils";

export interface GenericProgressRow extends ProgressRow {
  id: string;
  name: string;
  avatar_url: string | null;
  subtitle: string | null;
}

const FILTERS: { value: string; label: string }[] = [
  { value: "all", label: "All" },
  { value: "completed", label: "Completed" },
  { value: "not_attempted", label: "Not Completed" },
  { value: "passed", label: "Passed" },
  { value: "failed", label: "Failed" },
  { value: "certified", label: "Certified" },
];

function matchesFilter(status: AssessmentStatus, filter: string): boolean {
  if (filter === "all") return true;
  if (filter === "completed") return status === "passed" || status === "failed" || status === "certified";
  if (filter === "not_attempted") return status === "not_attempted" || status === "in_progress";
  if (filter === "certified") return status === "certified";
  if (filter === "passed") return status === "passed" || status === "certified";
  if (filter === "failed") return status === "failed";
  return true;
}

export function ProgressTable({
  rows,
  subtitleLabel,
  isLoading,
  onView,
}: {
  rows: GenericProgressRow[];
  subtitleLabel?: string;
  isLoading?: boolean;
  onView: (id: string) => void;
}) {
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("all");
  const [sortBy, setSortBy] = useState<"name" | "percentage" | "date">("name");

  const filtered = useMemo(() => {
    let result = rows.filter((r) => r.name.toLowerCase().includes(search.toLowerCase()));
    result = result.filter((r) => matchesFilter(r.status, filter));
    result = result.slice().sort((a, b) => {
      if (sortBy === "name") return a.name.localeCompare(b.name);
      if (sortBy === "percentage") return (b.latest_attempt?.percentage ?? -1) - (a.latest_attempt?.percentage ?? -1);
      return (b.latest_attempt?.completed_at ?? "").localeCompare(a.latest_attempt?.completed_at ?? "");
    });
    return result;
  }, [rows, search, filter, sortBy]);

  const columns: Column<GenericProgressRow>[] = [
    {
      header: subtitleLabel ? "Name" : "Name",
      cell: (r) => (
        <div className="flex items-center gap-3">
          <Avatar name={r.name} src={r.avatar_url ?? undefined} size="md" />
          <div>
            <div className="font-medium text-[var(--ink-primary)]">{r.name}</div>
            {r.subtitle && <div className="text-xs text-[var(--ink-muted)]">{r.subtitle}</div>}
          </div>
        </div>
      ),
    },
    { header: "Attempts", cell: (r) => r.attempt_count },
    { header: "Score", cell: (r) => (r.latest_attempt ? `${formatPercentage(r.latest_attempt.percentage)}` : "—") },
    { header: "Last Attempt", cell: (r) => formatDateTime(r.latest_attempt?.completed_at ?? null) },
    { header: "Status", cell: (r) => <StatusBadge status={r.status} /> },
    {
      header: "Certificate",
      cell: (r) => (r.certificate ? <span className="text-xs font-medium text-[var(--status-good)]">Certified</span> : <span className="text-xs text-[var(--ink-muted)]">Not Certified</span>),
    },
    {
      header: "",
      cell: (r) => (
        <button
          type="button"
          onClick={() => onView(r.id)}
          className="rounded-md p-1.5 text-[var(--ink-muted)] transition-colors hover:bg-black/[0.05] hover:text-accent-600 dark:hover:bg-white/[0.08]"
          aria-label="View details"
        >
          <Eye size={16} />
        </button>
      ),
      className: "text-right",
    },
  ];

  return (
    <div className="space-y-3">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
        <div className="relative flex-1">
          <Search size={15} className="pointer-events-none absolute left-3 top-[38px] -translate-y-1/2 text-[var(--ink-muted)]" />
          <Input label="Search" placeholder="Search by name..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
        </div>
        <Select label="Filter" value={filter} onChange={(e) => setFilter(e.target.value)} options={FILTERS} />
        <Select
          label="Sort by"
          value={sortBy}
          onChange={(e) => setSortBy(e.target.value as typeof sortBy)}
          options={[
            { value: "name", label: "Name" },
            { value: "percentage", label: "Percentage" },
            { value: "date", label: "Completion Date" },
          ]}
        />
      </div>

      <DataTable columns={columns} rows={filtered} rowKey={(r) => r.id} isLoading={isLoading} emptyMessage="No one matches this filter yet." />
    </div>
  );
}
