import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { LucideIcon } from "lucide-react";
import { BadgeCheck, CalendarCheck, Eye, Pencil, Plus, Power, Search, Sparkles, Users } from "lucide-react";
import { Avatar } from "@/components/ui/Avatar";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { DataTable } from "@/components/ui/DataTable";
import { ExportButtons } from "@/components/ui/ExportButtons";
import { SearchableSelect } from "@/components/ui/SearchableSelect";
import { useToast } from "@/components/ui/Toast";
import { ChartCard } from "@/pages/admin/dashboard/components/ChartCard";
import { ClassSectionSelects, ClassSectionValue } from "@/pages/admin/teachers/components/ClassSectionSelects";
import { StaffFormModal } from "@/pages/admin/extracurricularStaff/components/StaffFormModal";
import * as staffService from "@/services/admin/extracurricularStaff.service";
import * as activitiesService from "@/services/admin/activities.service";
import * as classesService from "@/services/admin/classes.service";
import { ExtracurricularStaff } from "@/types/extracurricularStaff.types";
import { ExportColumn } from "@/utils/export";
import { getApiErrorMessage } from "@/lib/axios";
import { resolveClassId } from "@/utils/classPicker";

const PAGE_SIZE = 10;
const EMPTY_CLASS_SECTION: ClassSectionValue = { academicYearId: "", className: "", section: "" };

function StatPill({ label, value, icon: Icon }: { label: string; value: string | number; icon: LucideIcon }) {
  return (
    <div className="flex-1 rounded-2xl border border-black/[0.06] bg-white px-5 py-4 dark:border-white/[0.08] dark:bg-[#17171a]">
      <div className="flex items-center gap-1.5 text-xs font-medium text-[var(--ink-muted)]">
        <Icon size={13} />
        {label}
      </div>
      <p className="mt-1 text-2xl font-semibold text-[var(--ink-primary)]">{value}</p>
    </div>
  );
}

export function ExtracurricularStaffPage() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const toast = useToast();

  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [staffTypeFilter, setStaffTypeFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState<"" | "active" | "inactive">("");
  const [classFilter, setClassFilter] = useState<ClassSectionValue>(EMPTY_CLASS_SECTION);
  const [page, setPage] = useState(1);
  const [modalMode, setModalMode] = useState<"add" | "edit" | null>(null);
  const [editingStaff, setEditingStaff] = useState<ExtracurricularStaff | null>(null);
  const [pendingStatusChange, setPendingStatusChange] = useState<ExtracurricularStaff | null>(null);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search);
      setPage(1);
    }, 350);
    return () => clearTimeout(timer);
  }, [search]);

  const { data: stats } = useQuery({
    queryKey: ["admin", "extracurricular-staff", "dashboard-stats"],
    queryFn: staffService.fetchExtracurricularDashboardStats,
  });

  const { data: activities = [] } = useQuery({
    queryKey: ["admin", "activities", "all"],
    queryFn: () => activitiesService.fetchActivities(),
  });

  const { data: classes = [] } = useQuery({ queryKey: ["admin", "classes"], queryFn: classesService.fetchClasses });
  const classFilterId = resolveClassId(classes, classFilter.academicYearId, classFilter.className, classFilter.section);

  const { data: staffPage, isLoading } = useQuery({
    queryKey: [
      "admin",
      "extracurricular-staff",
      debouncedSearch,
      staffTypeFilter,
      statusFilter,
      classFilterId,
      page,
    ],
    queryFn: () =>
      staffService.fetchExtracurricularStaffList({
        search: debouncedSearch || undefined,
        staff_type_activity_id: staffTypeFilter || undefined,
        status: statusFilter || undefined,
        class_id: classFilterId || undefined,
        page,
        pageSize: PAGE_SIZE,
      }),
  });

  function invalidateStaff() {
    queryClient.invalidateQueries({ queryKey: ["admin", "extracurricular-staff"] });
  }

  function openAddModal() {
    setEditingStaff(null);
    setModalMode("add");
  }

  function openEditModal(staff: ExtracurricularStaff) {
    setEditingStaff(staff);
    setModalMode("edit");
  }

  const statusMutation = useMutation({
    mutationFn: ({ id, is_active }: { id: string; is_active: boolean }) =>
      staffService.setExtracurricularStaffStatus(id, is_active),
    onSuccess: (_data, variables) => {
      invalidateStaff();
      toast.success(variables.is_active ? "Staff member activated." : "Staff member deactivated.");
      setPendingStatusChange(null);
    },
    onError: (err) => toast.error(getApiErrorMessage(err, "Failed to update status.")),
  });

  const totalPages = staffPage ? Math.max(1, Math.ceil(staffPage.total / PAGE_SIZE)) : 1;

  const exportColumns: ExportColumn<ExtracurricularStaff>[] = [
    { header: "Staff code", accessor: (s) => s.staff_code },
    { header: "Name", accessor: (s) => s.users.full_name },
    { header: "Staff type", accessor: (s) => s.staff_type_activity?.staff_title ?? "" },
    { header: "Email", accessor: (s) => s.users.email },
    { header: "Phone", accessor: (s) => s.users.phone ?? "" },
    { header: "Status", accessor: (s) => (s.users.is_active ? "Active" : "Inactive") },
  ];

  return (
    <div className="animate-fade-in space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-[var(--ink-primary)]">Extracurricular staff</h1>
        <p className="mt-1 text-sm text-[var(--ink-muted)]">
          Manage non-academic instructors — dance, yoga, karate, music, art, and other activity staff.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <StatPill label="Total Extracurricular Staff" value={stats?.totalStaff ?? "—"} icon={Users} />
        <StatPill label="Active Staff" value={stats?.activeStaff ?? "—"} icon={BadgeCheck} />
        <StatPill label="Activities Assigned" value={stats?.activitiesAssignedCount ?? "—"} icon={Sparkles} />
        <StatPill label="Students Training Today" value={stats?.studentsTrainingToday ?? "—"} icon={CalendarCheck} />
      </div>

      <ChartCard
        title="Extracurricular Staff"
        subtitle={staffPage ? `${staffPage.total} total` : undefined}
        legend={
          <div className="flex flex-wrap gap-2">
            <ExportButtons
              title="Extracurricular Staff"
              columns={exportColumns}
              rows={staffPage?.items ?? []}
              filename="extracurricular-staff"
            />
            <Button onClick={openAddModal} className="!px-3 !py-1.5 text-xs">
              <Plus size={14} className="mr-1" />
              Add staff
            </Button>
          </div>
        }
      >
        <div className="mb-4 flex flex-wrap items-center gap-3">
          <div className="relative max-w-sm flex-1">
            <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[var(--ink-muted)]" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by name, email, or staff code…"
              className="w-full rounded-lg border border-slate-300 bg-white py-2 pl-9 pr-3 text-sm text-slate-900 outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500 dark:border-white/15 dark:bg-white/5 dark:text-white"
            />
          </div>
          <select
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value as "" | "active" | "inactive");
              setPage(1);
            }}
            className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500 dark:border-white/15 dark:bg-white/5 dark:text-white"
          >
            <option value="">All statuses</option>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
          </select>
        </div>

        <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <SearchableSelect
            label="Staff type"
            placeholder="All staff types"
            options={activities.map((a) => ({ value: a.id, label: a.staff_title }))}
            value={staffTypeFilter}
            onChange={(v) => {
              setStaffTypeFilter(v);
              setPage(1);
            }}
          />
          <ClassSectionSelects
            classes={classes}
            value={classFilter}
            onChange={(next) => {
              setClassFilter(next);
              setPage(1);
            }}
          />
        </div>

        <DataTable
          isLoading={isLoading}
          rows={staffPage?.items ?? []}
          rowKey={(s) => s.id}
          emptyMessage={
            debouncedSearch ? "No staff match your search." : "No extracurricular staff yet. Add your first staff member to get started."
          }
          onRowClick={(s) => navigate(`/dashboard/admin/extracurricular-staff/${s.id}`)}
          columns={[
            {
              header: "Photo",
              cell: (s) => <Avatar src={s.users.avatar_url} name={s.users.full_name} />,
            },
            {
              header: "Name",
              cell: (s) => <span className="font-medium text-[var(--ink-primary)]">{s.users.full_name}</span>,
            },
            { header: "Staff code", cell: (s) => s.staff_code },
            {
              header: "Staff type",
              cell: (s) =>
                s.staff_type_activity ? (
                  <Badge variant="info">{s.staff_type_activity.staff_title}</Badge>
                ) : (
                  <span className="text-[var(--ink-muted)]">—</span>
                ),
            },
            { header: "Phone", cell: (s) => s.users.phone ?? "—" },
            {
              header: "Status",
              cell: (s) => (
                <Badge variant={s.users.is_active ? "success" : "neutral"}>{s.users.is_active ? "Active" : "Inactive"}</Badge>
              ),
            },
            {
              header: "",
              cell: (s) => (
                <div className="flex justify-end gap-1" onClick={(e) => e.stopPropagation()}>
                  <Button
                    variant="ghost"
                    className="!p-1.5"
                    title="View profile"
                    onClick={() => navigate(`/dashboard/admin/extracurricular-staff/${s.id}`)}
                  >
                    <Eye size={15} />
                  </Button>
                  <Button variant="ghost" className="!p-1.5" title="Edit" onClick={() => openEditModal(s)}>
                    <Pencil size={15} />
                  </Button>
                  <Button
                    variant="ghost"
                    className={`!p-1.5 ${s.users.is_active ? "text-red-600" : "text-[var(--delta-good)]"}`}
                    title={s.users.is_active ? "Deactivate" : "Activate"}
                    onClick={() =>
                      s.users.is_active ? setPendingStatusChange(s) : statusMutation.mutate({ id: s.id, is_active: true })
                    }
                  >
                    <Power size={15} />
                  </Button>
                </div>
              ),
              className: "text-right",
            },
          ]}
        />

        {staffPage && staffPage.total > 0 && (
          <div className="mt-4 flex flex-wrap items-center justify-between gap-2 text-sm text-[var(--ink-muted)]">
            <span>
              Page {staffPage.page} of {totalPages}
            </span>
            <div className="flex gap-2">
              <Button
                variant="secondary"
                className="!px-2.5 !py-1.5"
                disabled={page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
              >
                Prev
              </Button>
              <Button
                variant="secondary"
                className="!px-2.5 !py-1.5"
                disabled={page >= totalPages}
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              >
                Next
              </Button>
            </div>
          </div>
        )}
      </ChartCard>

      <StaffFormModal
        isOpen={modalMode !== null}
        mode={modalMode ?? "add"}
        staff={editingStaff}
        onClose={() => setModalMode(null)}
        onSaved={invalidateStaff}
      />

      <ConfirmDialog
        isOpen={!!pendingStatusChange}
        title="Deactivate staff member"
        message={`Deactivate "${pendingStatusChange?.users.full_name}"? This disables their portal access while preserving their assignment and attendance history.`}
        confirmLabel="Deactivate"
        isLoading={statusMutation.isPending}
        onConfirm={() => pendingStatusChange && statusMutation.mutate({ id: pendingStatusChange.id, is_active: false })}
        onCancel={() => setPendingStatusChange(null)}
      />
    </div>
  );
}
