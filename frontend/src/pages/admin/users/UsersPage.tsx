import { useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Users as UsersIcon, ShieldCheck, Plus, CheckCircle2, CircleDashed, Upload, Trash2, Eye } from "lucide-react";
import { Tabs, TabItem } from "@/components/ui/Tabs";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Checkbox } from "@/components/ui/Checkbox";
import { DataTable, Column } from "@/components/ui/DataTable";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { useToast } from "@/components/ui/Toast";
import { EmptyState } from "@/components/ui/EmptyState";
import { ExportButtons } from "@/components/ui/ExportButtons";
import * as usersService from "@/services/admin/users.service";
import { AdminUser } from "@/types/admin.types";
import { RoleName } from "@/types/auth.types";
import { useAuth } from "@/hooks/useAuth";
import { getApiErrorMessage } from "@/lib/axios";
import { ExportColumn } from "@/utils/export";
import { ROLE_LABEL } from "@/utils/roles";
import { CreateUserModal } from "./components/CreateUserModal";
import { BulkImportUsersModal } from "./components/BulkImportUsersModal";
import { UserProfileDrawer } from "./components/UserProfileDrawer";
import { RolesPermissionsPanel } from "./components/RolesPermissionsPanel";
import { RoleBadge } from "./components/RoleBadge";
import { UsersTableSkeleton } from "./components/UsersSkeleton";

const ADMIN_TIER_ROLES: RoleName[] = ["principal", "school_admin", "super_admin"];

type TabKey = "directory" | "roles";
type RoleFilterValue = "" | RoleName;

const TABS: TabItem<TabKey>[] = [
  { key: "directory", label: "Directory", icon: UsersIcon },
  { key: "roles", label: "Roles & Permissions", icon: ShieldCheck },
];

const ROLE_FILTERS: { key: RoleFilterValue; label: string }[] = [
  { key: "", label: "All" },
  { key: "school_admin", label: "Admins" },
  { key: "principal", label: "Principals" },
  { key: "teacher", label: "Teachers" },
  { key: "student", label: "Students" },
  { key: "driver", label: "Drivers" },
  { key: "support_staff", label: "Support Staff" },
  { key: "accountant", label: "Accountants" },
];

const STATUS_OPTIONS = [
  { value: "active", label: "Active" },
  { value: "inactive", label: "Inactive" },
];

const PAGE_SIZE = 20;

/** Students/teachers already have a rich dedicated profile page (personal, academic/qualification, fees, attendance, documents, ...) — route straight there instead of the generic drawer, which is what "view" should mean for those roles. */
const FULL_PROFILE_ROUTE: Partial<Record<RoleName, (id: string) => string>> = {
  student: (id) => `/dashboard/admin/students/${id}`,
  teacher: (id) => `/dashboard/admin/teachers/${id}`,
};

export function UsersPage() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const toast = useToast();
  const { hasRole } = useAuth();
  // Principal Management restriction: a principal-only actor cannot bulk
  // activate/deactivate a user who already holds an admin-tier role.
  const isPrincipalActor = hasRole("principal") && !hasRole("school_admin") && !hasRole("super_admin");
  const [searchParams] = useSearchParams();
  const initialRole = searchParams.get("role") as RoleFilterValue | null;
  const [tab, setTab] = useState<TabKey>("directory");
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState<RoleFilterValue>(
    initialRole && ROLE_FILTERS.some((f) => f.key === initialRole) ? initialRole : ""
  );
  const [statusFilter, setStatusFilter] = useState<"" | "active" | "inactive">("");
  const [page, setPage] = useState(1);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isCreateOpen, setCreateOpen] = useState(false);
  const [isBulkImportOpen, setBulkImportOpen] = useState(false);
  const [drawerUserId, setDrawerUserId] = useState<string | null>(null);
  const [bulkAction, setBulkAction] = useState<"activate" | "deactivate" | "delete" | null>(null);

  const usersQuery = useQuery({
    queryKey: ["admin", "users", { search, roleFilter, statusFilter, page }],
    queryFn: () =>
      usersService.fetchUsers({
        search: search || undefined,
        role: roleFilter || undefined,
        status: statusFilter || undefined,
        page,
        pageSize: PAGE_SIZE,
      }),
  });

  const users = usersQuery.data?.items ?? [];
  const total = usersQuery.data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  // Broad, unpaginated fetch (respecting the same filters) backing the Excel/PDF export —
  // separate from the paginated table query above, so the download covers every matching
  // user rather than just the current page.
  const exportQuery = useQuery({
    queryKey: ["admin", "users", "export", { search, roleFilter, statusFilter }],
    queryFn: () =>
      usersService.fetchUsers({
        search: search || undefined,
        role: roleFilter || undefined,
        status: statusFilter || undefined,
        page: 1,
        pageSize: 1000,
      }),
  });

  const pageIds = users.map((u) => u.id);
  const allOnPageSelected = pageIds.length > 0 && pageIds.every((id) => selectedIds.has(id));

  function toggleSelected(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleSelectAllOnPage() {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (allOnPageSelected) {
        pageIds.forEach((id) => next.delete(id));
      } else {
        pageIds.forEach((id) => next.add(id));
      }
      return next;
    });
  }

  const bulkMutation = useMutation({
    mutationFn: async (action: "activate" | "deactivate" | "delete") => {
      const ids = Array.from(selectedIds);
      if (action === "activate") return { ...(await usersService.bulkActivate(ids)), deletedCount: undefined };
      if (action === "deactivate") return { ...(await usersService.bulkDeactivate(ids)), deletedCount: undefined };
      return { ...(await usersService.bulkDeleteUsers(ids)), updatedCount: undefined };
    },
    onSuccess: (result, action) => {
      queryClient.invalidateQueries({ queryKey: ["admin", "users"] });
      setSelectedIds(new Set());
      setBulkAction(null);
      if (action === "delete") {
        toast.success(`${result.deletedCount} user${result.deletedCount === 1 ? "" : "s"} permanently deleted`);
      }
    },
    onError: (err) => {
      toast.error(getApiErrorMessage(err, "Failed to update the selected users."));
      setBulkAction(null);
    },
  });

  function updateFilter<T>(setter: (v: T) => void) {
    return (value: T) => {
      setter(value);
      setPage(1);
    };
  }

  function viewUser(u: AdminUser) {
    const fullProfileRoute = FULL_PROFILE_ROUTE[u.roles.name];
    if (fullProfileRoute) navigate(fullProfileRoute(u.id));
    else setDrawerUserId(u.id);
  }

  const exportColumns: ExportColumn<AdminUser>[] = [
    { header: "Name", accessor: (u) => u.full_name },
    { header: "Email", accessor: (u) => u.email },
    { header: "Role", accessor: (u) => ROLE_LABEL[u.roles.name] },
    { header: "Phone", accessor: (u) => u.phone ?? "" },
    { header: "Status", accessor: (u) => (u.is_active ? "Active" : "Inactive") },
    { header: "Joined", accessor: (u) => new Date(u.created_at).toLocaleDateString() },
  ];

  const columns: Column<AdminUser>[] = [
    {
      header: "",
      cell: (u) => {
        const disabled = isPrincipalActor && ADMIN_TIER_ROLES.includes(u.roles.name);
        return (
          <Checkbox
            checked={selectedIds.has(u.id)}
            onChange={() => toggleSelected(u.id)}
            onClick={(e) => e.stopPropagation()}
            disabled={disabled}
            title={disabled ? "Only a School Admin can manage this account" : undefined}
          />
        );
      },
      className: "w-10",
    },
    {
      header: "Name",
      cell: (u) => (
        <div>
          <p className="font-medium text-[var(--ink-primary)]">{u.full_name}</p>
          <p className="text-xs text-[var(--ink-muted)]">{u.email}</p>
        </div>
      ),
    },
    {
      header: "Role",
      cell: (u) => (
        <div className="space-y-1">
          <RoleBadge role={u.roles.name} />
          {u.designation && <p className="text-xs text-[var(--ink-muted)]">{u.designation}</p>}
        </div>
      ),
    },
    { header: "Phone", cell: (u) => u.phone ?? "—" },
    {
      header: "Status",
      cell: (u) =>
        u.is_active ? (
          <span className="inline-flex items-center rounded-full bg-[var(--status-good)]/10 px-2.5 py-1 text-xs font-semibold text-[var(--status-good)]">
            Active
          </span>
        ) : (
          <span className="inline-flex items-center rounded-full bg-[var(--status-serious)]/10 px-2.5 py-1 text-xs font-semibold text-[var(--status-serious)]">
            Inactive
          </span>
        ),
    },
    { header: "Joined", cell: (u) => new Date(u.created_at).toLocaleDateString() },
    {
      header: "",
      cell: (u) => (
        <button
          type="button"
          title="View profile"
          onClick={(e) => {
            e.stopPropagation();
            viewUser(u);
          }}
          className="rounded-md p-1.5 text-[var(--ink-muted)] hover:bg-black/[0.04] hover:text-[var(--ink-primary)] dark:hover:bg-white/[0.06]"
        >
          <Eye size={16} strokeWidth={1.75} />
        </button>
      ),
      className: "w-10 text-right",
    },
  ];

  return (
    <div className="animate-fade-in space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-[var(--ink-primary)]">Users</h1>
          <p className="mt-1 text-sm text-[var(--ink-muted)]">
            Manage everyone in your school — students, staff, parents, and drivers — in one place.
          </p>
        </div>
        {tab === "directory" && (
          <div className="flex flex-wrap gap-2">
            <ExportButtons title="Users" columns={exportColumns} rows={exportQuery.data?.items ?? []} filename="users" />
            <Button variant="secondary" onClick={() => setBulkImportOpen(true)}>
              <Upload size={16} /> Bulk import
            </Button>
            <Button onClick={() => setCreateOpen(true)}>
              <Plus size={16} /> Add user
            </Button>
          </div>
        )}
      </div>

      <Tabs tabs={TABS} active={tab} onChange={setTab} />

      {tab === "roles" ? (
        <RolesPermissionsPanel />
      ) : (
        <div className="space-y-4">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div className="flex flex-wrap gap-1 rounded-xl border border-black/[0.06] bg-white p-1 dark:border-white/[0.08] dark:bg-[#17171a]">
              {ROLE_FILTERS.map(({ key, label }) => (
                <button
                  key={key || "all"}
                  type="button"
                  onClick={() => updateFilter(setRoleFilter)(key)}
                  className={`rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
                    roleFilter === key
                      ? "bg-accent-600 text-white shadow-sm"
                      : "text-[var(--ink-secondary)] hover:bg-black/[0.04] dark:hover:bg-white/[0.06]"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
            <div className="flex flex-wrap items-end gap-3">
              <div className="w-64">
                <Input
                  label="Search"
                  placeholder="Search by name or email"
                  value={search}
                  onChange={(e) => updateFilter(setSearch)(e.target.value)}
                />
              </div>
              <div className="w-40">
                <Select
                  label="Status"
                  placeholder="All statuses"
                  options={STATUS_OPTIONS}
                  value={statusFilter}
                  onChange={(e) => updateFilter(setStatusFilter)(e.target.value as "" | "active" | "inactive")}
                />
              </div>
            </div>
          </div>

          {selectedIds.size > 0 && (
            <div className="flex items-center justify-between rounded-xl border border-accent-500/20 bg-accent-500/[0.06] px-4 py-2.5">
              <p className="text-sm font-medium text-[var(--ink-primary)]">{selectedIds.size} selected</p>
              <div className="flex gap-2">
                <Button variant="secondary" className="!px-3 !py-1.5 text-xs" onClick={() => setBulkAction("activate")}>
                  <CheckCircle2 size={14} /> Activate
                </Button>
                <Button
                  variant="secondary"
                  className="!px-3 !py-1.5 text-xs text-red-600"
                  onClick={() => setBulkAction("deactivate")}
                >
                  <CircleDashed size={14} /> Deactivate
                </Button>
                <Button
                  variant="danger"
                  className="!px-3 !py-1.5 text-xs"
                  onClick={() => setBulkAction("delete")}
                >
                  <Trash2 size={14} /> Delete
                </Button>
                <Button variant="ghost" className="!px-3 !py-1.5 text-xs" onClick={() => setSelectedIds(new Set())}>
                  Clear
                </Button>
              </div>
            </div>
          )}

          {usersQuery.isLoading ? (
            <UsersTableSkeleton />
          ) : users.length === 0 ? (
            <div className="rounded-2xl border border-black/[0.06] bg-white py-4 dark:border-white/[0.08] dark:bg-[#17171a]">
              <EmptyState icon={UsersIcon} title="No users found" description="Try a different search or filter, or add a new user." />
            </div>
          ) : (
            <div className="rounded-2xl border border-black/[0.06] bg-white p-2 dark:border-white/[0.08] dark:bg-[#17171a]">
              <div className="flex items-center gap-2 px-2 py-1.5">
                <Checkbox checked={allOnPageSelected} onChange={toggleSelectAllOnPage} />
                <span className="text-xs text-[var(--ink-muted)]">Select all on this page</span>
              </div>
              <DataTable<AdminUser>
                columns={columns}
                rows={users}
                rowKey={(u) => u.id}
                isLoading={false}
                onRowClick={viewUser}
              />
            </div>
          )}

          {total > 0 && (
            <div className="flex items-center justify-between text-sm text-[var(--ink-muted)]">
              <p>
                Showing {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, total)} of {total}
              </p>
              <div className="flex gap-2">
                <Button variant="secondary" className="!px-3 !py-1 text-xs" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
                  Previous
                </Button>
                <span className="self-center">
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
        </div>
      )}

      <CreateUserModal isOpen={isCreateOpen} onClose={() => setCreateOpen(false)} />
      <BulkImportUsersModal
        isOpen={isBulkImportOpen}
        onClose={() => setBulkImportOpen(false)}
        onImported={() => queryClient.invalidateQueries({ queryKey: ["admin", "users"] })}
      />
      <UserProfileDrawer userId={drawerUserId} onClose={() => setDrawerUserId(null)} />

      <ConfirmDialog
        isOpen={!!bulkAction}
        title={
          bulkAction === "activate"
            ? "Activate selected users"
            : bulkAction === "deactivate"
              ? "Deactivate selected users"
              : "Permanently delete selected users"
        }
        message={
          bulkAction === "activate"
            ? `Activate ${selectedIds.size} user(s)? They'll be able to sign in again.`
            : bulkAction === "deactivate"
              ? `Deactivate ${selectedIds.size} user(s)? They won't be able to sign in until reactivated.`
              : `This will permanently remove ${selectedIds.size} user(s) and all their associated records. This cannot be undone.`
        }
        confirmLabel={bulkAction === "activate" ? "Activate" : bulkAction === "deactivate" ? "Deactivate" : "Delete permanently"}
        isLoading={bulkMutation.isPending}
        onConfirm={() => bulkAction && bulkMutation.mutate(bulkAction)}
        onCancel={() => setBulkAction(null)}
      />
    </div>
  );
}
