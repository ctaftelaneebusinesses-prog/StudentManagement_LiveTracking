import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Eye, ArrowUpDown, Users } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Button } from "@/components/ui/Button";
import { DataTable } from "@/components/ui/DataTable";
import { Avatar } from "@/components/ui/Avatar";
import { EmptyState } from "@/components/ui/EmptyState";
import { useStudentFeeDetails } from "@/pages/admin/fees/hooks/useStudentFeeDetails";
import { FeeStatusBadge } from "@/pages/admin/fees/components/FeeStatusBadge";
import { ClassSectionSelects, ClassSectionValue } from "@/pages/admin/teachers/components/ClassSectionSelects";
import { resolveClassId } from "@/utils/classPicker";
import { useFeeClasses } from "./hooks/useFeeClasses";
import { StudentFeeDetail, FeeStatus } from "@/types/fees.types";

const PAGE_SIZE = 15;
type SortKey = "name" | "admissionNo" | "rollNo" | "balance";

const STATUS_OPTIONS = [
  { value: "all", label: "All statuses" },
  { value: "paid", label: "Paid" },
  { value: "partial", label: "Partially paid" },
  { value: "unpaid", label: "Unpaid" },
];

export function AccountantStudentsPage() {
  const navigate = useNavigate();
  const [classSelection, setClassSelection] = useState<ClassSectionValue>({ academicYearId: "", className: "", section: "" });
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<"all" | FeeStatus>("all");
  const [sortKey, setSortKey] = useState<SortKey>("admissionNo");
  const [page, setPage] = useState(1);

  const classesQuery = useFeeClasses();
  const classes = classesQuery.data ?? [];
  const classId = resolveClassId(classes, classSelection.academicYearId, classSelection.className, classSelection.section);
  const canQuery = !!classId;

  const { data, isLoading, isFetching } = useStudentFeeDetails({
    classId: classId || undefined,
    search: search || undefined,
    status,
    page,
    pageSize: PAGE_SIZE,
  });

  function handleClassSelectionChange(next: ClassSectionValue) {
    setClassSelection(next);
    setPage(1);
  }

  const rows = data?.items ?? [];
  const sorted = useMemo(() => {
    return [...rows].sort((a, b) => {
      if (sortKey === "name") return a.name.localeCompare(b.name);
      if (sortKey === "rollNo") return (a.rollNo ?? "").localeCompare(b.rollNo ?? "", undefined, { numeric: true });
      if (sortKey === "balance") return b.balance - a.balance;
      return a.admissionNo.localeCompare(b.admissionNo, undefined, { numeric: true });
    });
  }, [rows, sortKey]);

  const total = data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  function cycleSortBy(key: SortKey) {
    setSortKey(key);
  }

  return (
    <div className="animate-fade-in space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-[var(--ink-primary)]">Students</h1>
        <p className="mt-1 text-sm text-[var(--ink-muted)]">
          Select an academic year, class, and section to view fee status for every student.
        </p>
      </div>

      <Card className="space-y-4">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5">
          <ClassSectionSelects classes={classes} value={classSelection} onChange={handleClassSelectionChange} />
          {canQuery && (
            <>
              <Input
                label="Search"
                placeholder="Search by name or admission no."
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setPage(1);
                }}
              />
              <Select
                label="Fee status"
                options={STATUS_OPTIONS}
                value={status}
                onChange={(e) => {
                  setStatus(e.target.value as "all" | FeeStatus);
                  setPage(1);
                }}
              />
            </>
          )}
        </div>

        {!canQuery ? (
          <EmptyState icon={Users} title="Select a class to get started" description="Choose an academic year, class, and section above." />
        ) : (
          <>
            <div className="flex flex-wrap gap-2">
              {(["admissionNo", "rollNo", "name", "balance"] as SortKey[]).map((key) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => cycleSortBy(key)}
                  className={`inline-flex items-center gap-1 rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
                    sortKey === key
                      ? "border-transparent bg-accent-600 text-white"
                      : "border-black/10 bg-transparent text-[var(--ink-secondary)] hover:bg-black/[0.03] dark:border-white/15 dark:hover:bg-white/[0.06]"
                  }`}
                >
                  <ArrowUpDown size={12} />
                  Sort by {key === "admissionNo" ? "admission no." : key === "rollNo" ? "roll no." : key}
                </button>
              ))}
            </div>

            <DataTable<StudentFeeDetail>
              isLoading={isLoading}
              rows={sorted}
              rowKey={(s) => s.id}
              emptyMessage="No students found."
              columns={[
                {
                  header: "",
                  className: "w-10",
                  cell: (s) => <Avatar src={s.avatarUrl} name={s.name} size="sm" />,
                },
                {
                  header: "Name",
                  headerClassName: "font-semibold text-[var(--ink-primary)]",
                  cell: (s) => (
                    <div>
                      <p className="font-semibold text-[var(--ink-primary)]">{s.name}</p>
                      <p className="text-xs text-[var(--ink-muted)]">{s.className}</p>
                    </div>
                  ),
                },
                { header: "Admission No", headerClassName: "font-semibold text-[var(--ink-primary)]", cell: (s) => s.admissionNo },
                { header: "Roll No", headerClassName: "font-semibold text-[var(--ink-primary)]", cell: (s) => s.rollNo ?? "—" },
                {
                  header: "Parent",
                  headerClassName: "font-semibold text-[var(--ink-primary)]",
                  cell: (s) => (
                    <div className="text-xs">
                      <p className="text-[var(--ink-primary)]">{s.parentName ?? "—"}</p>
                      <p className="text-[var(--ink-muted)]">{s.parentContact ?? ""}</p>
                    </div>
                  ),
                },
                {
                  header: "Fee Status",
                  headerClassName: "font-semibold text-[var(--ink-primary)]",
                  cell: (s) => <FeeStatusBadge status={s.status} />,
                },
                {
                  header: "Balance",
                  headerClassName: "text-right font-semibold text-[var(--ink-primary)]",
                  className: "text-right",
                  cell: (s) => (
                    <span
                      className={`tabular-nums ${
                        s.balance > 0 ? "font-semibold text-[var(--status-serious)]" : "font-semibold text-[var(--status-good)]"
                      }`}
                    >
                      ₹{s.balance.toLocaleString("en-IN")}
                    </span>
                  ),
                },
                {
                  header: "",
                  className: "text-right",
                  cell: (s) => (
                    <Button
                      variant="ghost"
                      className="!p-1.5"
                      title="View fee profile"
                      onClick={() => navigate(`/dashboard/accountant/students/${s.id}`)}
                    >
                      <Eye size={15} strokeWidth={1.75} />
                    </Button>
                  ),
                },
              ]}
            />

            {total > 0 && (
              <div className="flex flex-wrap items-center justify-between gap-3 text-sm text-[var(--ink-muted)]">
                <p className="flex items-center">
                  Showing {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, total)} of {total}
                  {isFetching && <span className="ml-2 text-xs">Refreshing…</span>}
                </p>
                <div className="flex items-center gap-2">
                  <Button variant="secondary" className="!px-3 !py-1 text-xs" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
                    Previous
                  </Button>
                  <span className="inline-flex items-center rounded-md border border-black/10 px-3 py-1 text-xs dark:border-white/15">
                    Page {page} of {totalPages}
                  </span>
                  <Button
                    variant="secondary"
                    className="!px-3 !py-1 text-xs"
                    disabled={page >= totalPages}
                    onClick={() => setPage((p) => p + 1)}
                  >
                    Next
                  </Button>
                </div>
              </div>
            )}
          </>
        )}
      </Card>
    </div>
  );
}
