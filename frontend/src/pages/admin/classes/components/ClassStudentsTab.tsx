import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { LucideIcon } from "lucide-react";
import { ArrowRightLeft, ChevronLeft, ChevronRight, Plus, Search, TrendingUp, Upload } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { DataTable } from "@/components/ui/DataTable";
import { ExportButtons } from "@/components/ui/ExportButtons";
import { ChartCard } from "@/pages/admin/dashboard/components/ChartCard";
import * as classesService from "@/services/admin/classes.service";
import * as studentsService from "@/services/admin/students.service";
import { ClassRoom, Student } from "@/types/admin.types";
import { ExportColumn } from "@/utils/export";
import { AddStudentModal } from "./AddStudentModal";
import { BulkImportModal } from "./BulkImportModal";
import { PromoteTransferModal } from "./PromoteTransferModal";

const PAGE_SIZE = 10;

function SummaryPill({
  label,
  value,
  icon: Icon,
  accent,
}: {
  label: string;
  value: number;
  icon?: LucideIcon;
  accent?: "good" | "bad";
}) {
  const valueClass =
    accent === "good" ? "text-[var(--delta-good)]" : accent === "bad" ? "text-[var(--delta-bad)]" : "text-[var(--ink-primary)]";
  return (
    <div className="flex-1 rounded-2xl border border-black/[0.06] bg-white px-5 py-4 dark:border-white/[0.08] dark:bg-[#17171a]">
      <div className="flex items-center gap-1.5 text-xs font-medium text-[var(--ink-muted)]">
        {Icon && <Icon size={13} />}
        {label}
      </div>
      <p className={`mt-1 text-2xl font-semibold ${valueClass}`}>{value}</p>
    </div>
  );
}

export function ClassStudentsTab({ classId, klass }: { classId: string; klass: ClassRoom | undefined }) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [page, setPage] = useState(1);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isAddOpen, setAddOpen] = useState(false);
  const [isImportOpen, setImportOpen] = useState(false);
  const [bulkAction, setBulkAction] = useState<"promote" | "transfer" | null>(null);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search);
      setPage(1);
    }, 350);
    return () => clearTimeout(timer);
  }, [search]);

  const rosterQuery = useQuery({
    queryKey: ["admin", "class", classId, "students", debouncedSearch, page],
    queryFn: () =>
      classesService.fetchClassStudents(classId, { search: debouncedSearch || undefined, page, pageSize: PAGE_SIZE }),
    enabled: !!classId,
  });

  const attendanceQuery = useQuery({
    queryKey: ["admin", "class", classId, "attendance-today"],
    queryFn: () => classesService.fetchClassAttendanceToday(classId),
    enabled: !!classId,
  });

  const allClassesQuery = useQuery({
    queryKey: ["admin", "classes"],
    queryFn: classesService.fetchClasses,
  });

  const attendanceTally = useMemo(() => {
    const rows = attendanceQuery.data ?? [];
    const present = rows.filter((r) => r.status === "present" || r.status === "late" || r.status === "half_day").length;
    const absent = rows.filter((r) => r.status === "absent" || r.status === "leave" || r.status === "excused").length;
    return { present, absent };
  }, [attendanceQuery.data]);

  function invalidateClass() {
    queryClient.invalidateQueries({ queryKey: ["admin", "class", classId] });
    queryClient.invalidateQueries({ queryKey: ["admin", "classes"] });
  }

  const bulkAssignMutation = useMutation({
    mutationFn: (targetClassId: string) => studentsService.bulkAssignClass(Array.from(selectedIds), targetClassId),
    onSuccess: () => {
      invalidateClass();
      setSelectedIds(new Set());
      setBulkAction(null);
    },
  });

  const roster = rosterQuery.data;
  const totalPages = roster ? Math.max(1, Math.ceil(roster.total / PAGE_SIZE)) : 1;
  const pageIds = roster?.items.map((s) => s.id) ?? [];
  const allOnPageSelected = pageIds.length > 0 && pageIds.every((sid) => selectedIds.has(sid));

  function toggleSelected(studentId: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(studentId)) next.delete(studentId);
      else next.add(studentId);
      return next;
    });
  }

  function toggleSelectAllOnPage() {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (allOnPageSelected) pageIds.forEach((sid) => next.delete(sid));
      else pageIds.forEach((sid) => next.add(sid));
      return next;
    });
  }

  const exportColumns: ExportColumn<Student>[] = [
    { header: "Admission No", accessor: (s) => s.admission_no },
    { header: "Name", accessor: (s) => s.users.full_name },
    { header: "Email", accessor: (s) => s.users.email },
    { header: "Roll No", accessor: (s) => s.roll_no ?? "" },
    { header: "Gender", accessor: (s) => s.gender ?? "" },
    { header: "Status", accessor: (s) => (s.users.is_active ? "Active" : "Inactive") },
  ];

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
        <SummaryPill label="Students" value={klass?.student_count ?? 0} />
        <SummaryPill label="Present today" value={attendanceTally.present} accent="good" />
        <SummaryPill label="Absent today" value={attendanceTally.absent} accent="bad" />
      </div>

      <ChartCard
        title="Students"
        subtitle={roster ? `${roster.total} total` : undefined}
        legend={
          <div className="flex flex-wrap items-center gap-2">
            {selectedIds.size > 0 && (
              <>
                <span className="text-xs text-[var(--ink-muted)]">{selectedIds.size} selected</span>
                <Button variant="secondary" className="!px-3 !py-1.5 text-xs" onClick={() => setBulkAction("promote")}>
                  <TrendingUp size={14} className="mr-1" />
                  Promote
                </Button>
                <Button variant="secondary" className="!px-3 !py-1.5 text-xs" onClick={() => setBulkAction("transfer")}>
                  <ArrowRightLeft size={14} className="mr-1" />
                  Transfer
                </Button>
              </>
            )}
            <ExportButtons
              title={klass ? `${klass.name} - ${klass.section}` : "Class"}
              columns={exportColumns}
              rows={roster?.items ?? []}
              filename={klass ? `class-${klass.name}-${klass.section}` : "class"}
            />
            <Button variant="secondary" className="!px-3 !py-1.5 text-xs" onClick={() => setImportOpen(true)}>
              <Upload size={14} className="mr-1" />
              Bulk import
            </Button>
            <Button className="!px-3 !py-1.5 text-xs" onClick={() => setAddOpen(true)}>
              <Plus size={14} className="mr-1" />
              Add student
            </Button>
          </div>
        }
      >
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div className="relative max-w-sm flex-1">
            <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[var(--ink-muted)]" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by name, email, or admission no…"
              className="w-full rounded-lg border border-slate-300 bg-white py-2 pl-9 pr-3 text-sm text-slate-900 outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500 dark:border-white/15 dark:bg-white/5 dark:text-white"
            />
          </div>
          {pageIds.length > 0 && (
            <label className="flex items-center gap-2 text-xs text-[var(--ink-muted)]">
              <input type="checkbox" checked={allOnPageSelected} onChange={toggleSelectAllOnPage} />
              Select all on this page
            </label>
          )}
        </div>

        <DataTable
          isLoading={rosterQuery.isLoading}
          rows={roster?.items ?? []}
          rowKey={(s) => s.id}
          emptyMessage={debouncedSearch ? "No students match your search." : "No students in this class yet."}
          columns={[
            {
              header: "",
              cell: (s) => (
                <input type="checkbox" checked={selectedIds.has(s.id)} onChange={() => toggleSelected(s.id)} />
              ),
            },
            {
              header: "Name",
              cell: (s) => (
                <button
                  type="button"
                  className="font-medium text-[var(--ink-primary)] hover:underline"
                  onClick={() => navigate(`/dashboard/admin/students/${s.id}`)}
                >
                  {s.users.full_name}
                </button>
              ),
            },
            { header: "Admission No", cell: (s) => s.admission_no },
            { header: "Roll No", cell: (s) => s.roll_no ?? "—" },
            { header: "Email", cell: (s) => s.users.email },
            {
              header: "Status",
              cell: (s) => (
                <span
                  className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                    s.users.is_active
                      ? "bg-emerald-500/10 text-[var(--delta-good)]"
                      : "bg-black/5 text-[var(--ink-muted)] dark:bg-white/10"
                  }`}
                >
                  {s.users.is_active ? "Active" : "Inactive"}
                </span>
              ),
            },
          ]}
        />

        {roster && roster.total > 0 && (
          <div className="mt-4 flex items-center justify-between text-sm text-[var(--ink-muted)]">
            <span>
              Page {roster.page} of {totalPages}
            </span>
            <div className="flex gap-2">
              <Button
                variant="secondary"
                className="!px-2.5 !py-1.5"
                disabled={page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
              >
                <ChevronLeft size={16} />
              </Button>
              <Button
                variant="secondary"
                className="!px-2.5 !py-1.5"
                disabled={page >= totalPages}
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              >
                <ChevronRight size={16} />
              </Button>
            </div>
          </div>
        )}
      </ChartCard>

      <AddStudentModal
        isOpen={isAddOpen}
        onClose={() => setAddOpen(false)}
        classId={classId}
        onCreated={() => {
          invalidateClass();
          queryClient.invalidateQueries({ queryKey: ["admin", "class", classId, "students"] });
        }}
      />
      <BulkImportModal
        isOpen={isImportOpen}
        onClose={() => setImportOpen(false)}
        classId={classId}
        classes={allClassesQuery.data ?? []}
        onImported={() => {
          invalidateClass();
          queryClient.invalidateQueries({ queryKey: ["admin", "class", classId, "students"] });
        }}
      />
      <PromoteTransferModal
        mode={bulkAction}
        classes={(allClassesQuery.data ?? []).filter((c) => c.id !== classId)}
        selectedCount={selectedIds.size}
        isSubmitting={bulkAssignMutation.isPending}
        onConfirm={(targetClassId) => bulkAssignMutation.mutate(targetClassId)}
        onClose={() => setBulkAction(null)}
      />
    </div>
  );
}
