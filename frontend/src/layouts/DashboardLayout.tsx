import { ReactNode, useState } from "react";
import { Outlet } from "react-router-dom";
import { SchoolProvider } from "@/context/SchoolContext";
import { Sidebar } from "./components/Sidebar";
import { Navbar } from "./components/Navbar";

/** Sidebar + navbar chrome, usable either as a Route layout (via DashboardLayout) or wrapped directly around a single page (see ProfileRoute). */
export function DashboardShell({ children }: { children: ReactNode }) {
  const [isMobileNavOpen, setMobileNavOpen] = useState(false);
  const [isCollapsed, setCollapsed] = useState(false);

  return (
    <SchoolProvider>
      <div className="flex h-screen bg-[var(--page-plane)] dark:bg-[#101012]">
        <Sidebar
          isCollapsed={isCollapsed}
          onToggleCollapse={() => setCollapsed((v) => !v)}
          isMobileOpen={isMobileNavOpen}
          onCloseMobile={() => setMobileNavOpen(false)}
        />
        <div className="flex min-w-0 flex-1 flex-col">
          <Navbar onOpenMobileMenu={() => setMobileNavOpen(true)} />
          <main className="flex-1 overflow-y-auto p-4 sm:p-6">{children}</main>
        </div>
      </div>
    </SchoolProvider>
  );
}

/** Shared shell for every authenticated portal — sidebar + navbar + routed content. */
export function DashboardLayout() {
  return (
    <DashboardShell>
      <Outlet />
    </DashboardShell>
  );
}
