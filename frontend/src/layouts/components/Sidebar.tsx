import { NavLink } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { ROLE_HOME_ROUTE } from "@/utils/roles";

interface NavItem {
  label: string;
  to: string;
}

const ADMIN_NAV_ITEMS: NavItem[] = [
  { label: "School Settings", to: "/dashboard/admin/school" },
  { label: "Users", to: "/dashboard/admin/users" },
  { label: "Students", to: "/dashboard/admin/students" },
  { label: "Teachers", to: "/dashboard/admin/teachers" },
  { label: "Classes & Subjects", to: "/dashboard/admin/classes" },
  { label: "Transport", to: "/dashboard/admin/transport" },
  { label: "Live Vehicle Tracking", to: "/dashboard/admin/vehicle-tracking" },
];

const TEACHER_NAV_ITEMS: NavItem[] = [
  { label: "Attendance", to: "/dashboard/teacher/attendance" },
  { label: "Marks", to: "/dashboard/teacher/marks" },
  { label: "Homework", to: "/dashboard/teacher/homework" },
  { label: "Reports", to: "/dashboard/teacher/reports" },
];

/**
 * Nav items are intentionally minimal for roles whose portal hasn't been
 * built yet (transport). The School Administration Module (Phase 3) adds a
 * full section for school_admin and super_admin; the Teacher Module
 * (Phase 5) adds one for teacher.
 */
function useNavItems(): NavItem[] {
  const { user, roleNames } = useAuth();
  if (!user) return [];

  const home = ROLE_HOME_ROUTE[user.roles.name];
  const items: NavItem[] = [{ label: "Dashboard", to: home }];

  if (roleNames.includes("school_admin") || roleNames.includes("super_admin")) {
    items.push(...ADMIN_NAV_ITEMS);
  }

  if (roleNames.includes("teacher")) {
    items.push(...TEACHER_NAV_ITEMS);
  }
  if (roleNames.includes("parent")) items.push({ label: "Van Tracking", to: "/dashboard/parent/van-tracking" });

  items.push({ label: "Profile", to: "/dashboard/profile" });
  return items;
}

export function Sidebar() {
  const navItems = useNavItems();

  return (
    <aside className="hidden w-64 shrink-0 border-r border-slate-200 bg-white md:flex md:flex-col">
      <div className="flex h-16 items-center px-6 text-lg font-semibold text-slate-900">
        SMS
      </div>
      <nav className="flex-1 space-y-1 px-3 py-4">
        {navItems.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            className={({ isActive }) =>
              `block rounded-md px-3 py-2 text-sm font-medium transition-colors ${
                isActive
                  ? "bg-brand-50 text-brand-700"
                  : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
              }`
            }
          >
            {item.label}
          </NavLink>
        ))}
      </nav>
    </aside>
  );
}
