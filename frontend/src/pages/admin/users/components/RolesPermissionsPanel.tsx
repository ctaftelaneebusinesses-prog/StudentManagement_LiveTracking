import { Fragment, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Check, ShieldCheck } from "lucide-react";
import * as usersService from "@/services/admin/users.service";
import { ROLE_LABEL } from "@/utils/roles";
import { RoleName } from "@/types/auth.types";
import { UsersTableSkeleton } from "./UsersSkeleton";
import { ErrorState } from "@/pages/admin/dashboard/components/states/ErrorState";
import { EmptyState } from "@/components/ui/EmptyState";

function titleCase(word: string): string {
  return word.charAt(0).toUpperCase() + word.slice(1).replace(/_/g, " ");
}

export function RolesPermissionsPanel() {
  const rolesQuery = useQuery({ queryKey: ["admin", "roles"], queryFn: usersService.fetchRoles });
  const permissionsQuery = useQuery({ queryKey: ["admin", "permissions"], queryFn: usersService.fetchPermissions });
  const matrixQuery = useQuery({ queryKey: ["admin", "role-permissions"], queryFn: usersService.fetchRolePermissionMatrix });

  const isLoading = rolesQuery.isLoading || permissionsQuery.isLoading || matrixQuery.isLoading;
  const isError = rolesQuery.isError || permissionsQuery.isError || matrixQuery.isError;

  const grouped = useMemo(() => {
    const permissions = permissionsQuery.data ?? [];
    const groups = new Map<string, typeof permissions>();
    for (const perm of permissions) {
      const category = perm.code.split(".")[0];
      if (!groups.has(category)) groups.set(category, []);
      groups.get(category)!.push(perm);
    }
    return Array.from(groups.entries()).sort(([a], [b]) => a.localeCompare(b));
  }, [permissionsQuery.data]);

  const grantSet = useMemo(() => {
    const set = new Set<string>();
    for (const pair of matrixQuery.data ?? []) set.add(`${pair.role_id}:${pair.permission_id}`);
    return set;
  }, [matrixQuery.data]);

  if (isLoading) {
    return (
      <div className="animate-fade-in space-y-4">
        <UsersTableSkeleton />
      </div>
    );
  }

  if (isError) {
    return (
      <ErrorState
        message="Couldn't load roles and permissions."
        onRetry={() => {
          rolesQuery.refetch();
          permissionsQuery.refetch();
          matrixQuery.refetch();
        }}
      />
    );
  }

  // super_admin is the same admin tier as school_admin (identical permissions,
  // see migrations/027_equalize_admin_roles.sql) — it's an internal alias used
  // only for the multi-school override plumbing, not a distinct role from the
  // admin's point of view, so it's hidden here rather than shown as a second,
  // identical-looking column.
  const roles = (rolesQuery.data ?? []).filter((role) => role.name !== "super_admin");

  if (roles.length === 0 || grouped.length === 0) {
    return (
      <div className="rounded-2xl border border-black/[0.06] bg-white py-4 dark:border-white/[0.08] dark:bg-[#17171a]">
        <EmptyState icon={ShieldCheck} title="No roles or permissions found" />
      </div>
    );
  }

  return (
    <div className="animate-fade-in space-y-4">
      <div>
        <h2 className="text-sm font-semibold text-[var(--ink-primary)]">Roles &amp; permissions</h2>
        <p className="mt-1 text-xs text-[var(--ink-muted)]">
          A read-only view of what each role can do. To change a person's role, use their profile in the Directory.
        </p>
      </div>

      <div className="overflow-x-auto rounded-2xl border border-black/[0.06] bg-white dark:border-white/[0.08] dark:bg-[#17171a]">
        <table className="min-w-full text-sm">
          <thead>
            <tr className="border-b border-black/[0.06] dark:border-white/[0.08]">
              <th className="sticky left-0 bg-white px-4 py-3 text-left font-medium text-[var(--ink-muted)] dark:bg-[#17171a]">
                Permission
              </th>
              {roles.map((role) => (
                <th key={role.id} className="whitespace-nowrap px-4 py-3 text-center font-medium text-[var(--ink-muted)]">
                  {ROLE_LABEL[role.name as RoleName] ?? role.name}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {grouped.map(([category, permissions]) => (
              <Fragment key={category}>
                <tr className="bg-black/[0.02] dark:bg-white/[0.03]">
                  <td
                    colSpan={roles.length + 1}
                    className="px-4 py-1.5 text-xs font-semibold uppercase tracking-wide text-[var(--ink-muted)]"
                  >
                    {titleCase(category)}
                  </td>
                </tr>
                {permissions.map((perm) => (
                  <tr key={perm.id} className="border-b border-black/[0.04] last:border-0 dark:border-white/[0.05]">
                    <td className="px-4 py-2.5 text-[var(--ink-secondary)]">{perm.description}</td>
                    {roles.map((role) => (
                      <td key={role.id} className="px-4 py-2.5 text-center">
                        {grantSet.has(`${role.id}:${perm.id}`) ? (
                          <Check size={15} className="mx-auto text-[var(--status-good)]" strokeWidth={2.5} />
                        ) : (
                          <span className="mx-auto block h-1 w-1 rounded-full bg-black/[0.1] dark:bg-white/[0.15]" />
                        )}
                      </td>
                    ))}
                  </tr>
                ))}
              </Fragment>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
