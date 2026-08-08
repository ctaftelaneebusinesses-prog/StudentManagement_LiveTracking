import { Outlet } from "react-router-dom";
import { AdminDashboardShell } from "@/pages/admin/dashboard/shell/AdminDashboardShell";

/** Shell (sidebar + topbar + school context) shared by every page in the premium Admin Console area. */
export function AdminLayout() {
  return (
    <AdminDashboardShell>
      <Outlet />
    </AdminDashboardShell>
  );
}
