import { Bell, Building2, LayoutDashboard, MailQuestion, ScrollText, ShieldCheck, type LucideIcon } from "lucide-react";

export interface SuperAdminNavItem {
  label: string;
  to: string;
  icon: LucideIcon;
  /** Rendered as a plain link out of the platform console into the school-level one. */
  external?: boolean;
}

export interface SuperAdminNavGroup {
  label: string;
  items: SuperAdminNavItem[];
}

/**
 * The platform console's own navigation — deliberately small. Everything here
 * is cross-school; anything school-scoped lives in the Admin Console, which a
 * super_admin reaches through the "School Console" link at the bottom (the
 * school selector there lets them target any school).
 */
export const SUPER_ADMIN_NAV_GROUPS: SuperAdminNavGroup[] = [
  {
    label: "Platform",
    items: [
      { label: "Dashboard", to: "/dashboard/super-admin", icon: LayoutDashboard },
      { label: "Notifications", to: "/dashboard/super-admin/notifications", icon: Bell },
      { label: "Schools", to: "/dashboard/super-admin/schools", icon: Building2 },
      { label: "School Requests", to: "/dashboard/super-admin/school-requests", icon: MailQuestion },
      { label: "School Admins", to: "/dashboard/super-admin/school-admins", icon: ShieldCheck },
    ],
  },
  {
    label: "Oversight",
    items: [{ label: "Audit Log", to: "/dashboard/super-admin/audit-log", icon: ScrollText }],
  },
];
