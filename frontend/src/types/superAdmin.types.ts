/** Types for the platform tier — super_admin only (066_super_admin_multi_school.sql). */

export interface PlatformTotals {
  totalSchools: number;
  activeSchools: number;
  inactiveSchools: number;
  totalSchoolAdmins: number;
  activeSchoolAdmins: number;
  totalPrincipals: number;
  totalTeachers: number;
  totalStudents: number;
  totalAccountants: number;
  totalDrivers: number;
  totalExtracurricularStaff: number;
  totalSupportStaff: number;
  /**
   * Distinct guardian contacts on student profiles — NOT an account count.
   * The parent role was removed in 064_remove_parent_role.sql; parents sign in
   * through their child's student account, so no parent accounts exist.
   */
  parentContacts: number;
}

export interface GrowthPoint {
  month: string;
  added: number;
  total: number;
}

export interface PlatformDashboard {
  totals: PlatformTotals;
  charts: {
    schoolsByStatus: { name: string; value: number }[];
    usersByRole: { role: string; count: number }[];
    studentsBySchool: { schoolId: string; schoolName: string; students: number }[];
    schoolGrowth: GrowthPoint[];
    userGrowth: GrowthPoint[];
  };
}

export interface SchoolCounts {
  students: number;
  teachers: number;
  principals: number;
  accountants: number;
  drivers: number;
  extracurricularStaff: number;
  classes: number;
  sections: number;
  totalUsers: number;
}

export interface SchoolAdminSummary {
  id: string;
  full_name: string;
  email: string;
  is_active: boolean;
}

export interface PlatformSchool {
  id: string;
  name: string;
  code: string;
  logo_url: string | null;
  city: string | null;
  district: string | null;
  state: string | null;
  country: string | null;
  pin_code: string | null;
  address: string | null;
  phone: string | null;
  email: string | null;
  principal_name: string | null;
  is_active: boolean;
  cascade_suspended: boolean;
  created_at: string;
  admins: SchoolAdminSummary[];
  counts: SchoolCounts;
}

export interface AssignedSchool {
  id: string;
  name: string;
  code: string;
  is_active: boolean;
  logo_url: string | null;
}

export interface SchoolAdmin {
  id: string;
  full_name: string;
  email: string;
  phone: string | null;
  avatar_url: string | null;
  designation: string | null;
  is_active: boolean;
  cascade_suspended: boolean;
  school_id: string | null;
  created_at: string;
  schools: AssignedSchool[];
}

export interface SchoolOverview {
  school: PlatformSchool & Record<string, unknown>;
  counts: SchoolCounts;
  admins: SchoolAdminSummary[];
  principal: {
    id: string;
    full_name: string;
    email: string;
    phone: string | null;
    is_active: boolean;
    avatar_url: string | null;
  } | null;
}

/** What a confirmation dialog shows before anything is changed (§21). */
export interface SchoolsImpact {
  schools: { id: string; name: string; code: string; is_active: boolean }[];
  affectedSchools: number;
  affectedUsers: number;
}

export interface SchoolAdminImpact {
  admin: { id: string; full_name: string; email: string };
  schools: AssignedSchool[];
  affectedSchools: number;
  affectedUsers: number;
}

export interface CreateSchoolAdminInput {
  full_name: string;
  email: string;
  phone?: string;
  designation?: string;
  avatar_url?: string;
  password: string;
  school_ids: string[];
}

export interface AuditLogEntry {
  id: string;
  action: string;
  actor_user_id: string | null;
  actor_name: string | null;
  actor_email: string | null;
  target_type: string | null;
  target_id: string | null;
  target_label: string | null;
  school_id: string | null;
  school_name: string | null;
  status: "success" | "failed";
  metadata: Record<string, unknown>;
  created_at: string;
}

export interface AuditLogPage {
  items: AuditLogEntry[];
  total: number;
  page: number;
  pageSize: number;
}
