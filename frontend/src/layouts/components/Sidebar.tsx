import { NavLink, useNavigate } from "react-router-dom";
import { LogOut, PanelLeftClose, PanelLeftOpen, Settings, X } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useSchool } from "@/hooks/useSchool";
import { SchoolLogo } from "@/components/ui/SchoolLogo";
import { Avatar } from "@/components/ui/Avatar";
import { ROLE_LABEL, ROLE_SIDEBAR_BG, ROLE_ACTIVE_ACCENT } from "@/utils/roles";
import { RoleName } from "@/types/auth.types";
import { PORTAL_NAV_GROUPS, PortalNavGroup } from "./navConfig";

/** The role whose color identity the sidebar takes on — the account's primary role (roles.name), same field ROLE_LABEL/ROLE_SIDEBAR_BG etc. already key off. */
function usePrimaryRole(): RoleName | null {
  const { user } = useAuth();
  return user?.roles.name ?? null;
}

/** Merges each held role's nav groups into one list, combining same-labeled groups (e.g. "Overview") instead of repeating them for a multi-role user. */
function mergeNavGroups(roleNames: string[]): PortalNavGroup[] {
  const merged = new Map<string, PortalNavGroup>();
  for (const role of roleNames) {
    const groups = PORTAL_NAV_GROUPS[role as keyof typeof PORTAL_NAV_GROUPS] ?? [];
    for (const group of groups) {
      const existing = merged.get(group.label);
      if (!existing) {
        merged.set(group.label, { label: group.label, items: [...group.items] });
        continue;
      }
      for (const item of group.items) {
        if (!existing.items.some((i) => i.to === item.to)) existing.items.push(item);
      }
    }
  }
  return Array.from(merged.values());
}

function Brand({ collapsed }: { collapsed: boolean }) {
  const { selectedSchool } = useSchool();
  return (
    <div className="flex h-16 shrink-0 items-center gap-2.5 px-4">
      <SchoolLogo src={selectedSchool.logo_url} size="sm" />
      {!collapsed && (
        <span className="truncate text-[15px] font-semibold text-white" title={selectedSchool.name}>
          {selectedSchool.name}
        </span>
      )}
    </div>
  );
}

function NavGroups({ collapsed, onNavigate }: { collapsed: boolean; onNavigate?: () => void }) {
  const { roleNames } = useAuth();
  const primaryRole = usePrimaryRole();
  const activeAccent = ROLE_ACTIVE_ACCENT[primaryRole ?? "teacher"];
  const groups = mergeNavGroups(roleNames);
  // Roles like accountant have no dedicated profile page yet, so their own
  // "My Profile" nav item already points straight at the generic
  // /dashboard/profile editor — the "Account Settings" link below would just
  // be a second entry pointing at that exact same URL.
  const alreadyLinksToGenericProfile = groups.some((group) => group.items.some((item) => item.to === "/dashboard/profile"));

  return (
    <nav className="sidebar-scroll flex-1 space-y-5 overflow-y-auto px-3 py-3">
      {groups.map((group) => (
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
                end={item.to === "/dashboard/teacher" || item.to === "/dashboard/student" || item.to === "/dashboard/driver"}
                title={collapsed ? item.label : undefined}
                className={({ isActive }) =>
                  `group relative flex items-center gap-2.5 rounded-lg py-2 text-sm font-medium transition-colors ${
                    collapsed ? "justify-center px-2" : "px-3"
                  } ${
                    isActive
                      ? `bg-white/10 text-white before:absolute before:-left-3 before:top-1/2 before:h-5 before:w-[3px] before:-translate-y-1/2 before:rounded-full ${activeAccent}`
                      : "text-slate-300 hover:bg-white/5 hover:text-white"
                  }`
                }
              >
                <item.icon size={17} strokeWidth={1.85} className="shrink-0" />
                {!collapsed && <span className="truncate">{item.label}</span>}
              </NavLink>
            ))}
          </div>
        </div>
      ))}

      {/* Teachers manage everything (profile, password, address, avatar) from
          their own "My Profile" page (My Class group, above) — a second
          "Account Settings" entry pointing at the generic profile editor
          would just be a duplicate. Every other role has no dedicated
          profile page yet, so they still need this link. */}
      {!roleNames.includes("teacher") && !alreadyLinksToGenericProfile && (
        <div>
          {!collapsed && (
            <p className="mb-1.5 px-3 text-[11px] font-semibold uppercase tracking-wider text-slate-400">Account</p>
          )}
          <NavLink
            to="/dashboard/profile"
            onClick={onNavigate}
            title={collapsed ? "Profile" : undefined}
            className={({ isActive }) =>
              `group relative flex items-center gap-2.5 rounded-lg py-2 text-sm font-medium transition-colors ${
                collapsed ? "justify-center px-2" : "px-3"
              } ${
                isActive
                  ? `bg-white/10 text-white before:absolute before:-left-3 before:top-1/2 before:h-5 before:w-[3px] before:-translate-y-1/2 before:rounded-full ${activeAccent}`
                  : "text-slate-300 hover:bg-white/5 hover:text-white"
              }`
            }
          >
            <Settings size={17} strokeWidth={1.85} className="shrink-0" />
            {!collapsed && <span className="truncate">Account Settings</span>}
          </NavLink>
        </div>
      )}
    </nav>
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

interface SidebarProps {
  isCollapsed: boolean;
  onToggleCollapse: () => void;
  /** Whether the mobile slide-in drawer is open — ignored above the `md` breakpoint, where the sidebar is always visible. */
  isMobileOpen: boolean;
  onCloseMobile: () => void;
}

/**
 * Chrome shared by the teacher/student/driver portals — mirrors
 * AdminSidebar's structure (grouped nav, collapsible, mobile drawer) so
 * every role's shell feels like one consistent product, just tinted with
 * that role's own dark accent color (ROLE_SIDEBAR_BG) instead of the navy
 * used by the Admin Console, so each portal is identifiable at a glance.
 */
export function Sidebar({ isCollapsed, onToggleCollapse, isMobileOpen, onCloseMobile }: SidebarProps) {
  const primaryRole = usePrimaryRole();
  const sidebarBg = ROLE_SIDEBAR_BG[primaryRole ?? "teacher"];

  return (
    <>
      <aside
        className={`hidden shrink-0 flex-col ${sidebarBg} transition-[width] duration-200 md:flex ${
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

      {/* Mobile: backdrop + slide-in drawer, toggled by the navbar's menu button */}
      {isMobileOpen && (
        <div className="fixed inset-0 z-40 h-dvh md:hidden">
          <div className="absolute inset-0 bg-black/50 animate-fade-in" onClick={onCloseMobile} aria-hidden="true" />
          <aside className={`relative flex h-dvh w-72 animate-slide-up flex-col ${sidebarBg} shadow-2xl`}>
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
