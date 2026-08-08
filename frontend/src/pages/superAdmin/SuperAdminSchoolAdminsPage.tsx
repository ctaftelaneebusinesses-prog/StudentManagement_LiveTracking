import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Building2,
  KeyRound,
  Pencil,
  Plus,
  Power,
  Search,
  ShieldCheck,
  UserCheck,
} from "lucide-react";
import * as superAdminService from "@/services/superAdmin.service";
import { SchoolAdmin } from "@/types/superAdmin.types";
import { Button } from "@/components/ui/Button";
import { Avatar } from "@/components/ui/Avatar";
import { EmptyState } from "@/components/ui/EmptyState";
import { Skeleton } from "@/components/ui/Skeleton";
import { useToast } from "@/components/ui/Toast";
import { PageHeader, StatusPill } from "./components/PageHeader";
import { ImpactDialog } from "./components/ImpactDialog";
import { SchoolAdminFormModal } from "./components/SchoolAdminFormModal";
import { ResetPasswordModal } from "./components/ResetPasswordModal";

type StatusFilter = "all" | "active" | "inactive";

/** §5, §7, §10, §12 — School Admin lifecycle, assignments and cascade control. */
export function SuperAdminSchoolAdminsPage() {
  const toast = useToast();
  const queryClient = useQueryClient();

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [formTarget, setFormTarget] = useState<{ admin: SchoolAdmin | null } | null>(null);
  const [resetTarget, setResetTarget] = useState<SchoolAdmin | null>(null);
  const [powerTarget, setPowerTarget] = useState<{ admin: SchoolAdmin; activate: boolean } | null>(null);

  const adminsQuery = useQuery({
    queryKey: ["super-admin", "school-admins", search, statusFilter],
    queryFn: () =>
      superAdminService.listSchoolAdmins({
        search: search.trim() || undefined,
        status: statusFilter === "all" ? undefined : statusFilter,
      }),
  });

  // The deactivation dialog's numbers come from the server, never from the
  // row — an assignment could have changed since the list was fetched.
  const impactQuery = useQuery({
    queryKey: ["super-admin", "school-admin-impact", powerTarget?.admin.id],
    queryFn: () => superAdminService.previewSchoolAdminImpact(powerTarget!.admin.id),
    enabled: Boolean(powerTarget) && powerTarget?.activate === false,
  });

  /**
   * Activate and deactivate return different shapes (what was restored vs what
   * was switched off), so the mutation result is a discriminated union keyed
   * on the same `activate` flag the caller passed in.
   */
  type PowerResult =
    | { activate: true; data: Awaited<ReturnType<typeof superAdminService.activateSchoolAdmin>> }
    | { activate: false; data: Awaited<ReturnType<typeof superAdminService.deactivateSchoolAdmin>> };

  const powerMutation = useMutation<PowerResult, Error, { admin: SchoolAdmin; activate: boolean }>({
    mutationFn: async ({ admin, activate }) =>
      activate
        ? { activate: true, data: await superAdminService.activateSchoolAdmin(admin.id) }
        : { activate: false, data: await superAdminService.deactivateSchoolAdmin(admin.id) },
    onSuccess: (result, variables) => {
      if (result.activate) {
        const skipped = result.data.skippedSchools ?? [];
        toast.success(
          `${variables.admin.full_name} reactivated — ${result.data.schoolsReactivated.length} school(s) and ${result.data.usersAffected} account(s) restored.` +
            (skipped.length > 0
              ? ` ${skipped.length} school(s) stayed inactive because they were deactivated separately.`
              : "")
        );
      } else {
        toast.success(
          `${variables.admin.full_name} deactivated — ${result.data.schoolsDeactivated.length} school(s) and ${result.data.usersAffected} account(s) lost access. No data was deleted.`
        );
      }
      setPowerTarget(null);
      queryClient.invalidateQueries({ queryKey: ["super-admin"] });
    },
    onError: (err: Error) => {
      const message =
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ??
        err.message ??
        "Couldn't update the School Admin";
      toast.error(message);
    },
  });

  const admins = adminsQuery.data ?? [];

  return (
    <div>
      <PageHeader
        title="School Admins"
        subtitle={`${admins.length} account${admins.length === 1 ? "" : "s"} managing schools on this platform`}
        actions={
          <Button onClick={() => setFormTarget({ admin: null })}>
            <Plus size={15} strokeWidth={2.2} />
            Add School Admin
          </Button>
        }
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
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name, email or mobile…"
            className="w-full rounded-xl border border-black/[0.08] bg-white py-2 pl-9 pr-3 text-sm text-[var(--ink-primary)] placeholder:text-[var(--ink-muted)] focus:border-accent-400 focus:outline-none focus:ring-2 focus:ring-accent-500/20 dark:border-white/[0.1] dark:bg-[#17171a]"
          />
        </div>

        <div className="flex rounded-xl border border-black/[0.08] bg-white p-0.5 dark:border-white/[0.1] dark:bg-[#17171a]">
          {(["all", "active", "inactive"] as StatusFilter[]).map((value) => (
            <button
              key={value}
              type="button"
              onClick={() => setStatusFilter(value)}
              className={`rounded-lg px-3 py-1.5 text-xs font-medium capitalize transition-colors ${
                statusFilter === value
                  ? "bg-accent-500/10 text-accent-600 dark:text-accent-300"
                  : "text-[var(--ink-muted)] hover:text-[var(--ink-primary)]"
              }`}
            >
              {value}
            </button>
          ))}
        </div>
      </div>

      {adminsQuery.isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-[124px] rounded-2xl" />
          ))}
        </div>
      ) : admins.length === 0 ? (
        <div className="rounded-2xl border border-black/[0.06] bg-white py-8 dark:border-white/[0.08] dark:bg-[#17171a]">
          <EmptyState
            icon={ShieldCheck}
            title={search || statusFilter !== "all" ? "No School Admins match your filters" : "No School Admins yet"}
            description={
              search || statusFilter !== "all"
                ? "Try a different search term or status."
                : "Add a School Admin and assign them one or more schools to manage."
            }
          />
        </div>
      ) : (
        <div className="space-y-3">
          {admins.map((admin, i) => (
            <AdminRow
              key={admin.id}
              admin={admin}
              index={i}
              onEdit={() => setFormTarget({ admin })}
              onResetPassword={() => setResetTarget(admin)}
              onTogglePower={() => setPowerTarget({ admin, activate: !admin.is_active })}
            />
          ))}
        </div>
      )}

      <SchoolAdminFormModal
        isOpen={Boolean(formTarget)}
        admin={formTarget?.admin}
        onClose={() => setFormTarget(null)}
      />

      <ResetPasswordModal admin={resetTarget} onClose={() => setResetTarget(null)} />

      <ImpactDialog
        isOpen={Boolean(powerTarget)}
        title={powerTarget?.activate ? "Reactivate this School Admin?" : "Deactivate this School Admin?"}
        message={
          powerTarget?.activate
            ? `${powerTarget.admin.full_name} will regain access. Schools that went inactive because of this admin's deactivation will be restored, along with the accounts inside them. Schools deactivated separately, and users suspended individually, stay as they are.`
            : `${powerTarget?.admin.full_name} manages ${powerTarget?.admin.schools.length ?? 0} school${
                (powerTarget?.admin.schools.length ?? 0) === 1 ? "" : "s"
              }. Deactivating this account will also deactivate access to all assigned schools and their users.`
        }
        schoolNames={
          powerTarget?.activate
            ? (powerTarget?.admin.schools ?? []).map((s) => s.name)
            : (impactQuery.data?.schools ?? powerTarget?.admin.schools ?? []).map((s) => s.name)
        }
        affectedSchools={
          powerTarget?.activate
            ? (powerTarget?.admin.schools ?? []).filter((s) => !s.is_active).length
            : (impactQuery.data?.affectedSchools ?? 0)
        }
        affectedUsers={powerTarget?.activate ? 0 : (impactQuery.data?.affectedUsers ?? 0)}
        confirmLabel={powerTarget?.activate ? "Reactivate" : "Deactivate"}
        intent={powerTarget?.activate ? "primary" : "danger"}
        isPreviewLoading={powerTarget?.activate ? false : impactQuery.isLoading}
        isLoading={powerMutation.isPending}
        onConfirm={() => powerTarget && powerMutation.mutate(powerTarget)}
        onCancel={() => setPowerTarget(null)}
      />
    </div>
  );
}

function AdminRow({
  admin,
  index,
  onEdit,
  onResetPassword,
  onTogglePower,
}: {
  admin: SchoolAdmin;
  index: number;
  onEdit: () => void;
  onResetPassword: () => void;
  onTogglePower: () => void;
}) {
  return (
    <div
      style={{ animationDelay: `${index * 40}ms` }}
      className={`animate-slide-up rounded-2xl border border-black/[0.06] bg-white p-4 shadow-sm transition-all duration-200
        hover:border-accent-200 hover:shadow-card-hover dark:border-white/[0.08] dark:bg-[#17171a] dark:hover:border-accent-800
        ${admin.is_active ? "" : "opacity-[0.86]"}`}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex min-w-0 flex-1 items-start gap-3">
          <Avatar src={admin.avatar_url} name={admin.full_name} size="sm" />
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <p className="truncate text-sm font-semibold text-[var(--ink-primary)]">{admin.full_name}</p>
              <StatusPill isActive={admin.is_active} />
            </div>
            <p className="mt-0.5 truncate text-xs text-[var(--ink-muted)]">
              {admin.email}
              {admin.phone ? ` · ${admin.phone}` : ""}
              {admin.designation ? ` · ${admin.designation}` : ""}
            </p>
          </div>
        </div>

        <div className="flex shrink-0 flex-wrap items-center gap-1">
          <IconAction icon={Pencil} label="Edit" onClick={onEdit} />
          <IconAction icon={KeyRound} label="Reset password" onClick={onResetPassword} />
          <button
            type="button"
            onClick={onTogglePower}
            className={`inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium transition-colors ${
              admin.is_active
                ? "text-rose-600 hover:bg-rose-500/10 dark:text-rose-400"
                : "text-emerald-600 hover:bg-emerald-500/10 dark:text-emerald-400"
            }`}
          >
            <Power size={14} strokeWidth={2} />
            {admin.is_active ? "Deactivate" : "Reactivate"}
          </button>
        </div>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-1.5 border-t border-black/[0.05] pt-3 dark:border-white/[0.06]">
        <span className="mr-1 inline-flex items-center gap-1 text-[11px] font-semibold uppercase tracking-wider text-[var(--ink-muted)]">
          <Building2 size={12} strokeWidth={2} />
          Assigned
        </span>
        {admin.schools.length === 0 ? (
          <span className="text-xs text-[var(--ink-muted)]">No schools assigned</span>
        ) : (
          admin.schools.map((school) => (
            <span
              key={school.id}
              title={school.is_active ? school.name : `${school.name} — inactive`}
              className={`inline-flex max-w-[190px] items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ${
                school.is_active
                  ? "bg-accent-500/10 text-accent-700 dark:text-accent-300"
                  : "bg-rose-500/10 text-rose-600 dark:text-rose-400"
              }`}
            >
              <span className="truncate">{school.name}</span>
            </span>
          ))
        )}
        <span className="ml-auto inline-flex items-center gap-1 text-[11px] text-[var(--ink-muted)]">
          <UserCheck size={12} strokeWidth={2} />
          {admin.schools.length} school{admin.schools.length === 1 ? "" : "s"}
        </span>
      </div>
    </div>
  );
}

function IconAction({
  icon: Icon,
  label,
  onClick,
}: {
  icon: typeof Pencil;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={label}
      aria-label={label}
      className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium text-[var(--ink-secondary)] transition-colors hover:bg-black/[0.05] hover:text-[var(--ink-primary)] dark:hover:bg-white/[0.07]"
    >
      <Icon size={14} strokeWidth={2} />
      <span className="hidden sm:inline">{label}</span>
    </button>
  );
}
