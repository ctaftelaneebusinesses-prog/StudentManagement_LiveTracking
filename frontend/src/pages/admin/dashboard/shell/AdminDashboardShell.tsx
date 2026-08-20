import { ReactNode, useEffect, useState } from "react";
import { useLocation } from "react-router-dom";
import { SchoolProvider } from "@/context/SchoolContext";
import { useAuth } from "@/hooks/useAuth";
import { AdminSidebar } from "./AdminSidebar";
import { SuperAdminMergedSidebar } from "./SuperAdminMergedSidebar";
import { AdminTopbar } from "./AdminTopbar";

/**
 * Shared shell for both the School Console (school_admin/principal/
 * super_admin) and, for a super_admin specifically, the Platform Console
 * too — one persistent sidebar/topbar/SchoolProvider instance covers both,
 * so switching between them (via SuperAdminMergedSidebar's mode toggle)
 * never unmounts this component. See SuperAdminMergedSidebar's own comment
 * for why that matters.
 */
export function AdminDashboardShell({ children }: { children: ReactNode }) {
  const { hasRole } = useAuth();
  const [isCollapsed, setCollapsed] = useState(false);
  const [isMobileOpen, setMobileOpen] = useState(false);
  const { pathname } = useLocation();
  const Sidebar = hasRole("super_admin") ? SuperAdminMergedSidebar : AdminSidebar;

  // Belt-and-suspenders: close the mobile drawer whenever the route changes,
  // not just when a nav link's onClick fires — so the drawer never lingers
  // open over the newly-opened page on mobile.
  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  return (
    <SchoolProvider>
      <div className="flex h-screen bg-[var(--page-plane)] print:block print:h-auto">
        <Sidebar
          isCollapsed={isCollapsed}
          onToggleCollapse={() => setCollapsed((v) => !v)}
          isMobileOpen={isMobileOpen}
          onCloseMobile={() => setMobileOpen(false)}
        />
        <div className="flex min-w-0 flex-1 flex-col print:block">
          <AdminTopbar onOpenMobileMenu={() => setMobileOpen(true)} />
          <main className="flex-1 overflow-y-auto p-4 sm:p-6 print:overflow-visible print:p-0">{children}</main>
        </div>
      </div>
    </SchoolProvider>
  );
}
