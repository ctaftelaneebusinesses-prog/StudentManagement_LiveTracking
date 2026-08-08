import { NavLink, useNavigate } from "react-router-dom";
import { LogOut, PanelLeftClose, PanelLeftOpen, X } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useSchool } from "@/hooks/useSchool";
import { SchoolLogo } from "@/components/ui/SchoolLogo";
import { Avatar } from "@/components/ui/Avatar";
import { ROLE_LABEL, ROLE_SIDEBAR_BG, ROLE_ACTIVE_ACCENT } from "@/utils/roles";
import { RoleName } from "@/types/auth.types";
import { ADMIN_NAV_GROUPS } from "./navConfig";
import { NavNotificationBadge } from "./NavNotificationBadge";

interface AdminSidebarProps {
  isCollapsed: boolean;
  onToggleCollapse: () => void;
  isMobileOpen: boolean;
  onCloseMobile: () => void;
}

/**
 * This shell is shared by school_admin/super_admin/principal (same pages,
 * same components), but each still gets its own sidebar color — principal
 * shouldn't look identical to school_admin just because it reuses the same
 * console. `user.roles.name` is the account's single *primary* role, which
 * is exactly right here since these three are mutually exclusive account
 * types (nobody holds two of them at once).
 */
function useAdminPrimaryRole(): RoleName {
  const { user } = useAuth();
  return user?.roles.name ?? "school_admin";
}

function Brand({ collapsed }: { collapsed: boolean }) {
  const { selectedSchool } = useSchool();
  const { hasRole } = useAuth();
  // This shell is shared by school_admin/super_admin AND principal (same
  // pages, same components) — but the label must reflect who's actually
  // logged in, since "Admin Console" would be misleading for a principal.
  const isPrincipalOnly = hasRole("principal") && !hasRole("school_admin") && !hasRole("super_admin");
  const label = isPrincipalOnly ? "Principal Console" : "Admin Console";
  return (
    <div className="flex h-16 shrink-0 items-center gap-2.5 px-4">
      <SchoolLogo src={selectedSchool.logo_url} size="sm" />
      {!collapsed && <span className="truncate text-[15px] font-semibold text-white">{label}</span>}
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
            <p className="truncate text-xs text-slate-400">{ROLE_LABEL[user.roles.name]}</p>
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
  const { roleNames } = useAuth();
  const activeAccent = ROLE_ACTIVE_ACCENT[useAdminPrimaryRole()];
  const visibleGroups = ADMIN_NAV_GROUPS.map((group) => ({
    ...group,
    items: group.items.filter((item) => !item.roles || item.roles.some((r) => roleNames.includes(r))),
  })).filter((group) => group.items.length > 0);

  return (
    <nav className="sidebar-scroll flex-1 space-y-5 overflow-y-auto px-3 py-3">
      {visibleGroups.map((group) => (
        <div key={group.label}>
          {!collapsed && (
            <p className="mb-1.5 px-3 text-[11px] font-semibold uppercase tracking-wider text-slate-400">{group.label}</p>
          )}
          <div className="space-y-0.5">
            {group.items.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                onClick={onNavigate}
                title={collapsed ? item.label : undefined}
                className={({ isActive }) =>
                  `group relative flex items-center gap-2.5 rounded-lg py-2 text-sm font-medium
                  before:absolute before:-left-3 before:top-1/2 before:h-5 before:w-[3px] before:-translate-y-1/2
                  before:rounded-full before:transition-opacity before:duration-150 ${activeAccent}
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

export function AdminSidebar({ isCollapsed, onToggleCollapse, isMobileOpen, onCloseMobile }: AdminSidebarProps) {
  const sidebarBg = ROLE_SIDEBAR_BG[useAdminPrimaryRole()];

  return (
    <>
      <aside
        className={`hidden shrink-0 flex-col ${sidebarBg} transition-[width] duration-200 md:flex print:hidden ${
          isCollapsed ? "w-[76px]" : "w-64"
        }`}
      >
        <Brand collapsed={isCollapsed} />
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
          <aside className={`relative flex h-full w-72 animate-slide-up flex-col ${sidebarBg} shadow-2xl`}>
            <div className="flex items-center justify-between">
              <Brand collapsed={false} />
              <button
                type="button"
                onClick={onCloseMobile}
                aria-label="Close menu"
                className="mr-3 flex min-h-11 min-w-11 items-center justify-center rounded-md p-1.5 text-slate-400 hover:bg-white/10 hover:text-white"
              >
                <X size={18} />
              </button>
            </div>
            <NavGroups collapsed={false} onNavigate={onCloseMobile} />
            <UserCard collapsed={false} />
          </aside>
        </div>
      )}
    </>
  );
}
