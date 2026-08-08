import { RoleName } from "@/types/auth.types";

/** Default landing route per role, used right after login. */
export const ROLE_HOME_ROUTE: Record<RoleName, string> = {
  super_admin: "/dashboard/super-admin",
  school_admin: "/dashboard/school-admin",
  principal: "/dashboard/admin/overview",
  teacher: "/dashboard/teacher",
  student: "/dashboard/portal/dashboard",
  driver: "/dashboard/driver",
  support_staff: "/dashboard/profile",
  accountant: "/dashboard/accountant",
  extracurricular_staff: "/dashboard/extracurricular",
};

// super_admin sits ABOVE school_admin since
// 066_super_admin_multi_school.sql re-tiered the two (reversing the
// deliberate flattening in 027_equalize_admin_roles.sql): super_admin is the
// platform operator with cross-school reach, school_admin manages only their
// assigned schools. The labels must make that distinction visible.
export const ROLE_LABEL: Record<RoleName, string> = {
  super_admin: "Super Admin",
  school_admin: "School Admin",
  principal: "Principal",
  teacher: "Teacher",
  student: "Student",
  driver: "Driver",
  support_staff: "Support Staff",
  accountant: "Accountant",
  extracurricular_staff: "Extracurricular Staff",
};

/** Mirrors the fixed `public.roles` seed (database/migrations/002_rbac_permissions.sql, 023_support_staff_role.sql). */
export const ROLE_ID: Record<RoleName, number> = {
  school_admin: 1,
  principal: 2,
  teacher: 3,
  student: 5,
  driver: 6,
  super_admin: 7,
  support_staff: 8,
  accountant: 9,
  extracurricular_staff: 10,
};

/**
 * Each portal gets its own dark, professional sidebar color — richer and
 * more saturated than a bare near-black so the hue is obvious at a glance,
 * not just technically different in a hex-code diff. super_admin now has its
 * own near-black "platform" identity, distinct from school_admin's navy, so a
 * platform operator can never mistake the Super Admin console for a single
 * school's; principal gets its own indigo, even though it renders through the
 * same AdminSidebar/AdminDashboardShell component, so "which role am I in" is
 * never ambiguous.
 */
export const ROLE_SIDEBAR_BG: Record<RoleName, string> = {
  super_admin: "bg-[#0d1220]", // near-black platform tier
  school_admin: "bg-[#132a4d]", // navy
  principal: "bg-[#33215e]", // indigo/violet
  teacher: "bg-[#0b4a43]", // teal
  student: "bg-[#11492c]", // forest green
  driver: "bg-[#2d3548]", // slate blue-grey
  support_staff: "bg-[#2d3548]",
  accountant: "bg-[#0f3d2e]", // emerald — finance modules read as "money green"
  extracurricular_staff: "bg-[#4d3319]", // amber/bronze
};

/**
 * The lighter tint of each role's sidebar hue, used for the active-nav-item
 * left bar (a `::before` pseudo-element) and matched on the dashboard
 * header's accent border so the two read as one color story. Stored as the
 * *complete* `before:bg-*` class name (not built from pieces at render time)
 * because Tailwind's JIT scanner only picks up whole literal class names —
 * `before:${accent}` in a template string would never generate the actual
 * `before:bg-teal-400` CSS rule, just an unrelated bare `.bg-teal-400`.
 */
export const ROLE_ACTIVE_ACCENT: Record<RoleName, string> = {
  super_admin: "before:bg-sky-400",
  school_admin: "before:bg-blue-400",
  principal: "before:bg-violet-400",
  teacher: "before:bg-teal-400",
  student: "before:bg-green-400",
  driver: "before:bg-slate-400",
  support_staff: "before:bg-slate-400",
  accountant: "before:bg-emerald-400",
  extracurricular_staff: "before:bg-amber-400",
};

/**
 * A small, role-specific accent used only on each portal's dashboard header
 * (a colored left border next to the greeting) — matches ROLE_ACTIVE_ACCENT's
 * hue so the sidebar and the header read as one consistent identity per
 * portal. Everything else in the UI (buttons, links) draws from the one
 * shared `brand`/`accent` Tailwind scale — this is purely a "which portal am
 * I in" cue, not a competing color system.
 */
export const ROLE_HEADER_ACCENT: Record<RoleName, string> = {
  super_admin: "border-sky-500",
  school_admin: "border-blue-500",
  principal: "border-violet-500",
  teacher: "border-teal-500",
  student: "border-green-500",
  driver: "border-slate-400",
  support_staff: "border-slate-400",
  accountant: "border-emerald-500",
  extracurricular_staff: "border-amber-500",
};

// Deliberately excludes "teacher", "student", "driver", and
// "extracurricular_staff": each of those roles has a dedicated extension
// table (students.admission_no, teachers.employee_id, drivers.license_number,
// extracurricular_staff's staff code/type) that this generic bare-user form
// has no way to populate — creating one here would leave a broken account
// with no matching row, which 404s on every page that looks it up by id. Use
// the dedicated Students/Teachers/Transport (Drivers) pages, or
// Extracurricular Staff's "Add staff" instead — the backend rejects these
// role ids here too (see backend/src/validators/user.validator.ts) so this
// is enforced, not just hidden.
export const ASSIGNABLE_ROLE_OPTIONS = (
  ["school_admin", "principal", "support_staff", "accountant"] as RoleName[]
).map((role) => ({ value: String(ROLE_ID[role]), label: ROLE_LABEL[role] }));
