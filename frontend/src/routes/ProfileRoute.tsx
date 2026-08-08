import { useAuth } from "@/hooks/useAuth";
import { DashboardShell } from "@/layouts/DashboardLayout";
import { AdminDashboardShell } from "@/pages/admin/dashboard/shell/AdminDashboardShell";
import { ProfilePage } from "@/pages/profile/ProfilePage";

/**
 * `/dashboard/profile` is reachable by every role, but school_admin/
 * super_admin/principal use the premium AdminDashboardShell everywhere else
 * while every other role uses the generic DashboardShell — a single Route
 * can only pick one ancestor layout, so instead of nesting this path under
 * both (which would leave one role's copy dead — React Router resolves a
 * duplicate path to exactly one branch, not per-role) this component picks
 * the matching shell itself at render time, keeping the path registered
 * exactly once in AppRoutes.
 */
export function ProfileRoute() {
  const { roleNames } = useAuth();
  const isAdminConsole =
    roleNames.includes("school_admin") || roleNames.includes("super_admin") || roleNames.includes("principal");

  if (isAdminConsole) {
    return (
      <AdminDashboardShell>
        <ProfilePage />
      </AdminDashboardShell>
    );
  }

  return (
    <DashboardShell>
      <ProfilePage />
    </DashboardShell>
  );
}
