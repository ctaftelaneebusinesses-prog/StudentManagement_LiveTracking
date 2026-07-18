export type RoleName =
  | "super_admin"
  | "school_admin"
  | "principal"
  | "teacher"
  | "parent"
  | "student"
  | "driver";

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
}

export interface AuthState {
  user: AppUser | null;
  /** All roles the user holds (from user_roles) — used for permission checks. */
  roleNames: RoleName[];
  /** Flattened permission codes across all held roles. */
  permissions: string[];
  isLoading: boolean;
}
