import { RoleName } from "@/types/auth.types";

/** Default landing route per role, used right after login. */
export const ROLE_HOME_ROUTE: Record<RoleName, string> = {
  super_admin: "/dashboard/super-admin",
  school_admin: "/dashboard/school-admin",
  principal: "/dashboard/principal",
  teacher: "/dashboard/teacher",
  parent: "/dashboard/parent",
  student: "/dashboard/student",
  driver: "/dashboard/driver",
};

export const ROLE_LABEL: Record<RoleName, string> = {
  super_admin: "Super Admin",
  school_admin: "School Admin",
  principal: "Principal",
  teacher: "Teacher",
  parent: "Parent",
  student: "Student",
  driver: "Driver",
};

/** Mirrors the fixed `public.roles` seed (database/migrations/002_rbac_permissions.sql). */
export const ROLE_ID: Record<RoleName, number> = {
  school_admin: 1,
  principal: 2,
  teacher: 3,
  parent: 4,
  student: 5,
  driver: 6,
  super_admin: 7,
};

export const ASSIGNABLE_ROLE_OPTIONS = (
  ["principal", "teacher", "parent", "student", "driver"] as RoleName[]
).map((role) => ({ value: String(ROLE_ID[role]), label: ROLE_LABEL[role] }));
