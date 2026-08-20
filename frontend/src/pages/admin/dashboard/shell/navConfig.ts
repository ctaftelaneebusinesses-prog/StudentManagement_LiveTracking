import {
  BadgeCheck,
  BarChart3,
  Bell,
  BookOpen,
  Bus,
  Building2,
  CalendarCheck,
  CalendarClock,
  ClipboardCheck,
  ClipboardList,
  GraduationCap,
  LayoutDashboard,
  MailQuestion,
  Megaphone,
  Settings,
  ShieldAlert,
  Sparkles,
  UserCheck,
  Users,
  Wallet,
  type LucideIcon,
} from "lucide-react";
import { RoleName } from "@/types/auth.types";

// Principal reuses the entire Admin Console (same pages/components); the two
// spec restrictions (no School CRUD/multi-school, no managing admin-tier
// accounts) are enforced inside individual pages, not via nav visibility.
const ADMIN_ONLY: RoleName[] = ["school_admin", "super_admin", "principal"];

export interface AdminNavItem {
  label: string;
  to: string;
  icon: LucideIcon;
  /** Roles that may see/click this item. Defaults to school_admin/super_admin — override for items other roles can also reach (e.g. principal). */
  roles?: RoleName[];
}

export interface AdminNavGroup {
  label: string;
  items: AdminNavItem[];
}

export const ADMIN_NAV_GROUPS: AdminNavGroup[] = [
  {
    label: "Overview",
    items: [
      { label: "Dashboard", to: "/dashboard/admin/overview", icon: LayoutDashboard, roles: ADMIN_ONLY },
      {
        label: "Notifications",
        to: "/dashboard/admin/notifications",
        icon: Bell,
        roles: ["school_admin", "super_admin", "principal"],
      },
    ],
  },
  {
    label: "People",
    items: [
      { label: "Students", to: "/dashboard/admin/students", icon: GraduationCap, roles: ADMIN_ONLY },
      { label: "Teachers", to: "/dashboard/admin/teachers", icon: Users, roles: ADMIN_ONLY },
      { label: "Teacher Attendance", to: "/dashboard/admin/teacher-attendance", icon: UserCheck, roles: ADMIN_ONLY },
      {
        label: "Extracurricular Staff",
        to: "/dashboard/admin/extracurricular-staff",
        icon: Sparkles,
        roles: ADMIN_ONLY,
      },
      { label: "Users & Roles", to: "/dashboard/admin/users", icon: Users, roles: ADMIN_ONLY },
      {
        label: "Registration Approvals",
        to: "/dashboard/admin/registration-approvals",
        icon: ClipboardCheck,
        roles: ADMIN_ONLY,
      },
    ],
  },
  {
    label: "Academics",
    items: [
      { label: "Classes & Sections", to: "/dashboard/admin/classes", icon: BookOpen, roles: ADMIN_ONLY },
      { label: "Timetable", to: "/dashboard/admin/timetable", icon: CalendarClock, roles: ADMIN_ONLY },
      { label: "Exams", to: "/dashboard/admin/exams", icon: ClipboardList, roles: ADMIN_ONLY },
      { label: "Syllabus", to: "/dashboard/admin/syllabus", icon: BookOpen, roles: ADMIN_ONLY },
      { label: "Activities", to: "/dashboard/admin/activities", icon: Sparkles, roles: ADMIN_ONLY },
    ],
  },
  {
    label: "Finance",
    items: [{ label: "Fees", to: "/dashboard/admin/fees", icon: Wallet, roles: ADMIN_ONLY }],
  },
  {
    label: "Communication",
    items: [{ label: "Announcements", to: "/dashboard/admin/announcements", icon: Megaphone, roles: ADMIN_ONLY }],
  },
  {
    label: "Operations",
    items: [
      { label: "Transport", to: "/dashboard/admin/transport", icon: Bus, roles: [...ADMIN_ONLY, "teacher"] },
      {
        label: "Emergency Alerts",
        to: "/dashboard/emergency-alerts",
        icon: ShieldAlert,
        roles: ["school_admin", "super_admin", "principal"],
      },
      {
        label: "Leave Requests",
        to: "/dashboard/admin/leave-requests",
        icon: CalendarCheck,
        roles: ["school_admin", "super_admin", "principal"],
      },
      { label: "My Leave", to: "/dashboard/admin/my-leave", icon: CalendarCheck, roles: ["principal"] },
      {
        label: "Leave Settings",
        to: "/dashboard/admin/leave-settings",
        icon: CalendarCheck,
        roles: ["school_admin", "super_admin"],
      },
    ],
  },
  {
    label: "Insights",
    items: [{ label: "Reports", to: "/dashboard/admin/reports", icon: BarChart3, roles: ADMIN_ONLY }],
  },
  {
    label: "Learning",
    // school_admin and super_admin run the platform, they don't need the
    // learner-facing knowledge assessment — only principal (who takes it
    // alongside teachers/students) sees it here.
    items: [{ label: "Website Knowledge", to: "/dashboard/admin/website-knowledge", icon: BadgeCheck, roles: ["principal"] }],
  },
  {
    label: "Platform",
    items: [
      { label: "School Management", to: "/dashboard/admin/schools", icon: Building2, roles: ADMIN_ONLY },
      // school_admin only — super_admin creates schools directly (holds
      // platform.manage_schools) and never needs this request path; principal
      // never manages schools at all. See RequestSchoolPage.
      { label: "Request School", to: "/dashboard/admin/schools/request", icon: MailQuestion, roles: ["school_admin"] },
    ],
  },
  {
    label: "Settings",
    items: [{ label: "Settings", to: "/dashboard/admin/settings", icon: Settings, roles: ADMIN_ONLY }],
  },
];

export const ALL_ADMIN_NAV_ITEMS: AdminNavItem[] = ADMIN_NAV_GROUPS.flatMap((g) => g.items);
