import { NavLink, useLocation, useNavigate } from "react-router-dom";
import { Globe2, LayoutGrid, LogOut, PanelLeftClose, PanelLeftOpen, X } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useSchool } from "@/hooks/useSchool";
import { SchoolLogo } from "@/components/ui/SchoolLogo";
import { Avatar } from "@/components/ui/Avatar";
import { SUPER_ADMIN_NAV_GROUPS } from "@/pages/superAdmin/shell/navConfig";
import { ADMIN_NAV_GROUPS } from "./navConfig";
import { NavNotificationBadge } from "./NavNotificationBadge";

/**
 * The one persistent sidebar a super_admin sees for BOTH the Platform
 * Console (/dashboard/super-admin/*) and the School Console
 * (/dashboard/admin/*) — replacing what used to be two separate shells
 * (SuperAdminLayout + AdminLayout) mounted as sibling <Route> trees.
 *
 * That split was the actual bug behind "clicking School Console completely
 * changes the sidebar and there's no way back": each shell was its own
 * React Router layout route, so navigating between them unmounted one whole
 * component tree and mounted the other — different colors, different DOM,
 * and (since the Admin Console's own sidebar has no link back to the
 * Platform Console) no way back except the browser's back button.
 *
 * The fix is structural, not cosmetic: AdminLayout is now the SINGLE shared
 * parent for both route groups (see AppRoutes.tsx), so React Router keeps
 * this component mounted continuously across navigation between them — only
 * the page content in <Outlet/> changes. This component just renders
 * different nav items depending on which section the current URL is in,
 * via a two-way toggle at the top that never disappears.
 */

type Mode = "platform" | "school";

function useMode(): Mode {
  const { pathname } = useLocation();
  return pathname.startsWith("/dashboard/super-admin") ? "platform" : "school";
}

interface SuperAdminMergedSidebarProps {
  isCollapsed: boolean;
  onToggleCollapse: () => void;
  isMobileOpen: boolean;
  onCloseMobile: () => void;
}

function ModeToggle({ collapsed }: { collapsed: boolean }) {
  const mode = useMode();
  const navigate = useNavigate();

  const buttonClass = (active: boolean) =>
    `flex flex-1 items-center justify-center gap-1.5 rounded-lg py-1.5 text-xs font-medium transition-colors ${
      active ? "bg-white/10 text-white" : "text-slate-400 hover:text-white"
    }`;

  if (collapsed) {
    return (
      <div className="flex flex-col gap-1 px-2 pb-3">
        <button
          type="button"
          onClick={() => navigate("/dashboard/super-admin")}
          title="Platform"
          className={`flex items-center justify-center rounded-lg py-2 transition-colors ${
            mode === "platform" ? "bg-white/10 text-white" : "text-slate-400 hover:text-white"
          }`}
        >
          <Globe2 size={16} strokeWidth={1.9} />
        </button>
        <button
          type="button"
          onClick={() => navigate("/dashboard/admin/overview")}
          title="School Console"
          className={`flex items-center justify-center rounded-lg py-2 transition-colors ${
            mode === "school" ? "bg-white/10 text-white" : "text-slate-400 hover:text-white"
          }`}
        >
          <LayoutGrid size={16} strokeWidth={1.9} />
        </button>
      </div>
    );
  }

  return (
    <div className="mx-3 mb-3 flex gap-1 rounded-xl border border-white/10 bg-white/[0.03] p-1">
      <button type="button" onClick={() => navigate("/dashboard/super-admin")} className={buttonClass(mode === "platform")}>
        <Globe2 size={13} strokeWidth={2} />
        Platform
      </button>
      <button
        type="button"
        onClick={() => navigate("/dashboard/admin/overview")}
        className={buttonClass(mode === "school")}
      >
        <LayoutGrid size={13} strokeWidth={2} />
        School Console
      </button>
    </div>
  );
}

function Brand({ collapsed }: { collapsed: boolean }) {
  const mode = useMode();
  const { selectedSchool } = useSchool();

  return (
    <div className="flex h-16 shrink-0 items-center gap-2.5 px-4">
      {mode === "platform" ? (
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-sky-500/15 text-sky-300 ring-1 ring-inset ring-sky-400/25">
          <Globe2 size={18} strokeWidth={1.9} />
        </span>
      ) : (
        <SchoolLogo src={selectedSchool.logo_url} size="sm" />
      )}
      {!collapsed && (
        <div className="min-w-0">
          <p className="truncate text-[15px] font-semibold leading-tight text-white">
            {mode === "platform" ? "Platform Console" : selectedSchool.name || "School Console"}
          </p>
          <p className="truncate text-[11px] leading-tight text-slate-400">
            {mode === "platform" ? "Super Admin" : "School Console"}
          </p>
        </div>
      )}
    </div>
  );
}

function UserCard({ collapsed }: { collapsed: boolean }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  if (!user) return null;

  async function handleLogout() {
    await logout();
    navigate("/login", { replace: true });
  }

  return (
    <div className="shrink-0 border-t border-white/10 p-3">
      <div className={`flex items-center gap-2.5 rounded-lg p-1.5 ${collapsed ? "justify-center" : ""}`}>
        <Avatar src={user.avatar_url} name={user.full_name} size="sm" />
        {!collapsed && (
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium text-white">{user.full_name}</p>
            <p className="truncate text-xs text-sky-300/80">Super Admin</p>
          </div>
        )}
        <button
          type="button"
          onClick={handleLogout}
          aria-label="Log out"
          title="Log out"
          className="shrink-0 rounded-md p-1.5 text-slate-400 transition-colors hover:bg-white/10 hover:text-white"
        >
          <LogOut size={16} strokeWidth={1.85} />
        </button>
      </div>
    </div>
  );
}

function NavGroups({ collapsed, onNavigate }: { collapsed: boolean; onNavigate?: () => void }) {
  const mode = useMode();
  const { roleNames } = useAuth();

  const groups =
    mode === "platform"
      ? SUPER_ADMIN_NAV_GROUPS
      : ADMIN_NAV_GROUPS.map((group) => ({
          ...group,
          items: group.items.filter((item) => !item.roles || item.roles.some((r) => roleNames.includes(r))),
        })).filter((group) => group.items.length > 0);

  return (
    <nav className="sidebar-scroll flex-1 space-y-5 overflow-y-auto px-3 py-3">
      {groups.map((group) => (
        <div key={group.label}>
          {!collapsed && (
            <p className="mb-1.5 px-3 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
              {group.label}
            </p>
          )}
          <div className="space-y-0.5">
            {group.items.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.to === "/dashboard/super-admin"}
                onClick={onNavigate}
                title={collapsed ? item.label : undefined}
                className={({ isActive }) =>
                  `group relative flex items-center gap-2.5 rounded-lg py-2 text-sm font-medium
                  before:absolute before:-left-3 before:top-1/2 before:h-5 before:w-[3px] before:-translate-y-1/2
                  before:rounded-full before:bg-sky-400 before:transition-opacity before:duration-150
                  transition-colors duration-150 ${collapsed ? "justify-center px-2" : "px-3"} ${
                    isActive
                      ? "bg-white/10 text-white before:opacity-100"
                      : "text-slate-300 before:opacity-0 hover:bg-white/5 hover:text-white"
                  }`
                }
              >
                <item.icon size={17} strokeWidth={1.85} className="shrink-0" />
                {!collapsed && <span className="truncate">{item.label}</span>}
                <NavNotificationBadge to={item.to} collapsed={collapsed} />
              </NavLink>
            ))}
          </div>
        </div>
      ))}
    </nav>
  );
}

const SIDEBAR_BG = "bg-[#0d1220]";

export function SuperAdminMergedSidebar({
  isCollapsed,
  onToggleCollapse,
  isMobileOpen,
  onCloseMobile,
}: SuperAdminMergedSidebarProps) {
  return (
    <>
      <aside
        className={`hidden shrink-0 flex-col ${SIDEBAR_BG} transition-[width] duration-200 md:flex print:hidden ${
          isCollapsed ? "w-[76px]" : "w-64"
        }`}
      >
        <Brand collapsed={isCollapsed} />
        <ModeToggle collapsed={isCollapsed} />
        <NavGroups collapsed={isCollapsed} />
        <UserCard collapsed={isCollapsed} />
        <button
          type="button"
          onClick={onToggleCollapse}
          className="m-3 flex items-center justify-center gap-2 rounded-lg border border-white/10 py-2 text-xs font-medium text-slate-400 transition-colors hover:bg-white/5 hover:text-white"
        >
          {isCollapsed ? <PanelLeftOpen size={16} /> : <PanelLeftClose size={16} />}
          {!isCollapsed && "Collapse"}
        </button>
      </aside>

      {isMobileOpen && (
        <div className="fixed inset-0 z-40 md:hidden">
          <div className="absolute inset-0 bg-black/50 animate-fade-in" onClick={onCloseMobile} aria-hidden="true" />
          <aside className={`relative flex h-full w-72 animate-slide-up flex-col ${SIDEBAR_BG} shadow-2xl`}>
            <div className="flex items-center justify-between">
              <Brand collapsed={false} />
              <button
                type="button"
                onClick={onCloseMobile}
                aria-label="Close menu"
                className="mr-4 rounded-md p-1.5 text-slate-400 hover:bg-white/10 hover:text-white"
              >
                <X size={18} />
              </button>
            </div>
            <ModeToggle collapsed={false} />
            <NavGroups collapsed={false} onNavigate={onCloseMobile} />
            <UserCard collapsed={false} />
          </aside>
        </div>
      )}
    </>
  );
}
