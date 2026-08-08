import { NavLink, useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { LogOut, PanelLeftClose, PanelLeftOpen, Settings, X } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useSchool } from "@/hooks/useSchool";
import { SchoolLogo } from "@/components/ui/SchoolLogo";
import { Avatar } from "@/components/ui/Avatar";
import { ROLE_LABEL } from "@/utils/roles";
import { PORTAL_NAV_GROUPS, PortalNavGroup, PortalNavItem } from "@/layouts/components/navConfig";

/** Merges each held role's nav groups so a user holding multiple roles doesn't see duplicated groups. */
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
      <AnimatePresence initial={false}>
        {!collapsed && (
          <motion.span
            initial={{ opacity: 0, width: 0 }}
            animate={{ opacity: 1, width: "auto" }}
            exit={{ opacity: 0, width: 0 }}
            transition={{ duration: 0.18 }}
            className="truncate text-[15px] font-semibold text-white"
            title={selectedSchool.name}
          >
            {selectedSchool.name}
          </motion.span>
        )}
      </AnimatePresence>
    </div>
  );
}

function NavItemLink({ item, collapsed, onNavigate }: { item: PortalNavItem; collapsed: boolean; onNavigate?: () => void }) {
  const isDashboardRoot = item.to === "/dashboard/portal/dashboard";

  return (
    <NavLink
      to={item.to}
      onClick={onNavigate}
      end={isDashboardRoot}
      className="group relative block"
    >
      {({ isActive }) => (
        <div
          className={`relative flex items-center gap-2.5 rounded-xl py-2 text-sm font-medium transition-colors ${
            collapsed ? "justify-center px-2" : "px-3"
          } ${isActive ? "text-white" : "text-white/70 hover:text-white"}`}
        >
          {isActive && (
            <motion.span
              layoutId="portal-nav-active-pill"
              className="absolute inset-0 rounded-xl bg-white/15 ring-1 ring-white/20"
              transition={{ type: "spring", stiffness: 400, damping: 32 }}
            />
          )}
          <item.icon size={17} strokeWidth={1.85} className="relative z-10 shrink-0" />
          {!collapsed && <span className="relative z-10 truncate">{item.label}</span>}

          {collapsed && (
            <span className="pointer-events-none absolute left-full top-1/2 z-20 ml-3 -translate-y-1/2 translate-x-1 whitespace-nowrap rounded-lg bg-[#111827] px-2.5 py-1.5 text-xs font-medium text-white opacity-0 shadow-lg transition-all duration-150 group-hover:translate-x-0 group-hover:opacity-100">
              {item.label}
            </span>
          )}
        </div>
      )}
    </NavLink>
  );
}

function NavGroups({ collapsed, onNavigate }: { collapsed: boolean; onNavigate?: () => void }) {
  const { roleNames } = useAuth();
  const groups = mergeNavGroups(roleNames);
  const alreadyLinksToGenericProfile = groups.some((group) => group.items.some((item) => item.to === "/dashboard/profile"));

  return (
    <nav className="sidebar-scroll flex-1 space-y-5 overflow-y-auto px-3 py-3">
      {groups.map((group) => (
        <div key={group.label}>
          {!collapsed && (
            <p className="mb-1.5 px-3 text-[11px] font-semibold uppercase tracking-wider text-white/40">{group.label}</p>
          )}
          <div className="space-y-0.5">
            {group.items.map((item) => (
              <NavItemLink key={item.to} item={item} collapsed={collapsed} onNavigate={onNavigate} />
            ))}
          </div>
        </div>
      ))}

      {!roleNames.includes("teacher") && !alreadyLinksToGenericProfile && (
        <div>
          {!collapsed && <p className="mb-1.5 px-3 text-[11px] font-semibold uppercase tracking-wider text-white/40">Account</p>}
          <NavItemLink item={{ label: "Account Settings", to: "/dashboard/profile", icon: Settings }} collapsed={collapsed} onNavigate={onNavigate} />
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
      <div className={`flex items-center gap-2.5 rounded-xl p-1.5 ${collapsed ? "justify-center" : ""}`}>
        <Avatar src={user.avatar_url} name={user.full_name} size="sm" />
        {!collapsed && (
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium text-white">{user.full_name}</p>
            <p className="truncate text-xs text-white/50">{ROLE_LABEL[user.roles.name]}</p>
          </div>
        )}
        <button
          type="button"
          onClick={handleLogout}
          aria-label="Log out"
          title="Log out"
          className="shrink-0 rounded-lg p-1.5 text-white/50 transition-colors hover:bg-white/10 hover:text-white"
        >
          <LogOut size={16} strokeWidth={1.85} />
        </button>
      </div>
    </div>
  );
}

interface PortalSidebarProps {
  isCollapsed: boolean;
  onToggleCollapse: () => void;
  isMobileOpen: boolean;
  onCloseMobile: () => void;
}

/**
 * Student Portal-only sidebar (see PortalShell.tsx) — visually
 * independent from layouts/components/Sidebar.tsx (used by teacher/driver/
 * admin) so this redesign never touches those portals' chrome. Gradient
 * panel driven by the active gender theme's --portal-sidebar-* tokens,
 * framer-motion collapse animation, layoutId-animated active pill, and a
 * floating tooltip when collapsed.
 */
export function PortalSidebar({ isCollapsed, onToggleCollapse, isMobileOpen, onCloseMobile }: PortalSidebarProps) {
  const panelStyle = { background: "linear-gradient(180deg, var(--portal-sidebar-from), var(--portal-sidebar-to))" };

  return (
    <>
      <motion.aside
        animate={{ width: isCollapsed ? 76 : 256 }}
        transition={{ type: "spring", stiffness: 320, damping: 34 }}
        style={panelStyle}
        className="hidden shrink-0 flex-col shadow-xl md:flex"
      >
        <Brand collapsed={isCollapsed} />
        <NavGroups collapsed={isCollapsed} />
        <UserCard collapsed={isCollapsed} />
        <button
          type="button"
          onClick={onToggleCollapse}
          className="m-3 flex items-center justify-center gap-2 rounded-xl border border-white/10 py-2 text-xs font-medium text-white/60 transition-colors hover:bg-white/5 hover:text-white"
        >
          {isCollapsed ? <PanelLeftOpen size={16} /> : <PanelLeftClose size={16} />}
          {!isCollapsed && "Collapse"}
        </button>
      </motion.aside>

      <AnimatePresence>
        {isMobileOpen && (
          <div className="fixed inset-0 z-40 h-dvh md:hidden">
            <motion.div
              className="absolute inset-0 bg-black/50"
              onClick={onCloseMobile}
              aria-hidden="true"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            />
            <motion.aside
              style={panelStyle}
              className="relative flex h-dvh w-72 flex-col shadow-2xl"
              initial={{ x: "-100%" }}
              animate={{ x: 0 }}
              exit={{ x: "-100%" }}
              transition={{ type: "spring", stiffness: 320, damping: 34 }}
            >
              <div className="flex items-center justify-between">
                <Brand collapsed={false} />
                <button
                  type="button"
                  onClick={onCloseMobile}
                  aria-label="Close menu"
                  className="mr-3 flex min-h-11 min-w-11 items-center justify-center rounded-lg p-1.5 text-white/60 hover:bg-white/10 hover:text-white"
                >
                  <X size={18} />
                </button>
              </div>
              <NavGroups collapsed={false} onNavigate={onCloseMobile} />
              <UserCard collapsed={false} />
            </motion.aside>
          </div>
        )}
      </AnimatePresence>
    </>
  );
}
