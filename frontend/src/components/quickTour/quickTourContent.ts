import {
  BookOpen,
  Bus,
  Compass,
  GraduationCap,
  ShieldCheck,
  Sparkles,
  UserCog,
  Wallet,
  type LucideIcon,
} from "lucide-react";

export interface QuickTourSlide {
  role: string;
  label: string;
  icon: LucideIcon;
  accent: string;
  tagline: string;
  features: string[];
}

/**
 * One slide per role, mirroring each role's real nav config (layouts/components/navConfig.ts,
 * pages/admin/dashboard/shell/navConfig.ts, pages/superAdmin/shell/navConfig.ts) so this stays an
 * accurate summary of what the product does rather than separate marketing copy that can drift.
 * `support_staff` has no dedicated portal yet (lands on the generic profile page only), so it's
 * left out of the tour.
 */
export const QUICK_TOUR_SLIDES: QuickTourSlide[] = [
  {
    role: "super_admin",
    label: "Super Admin",
    icon: ShieldCheck,
    accent: "text-sky-500",
    tagline: "Runs the whole platform, across every school.",
    features: [
      "Platform-wide dashboard: schools, staff, and student totals",
      "Review and approve new school requests",
      "Create and manage schools, and each school's admins",
      "Full audit log of platform activity",
    ],
  },
  {
    role: "school_admin",
    label: "School Admin",
    icon: UserCog,
    accent: "text-blue-500",
    tagline: "Runs one school end to end.",
    features: [
      "Students, teachers, and extracurricular staff records",
      "Classes, sections, timetable, exams, and syllabus",
      "Fees, announcements, and transport",
      "Registration approvals, leave requests, and emergency alerts",
      "Users & roles, reports, and school settings",
    ],
  },
  {
    role: "principal",
    label: "Principal",
    icon: GraduationCap,
    accent: "text-violet-500",
    tagline: "Oversees academics and staff for their school.",
    features: [
      "Same academic, staff, and fee tools as School Admin",
      "Approves staff leave requests",
      "Reports across attendance, exams, and fees",
      "Cannot create schools or manage admin-tier accounts",
    ],
  },
  {
    role: "teacher",
    label: "Teacher",
    icon: BookOpen,
    accent: "text-teal-500",
    tagline: "Runs the classroom, day to day.",
    features: [
      "Attendance, homework, marks, and assessments",
      "Question papers and syllabus tracking",
      "Student registration approvals for their class",
      "Leave requests and transport info",
    ],
  },
  {
    role: "student",
    label: "Student",
    icon: GraduationCap,
    accent: "text-green-500",
    tagline: "One portal for every day of school.",
    features: [
      "Attendance, timetable, homework, and marks",
      "Exams, evaluated papers, and syllabus",
      "Fee details and live van tracking",
      "Extracurricular activities and learning games",
    ],
  },
  {
    role: "accountant",
    label: "Accountant",
    icon: Wallet,
    accent: "text-emerald-500",
    tagline: "Keeps school finances on track.",
    features: [
      "Student directory for fee reference",
      "Fee management: collection, dues, and receipts",
      "Financial reports",
    ],
  },
  {
    role: "driver",
    label: "Driver",
    icon: Bus,
    accent: "text-slate-500",
    tagline: "Keeps transport running and visible.",
    features: ["Route and trip dashboard", "Shares live location for parents and students to track"],
  },
  {
    role: "extracurricular_staff",
    label: "Extracurricular Staff",
    icon: Sparkles,
    accent: "text-amber-500",
    tagline: "Runs clubs, sports, and activities.",
    features: [
      "Activity rosters, schedule, and attendance",
      "Practice work and event planning",
      "Student achievements and awards",
    ],
  },
];

export const QUICK_TOUR_ICON = Compass;
