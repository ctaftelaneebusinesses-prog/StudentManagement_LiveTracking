export type RoleName =
  | "super_admin"
  | "school_admin"
  | "principal"
  | "teacher"
  | "student"
  | "driver"
  | "support_staff"
  | "accountant"
  | "extracurricular_staff";

export interface AppUser {
  id: string;
  full_name: string;
  email: string;
  school_id: string | null;
  phone: string | null;
  /** Primary role — used only for the default post-login redirect. */
  role_id: number;
  avatar_url: string | null;
  roles: { name: RoleName };
  /** Approval-workflow status (061_registration_approval.sql). Admin-created accounts are always 'approved'; only self-registered accounts start 'pending'. */
  status?: "pending" | "approved" | "rejected";
}

export interface AuthState {
  user: AppUser | null;
  /** All roles the user holds (from user_roles) — used for permission checks. */
  roleNames: RoleName[];
  /** Flattened permission codes across all held roles. */
  permissions: string[];
  isLoading: boolean;
}
