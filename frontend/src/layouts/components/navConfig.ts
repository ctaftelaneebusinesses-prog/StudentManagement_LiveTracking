import {
  Award,
  BadgeCheck,
  BarChart3,
  BookOpen,
  Bus,
  CalendarCheck,
  CalendarClock,
  CalendarDays,
  ClipboardCheck,
  ClipboardList,
  FileCheck2,
  FileText,
  Gamepad2,
  GraduationCap,
  IdCard,
  LayoutDashboard,
  Sparkles,
  Trophy,
  Users,
  Wallet,
  type LucideIcon,
} from "lucide-react";
import { RoleName } from "@/types/auth.types";

export interface PortalNavItem {
  label: string;
  to: string;
  icon: LucideIcon;
}

export interface PortalNavGroup {
  label: string;
  items: PortalNavItem[];
}

/**
 * The Student Portal's nav (see pages/portal/PortalShell.tsx). This is now
 * the only "Dashboard"/"Homework" entry for the student role — the old
 * separate dashboard and homework pages have been retired; PortalDashboardPage
 * folds in everything they used to show (attendance, marks, question papers,
 * homework, timetable, notifications).
 */
const PORTAL_SHARED_NAV: PortalNavGroup[] = [
  { label: "Overview", items: [{ label: "Dashboard", to: "/dashboard/portal/dashboard", icon: LayoutDashboard }] },
  {
    label: "Academics",
    items: [
      { label: "Attendance", to: "/dashboard/portal/attendance", icon: ClipboardList },
      { label: "Timetable", to: "/dashboard/portal/timetable", icon: CalendarClock },
      { label: "Homework", to: "/dashboard/portal/homework", icon: BookOpen },
      { label: "Marks", to: "/dashboard/portal/marks", icon: GraduationCap },
      { label: "Examinations", to: "/dashboard/portal/exams", icon: CalendarDays },
      { label: "Evaluated Papers", to: "/dashboard/portal/evaluated-papers", icon: FileCheck2 },
      { label: "Syllabus", to: "/dashboard/portal/syllabus", icon: BookOpen },
    ],
  },
  {
    label: "Extracurricular",
    items: [{ label: "Extracurricular Activities", to: "/dashboard/portal/extracurricular", icon: Sparkles }],
  },
  {
    label: "Fees & Reports",
    items: [
      { label: "Fee Details", to: "/dashboard/portal/fees", icon: Wallet },
      { label: "Reports", to: "/dashboard/portal/reports", icon: FileText },
    ],
  },
  {
    label: "Learning",
    items: [
      { label: "Website Knowledge", to: "/dashboard/portal/website-knowledge", icon: BadgeCheck },
      { label: "Learning Games", to: "/dashboard/portal/learning-games", icon: Gamepad2 },
    ],
  },
  { label: "Profile", items: [{ label: "My Profile", to: "/dashboard/portal/profile", icon: IdCard }] },
];

/**
 * Grouped nav config for the teacher/student/driver portals — mirrors
 * the structure `pages/admin/dashboard/shell/navConfig.ts` already uses for
 * the Admin Console (Overview → domain groups → Insights), so every portal's
 * sidebar reads the same way regardless of role.
 */
export const PORTAL_NAV_GROUPS: Record<RoleName, PortalNavGroup[]> = {
  teacher: [
    { label: "Overview", items: [{ label: "Dashboard", to: "/dashboard/teacher", icon: LayoutDashboard }] },
    {
      label: "My Class",
      items: [
        { label: "My Profile", to: "/dashboard/teacher/profile", icon: IdCard },
        { label: "Students", to: "/dashboard/teacher/students", icon: Users },
        { label: "Timetable", to: "/dashboard/teacher/timetable", icon: CalendarClock },
        { label: "Student Registrations", to: "/dashboard/teacher/registration-approvals", icon: ClipboardCheck },
      ],
    },
    {
      label: "Academics",
      items: [
        { label: "Attendance", to: "/dashboard/teacher/attendance", icon: ClipboardList },
        { label: "Homework", to: "/dashboard/teacher/homework", icon: BookOpen },
        { label: "Marks", to: "/dashboard/teacher/marks", icon: GraduationCap },
        { label: "Assessments", to: "/dashboard/teacher/assessments", icon: Award },
        { label: "Question Papers", to: "/dashboard/teacher/question-papers", icon: FileText },
        { label: "Syllabus", to: "/dashboard/teacher/syllabus", icon: BookOpen },
      ],
    },
    { label: "Leave", items: [{ label: "Leave", to: "/dashboard/teacher/leave", icon: CalendarCheck }] },
    { label: "Operations", items: [{ label: "Transport", to: "/dashboard/teacher/transport", icon: Bus }] },
    { label: "Insights", items: [{ label: "Reports", to: "/dashboard/teacher/reports", icon: BarChart3 }] },
    { label: "Learning", items: [{ label: "Website Knowledge", to: "/dashboard/teacher/website-knowledge", icon: BadgeCheck }] },
  ],
  student: [
    ...PORTAL_SHARED_NAV,
    { label: "Leave", items: [{ label: "Leave", to: "/dashboard/student/leave", icon: CalendarCheck }] },
    { label: "Transport", items: [{ label: "Van Tracking", to: "/dashboard/portal/transport", icon: Bus }] },
  ],
  driver: [
    { label: "Overview", items: [{ label: "Dashboard", to: "/dashboard/driver", icon: LayoutDashboard }] },
    { label: "Learning", items: [{ label: "Website Knowledge", to: "/dashboard/driver/website-knowledge", icon: BadgeCheck }] },
  ],
  extracurricular_staff: [
    { label: "Overview", items: [{ label: "Dashboard", to: "/dashboard/extracurricular", icon: LayoutDashboard }] },
    {
      label: "My Activities",
      items: [
        { label: "My Profile", to: "/dashboard/extracurricular/profile", icon: IdCard },
        { label: "Activities", to: "/dashboard/extracurricular/activities", icon: Sparkles },
        { label: "Students", to: "/dashboard/extracurricular/students", icon: Users },
        { label: "Timetable", to: "/dashboard/extracurricular/timetable", icon: CalendarClock },
        { label: "Schedule", to: "/dashboard/extracurricular/schedule", icon: CalendarClock },
      ],
    },
    {
      label: "Training",
      items: [
        { label: "Attendance", to: "/dashboard/extracurricular/attendance", icon: ClipboardList },
        { label: "Practice Work", to: "/dashboard/extracurricular/practice-work", icon: BookOpen },
        { label: "Events", to: "/dashboard/extracurricular/events", icon: CalendarCheck },
        { label: "Achievements", to: "/dashboard/extracurricular/achievements", icon: Trophy },
      ],
    },
    { label: "Learning", items: [{ label: "Website Knowledge", to: "/dashboard/extracurricular/website-knowledge", icon: BadgeCheck }] },
  ],
  // Admin/super_admin/principal use AdminSidebar + ADMIN_NAV_GROUPS instead — never rendered from here.
  school_admin: [],
  super_admin: [],
  principal: [],
  // No dedicated portal yet — land on /dashboard/profile only (see utils/roles.ts::ROLE_HOME_ROUTE).
  support_staff: [],
  accountant: [
    { label: "Overview", items: [{ label: "Dashboard", to: "/dashboard/accountant", icon: LayoutDashboard }] },
    { label: "Students", items: [{ label: "Students", to: "/dashboard/accountant/students", icon: Users }] },
    {
      label: "Fees",
      items: [
        { label: "Fee Management", to: "/dashboard/accountant/fees", icon: Wallet },
        { label: "Reports", to: "/dashboard/accountant/reports", icon: FileText },
      ],
    },
    { label: "Learning", items: [{ label: "Website Knowledge", to: "/dashboard/accountant/website-knowledge", icon: BadgeCheck }] },
    { label: "Profile", items: [{ label: "My Profile", to: "/dashboard/profile", icon: IdCard }] },
  ],
};
