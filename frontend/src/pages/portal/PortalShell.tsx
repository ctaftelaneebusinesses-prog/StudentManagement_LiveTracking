import { useState } from "react";
import { Outlet, useLocation } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";
import { SchoolProvider } from "@/context/SchoolContext";
import { PortalStudentProvider, usePortalStudentId } from "@/context/PortalStudentContext";
import { PortalThemeProvider } from "@/context/PortalThemeContext";
import { PortalSidebar } from "./components/ui/PortalSidebar";
import { PortalNavbar } from "./components/ui/PortalNavbar";
import { pageTransition } from "./components/ui/portalMotion";

/**
 * Full-page shell for the Student Portal — brings its own sidebar/navbar
 * (PortalSidebar/PortalNavbar) instead of the shared DashboardLayout, the
 * same way AdminLayout brings its own shell for the Admin Console (see
 * AppRoutes.tsx). Mounted directly under ProtectedRoute, NOT inside
 * DashboardLayout, so teacher/driver/admin chrome is completely unaffected.
 * Also resolves the gender theme (PortalThemeProvider) for every route
 * nested below, including StudentLeavePage which lives in this same tree.
 */
export function PortalShell() {
  return (
    <SchoolProvider>
      <PortalStudentProvider>
        <PortalThemeProvider>
          <PortalShellChrome />
        </PortalThemeProvider>
      </PortalStudentProvider>
    </SchoolProvider>
  );
}

function PortalShellChrome() {
  const [isMobileNavOpen, setMobileNavOpen] = useState(false);
  const [isCollapsed, setCollapsed] = useState(false);
  const location = useLocation();

  return (
    <div className="flex h-screen bg-[var(--page-plane)] dark:bg-[#101012]">
      <PortalSidebar
        isCollapsed={isCollapsed}
        onToggleCollapse={() => setCollapsed((v) => !v)}
        isMobileOpen={isMobileNavOpen}
        onCloseMobile={() => setMobileNavOpen(false)}
      />
      <div className="flex min-w-0 flex-1 flex-col">
        <PortalNavbar onOpenMobileMenu={() => setMobileNavOpen(true)} />
        <main className="flex-1 overflow-y-auto p-4 sm:p-6">
          <AnimatePresence mode="wait">
            <motion.div key={location.pathname} variants={pageTransition} initial="initial" animate="animate" exit="exit">
              <PortalShellContent />
            </motion.div>
          </AnimatePresence>
        </main>
      </div>
    </div>
  );
}

function PortalShellContent() {
  const studentId = usePortalStudentId();
  return <div className="space-y-6">{studentId && <Outlet />}</div>;
}
