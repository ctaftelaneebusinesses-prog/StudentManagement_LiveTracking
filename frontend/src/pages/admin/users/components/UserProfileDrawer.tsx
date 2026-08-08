import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CheckCircle2, CircleDashed, KeyRound, Mail, Phone, CalendarDays, Plus, X, Pencil, Check } from "lucide-react";
import { Drawer } from "@/components/ui/Drawer";
import { Button } from "@/components/ui/Button";
import { Select } from "@/components/ui/Select";
import { Input } from "@/components/ui/Input";
import { Skeleton } from "@/components/ui/Skeleton";
import * as usersService from "@/services/admin/users.service";
import { RoleName } from "@/types/auth.types";
import { ROLE_LABEL, ROLE_ID } from "@/utils/roles";
import { RoleBadge } from "./RoleBadge";
import { ResetPasswordModal } from "./ResetPasswordModal";
import { getApiErrorMessage } from "@/lib/axios";
import { useAuth } from "@/hooks/useAuth";

const ADMIN_TIER_ROLES: RoleName[] = ["principal", "school_admin"];

function initials(name: string): string {
  return (
    name
      .split(" ")
      .filter(Boolean)
      .slice(0, 2)
      .map((w) => w[0]?.toUpperCase())
      .join("") || "?"
  );
}

// super_admin is excluded — it's the same admin tier as school_admin (see
// migrations/027_equalize_admin_roles.sql) and is only ever granted directly
// at the database level for the multi-school override, not through this
// generic role-assignment UI.
const ALL_ROLE_NAMES: RoleName[] = [
  "school_admin",
  "principal",
  "teacher",
  "student",
  "driver",
  "support_staff",
  "accountant",
];

/**
 * Takes just the id (not a snapshot of the row object) and fetches its own
 * live copy — every mutation below invalidates the `["admin","users"]`
 * prefix, which react-query matches against this drawer's own
 * `["admin","users",userId]` query too, so status/role changes made *from
 * inside the drawer* are reflected immediately instead of the button/badge
 * staying stuck on stale data until the drawer is closed and reopened.
 */
export function UserProfileDrawer({ userId, onClose }: { userId: string | null; onClose: () => void }) {
  const queryClient = useQueryClient();
  const { hasRole } = useAuth();
  // Principal Management restriction: a principal-only actor cannot activate/
  // deactivate, reset the password of, or add/remove admin-tier roles on a
  // user who already holds an admin-tier role — only a School Admin can
  // manage those accounts. Backend enforces this too (utils/userAccess.ts);
  // this is UI-side so the actor sees a disabled control, not a 403 toast.
  const isPrincipalActor = hasRole("principal") && !hasRole("school_admin") && !hasRole("super_admin");
  const [addRoleId, setAddRoleId] = useState("");
  const [isResettingPassword, setResettingPassword] = useState(false);
  const [isEditingDesignation, setEditingDesignation] = useState(false);
  const [designationDraft, setDesignationDraft] = useState("");

  const userQuery = useQuery({
    queryKey: ["admin", "users", userId],
    queryFn: () => usersService.fetchUser(userId!),
    enabled: !!userId,
  });
  const user = userQuery.data;

  const rolesQuery = useQuery({
    queryKey: ["admin", "users", userId, "roles"],
    queryFn: () => usersService.fetchUserRoles(userId!),
    enabled: !!userId,
  });

  function invalidate() {
    queryClient.invalidateQueries({ queryKey: ["admin", "users"] });
  }

  const toggleStatusMutation = useMutation({
    mutationFn: async () => {
      if (user!.is_active) await usersService.deactivateUser(user!.id);
      else await usersService.activateUser(user!.id);
    },
    onSuccess: invalidate,
  });

  const assignRoleMutation = useMutation({
    mutationFn: (roleId: number) => usersService.assignRole(user!.id, roleId),
    onSuccess: () => {
      invalidate();
      setAddRoleId("");
    },
  });

  const revokeRoleMutation = useMutation({
    mutationFn: (roleId: number) => usersService.revokeRole(user!.id, roleId),
    onSuccess: invalidate,
  });

  const updateDesignationMutation = useMutation({
    mutationFn: (designation: string) => usersService.updateUser(user!.id, { designation }),
    onSuccess: () => {
      invalidate();
      setEditingDesignation(false);
    },
  });

  const targetIsAdminTier = (rolesQuery.data ?? []).some((r) => ADMIN_TIER_ROLES.includes(r.roles.name as RoleName));
  const restrictActions = isPrincipalActor && targetIsAdminTier;

  const heldRoleIds = new Set((rolesQuery.data ?? []).map((r) => r.role_id));
  const roleOptions = ALL_ROLE_NAMES.filter((name) => !heldRoleIds.has(ROLE_ID[name]))
    .filter((name) => !isPrincipalActor || !ADMIN_TIER_ROLES.includes(name))
    .map((name) => ({
      value: String(ROLE_ID[name]),
      label: ROLE_LABEL[name],
    }));

  const mutationError =
    toggleStatusMutation.error ?? assignRoleMutation.error ?? revokeRoleMutation.error ?? updateDesignationMutation.error;

  return (
    <>
      <Drawer isOpen={!!userId} onClose={onClose} title="User profile" width="lg">
        {userQuery.isLoading || !user ? (
          <div className="space-y-6">
            <div className="flex items-center gap-4">
              <Skeleton className="h-14 w-14 rounded-full" />
              <div className="space-y-2">
                <Skeleton className="h-4 w-40" />
                <Skeleton className="h-5 w-24" />
              </div>
            </div>
            <Skeleton className="h-24 w-full rounded-2xl" />
            <Skeleton className="h-10 w-56" />
          </div>
        ) : (
          <div className="space-y-6">
            <div className="flex items-center gap-4">
              <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-accent-500/10 text-lg font-semibold text-accent-600 dark:text-accent-400">
                {initials(user.full_name)}
              </span>
              <div>
                <p className="text-base font-semibold text-[var(--ink-primary)]">{user.full_name}</p>
                <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                  <RoleBadge role={user.roles.name} />
                  {user.is_active ? (
                    <span className="inline-flex items-center rounded-full bg-[var(--status-good)]/10 px-2.5 py-1 text-xs font-semibold text-[var(--status-good)]">
                      Active
                    </span>
                  ) : (
                    <span className="inline-flex items-center rounded-full bg-[var(--status-serious)]/10 px-2.5 py-1 text-xs font-semibold text-[var(--status-serious)]">
                      Inactive
                    </span>
                  )}
                </div>
              </div>
            </div>

            <div className="space-y-2.5 rounded-2xl border border-black/[0.06] p-4 dark:border-white/[0.08]">
              <div className="flex items-center gap-2 text-sm text-[var(--ink-secondary)]">
                <Mail size={14} className="shrink-0 text-[var(--ink-muted)]" />
                {user.email}
              </div>
              {user.phone && (
                <div className="flex items-center gap-2 text-sm text-[var(--ink-secondary)]">
                  <Phone size={14} className="shrink-0 text-[var(--ink-muted)]" />
                  {user.phone}
                </div>
              )}
              <div className="flex items-center gap-2 text-sm text-[var(--ink-secondary)]">
                <CalendarDays size={14} className="shrink-0 text-[var(--ink-muted)]" />
                Joined {new Date(user.created_at).toLocaleDateString()}
              </div>

              {(user.roles.name === "support_staff" || user.designation) && (
                <div className="flex items-center gap-2 pt-0.5">
                  {isEditingDesignation ? (
                    <>
                      <div className="flex-1">
                        <Input
                          label="Designation"
                          value={designationDraft}
                          onChange={(e) => setDesignationDraft(e.target.value)}
                          placeholder="e.g. Cleaner, Ayya, Peon"
                        />
                      </div>
                      <Button
                        variant="ghost"
                        className="!px-2 !py-1.5"
                        isLoading={updateDesignationMutation.isPending}
                        onClick={() => updateDesignationMutation.mutate(designationDraft)}
                        aria-label="Save designation"
                      >
                        <Check size={14} />
                      </Button>
                    </>
                  ) : (
                    <>
                      <span className="text-sm text-[var(--ink-secondary)]">
                        {user.designation ?? <span className="italic text-[var(--ink-muted)]">No designation set</span>}
                      </span>
                      <button
                        type="button"
                        onClick={() => {
                          setDesignationDraft(user.designation ?? "");
                          setEditingDesignation(true);
                        }}
                        className="rounded-full p-1 text-[var(--ink-muted)] transition-colors hover:bg-black/[0.06] dark:hover:bg-white/[0.08]"
                        aria-label="Edit designation"
                      >
                        <Pencil size={12} />
                      </button>
                    </>
                  )}
                </div>
              )}
            </div>

            <div className="flex flex-wrap gap-2">
              {user.is_active ? (
                <Button
                  variant="secondary"
                  onClick={() => toggleStatusMutation.mutate()}
                  isLoading={toggleStatusMutation.isPending}
                  disabled={restrictActions}
                  title={restrictActions ? "Only a School Admin can manage this account" : undefined}
                >
                  <CircleDashed size={16} /> Deactivate
                </Button>
              ) : (
                <Button
                  onClick={() => toggleStatusMutation.mutate()}
                  isLoading={toggleStatusMutation.isPending}
                  disabled={restrictActions}
                  title={restrictActions ? "Only a School Admin can manage this account" : undefined}
                >
                  <CheckCircle2 size={16} /> Activate
                </Button>
              )}
              <Button
                variant="secondary"
                onClick={() => setResettingPassword(true)}
                disabled={restrictActions}
                title={restrictActions ? "Only a School Admin can manage this account" : undefined}
              >
                <KeyRound size={16} /> Reset password
              </Button>
            </div>

            <div>
              <h3 className="text-sm font-semibold text-[var(--ink-primary)]">Roles</h3>
              <p className="mt-1 text-xs text-[var(--ink-muted)]">
                A person can hold more than one role — e.g. a teacher who is also a parent.
              </p>

              <div className="mt-3 flex flex-wrap gap-2">
                {(rolesQuery.data ?? [])
                  .filter((r) => r.roles.name !== "super_admin")
                  .map((r) => {
                    const roleIsAdminTier = ADMIN_TIER_ROLES.includes(r.roles.name as RoleName);
                    const canRemove = !(isPrincipalActor && roleIsAdminTier);
                    return (
                      <span
                        key={r.role_id}
                        className="inline-flex items-center gap-1.5 rounded-full bg-black/[0.04] py-1 pl-3 pr-1.5 text-xs font-medium text-[var(--ink-secondary)] dark:bg-white/[0.06]"
                      >
                        {ROLE_LABEL[r.roles.name as RoleName] ?? r.roles.name}
                        {canRemove && (
                          <button
                            type="button"
                            onClick={() => revokeRoleMutation.mutate(r.role_id)}
                            disabled={(rolesQuery.data?.length ?? 0) <= 1 || revokeRoleMutation.isPending}
                            className="rounded-full p-0.5 transition-colors hover:bg-black/[0.08] disabled:cursor-not-allowed disabled:opacity-40 dark:hover:bg-white/[0.1]"
                            aria-label={`Remove ${r.roles.name} role`}
                          >
                            <X size={12} />
                          </button>
                        )}
                      </span>
                    );
                  })}
              </div>

              {roleOptions.length > 0 && (
                <div className="mt-3 flex items-end gap-2">
                  <div className="flex-1">
                    <Select
                      label="Add a role"
                      placeholder="Select role"
                      options={roleOptions}
                      value={addRoleId}
                      onChange={(e) => setAddRoleId(e.target.value)}
                    />
                  </div>
                  <Button
                    variant="secondary"
                    disabled={!addRoleId}
                    isLoading={assignRoleMutation.isPending}
                    onClick={() => addRoleId && assignRoleMutation.mutate(Number(addRoleId))}
                  >
                    <Plus size={16} /> Add
                  </Button>
                </div>
              )}

              {mutationError && (
                <p className="mt-2 text-sm text-red-600">{getApiErrorMessage(mutationError, "Something went wrong.")}</p>
              )}
            </div>
          </div>
        )}
      </Drawer>

      <ResetPasswordModal user={isResettingPassword ? (user ?? null) : null} onClose={() => setResettingPassword(false)} />
    </>
  );
}
