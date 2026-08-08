import { SupabaseClient } from "@supabase/supabase-js";

export interface AuthenticatedUser {
  id: string;
  email: string;
  schoolId: string | null;
  /** Primary role — drives the default post-login dashboard redirect. */
  roleId: number;
  roleName: string;
  /** All roles assigned via user_roles (a user may hold more than one). */
  roles: string[];
  /** Flattened permission codes across all of the user's assigned roles. */
  permissions: string[];
  /** True when the caller holds the super_admin role — the only tier with cross-school reach. */
  isSuperAdmin: boolean;
  /**
   * Every school this caller may act on (066_super_admin_multi_school.sql):
   * their own users.school_id plus any school_admin_schools assignments.
   * EMPTY for a super_admin — they are unbounded, so an allow-list would be
   * meaningless; check isSuperAdmin first. See utils/tenant.ts::resolveSchoolId.
   */
  accessibleSchoolIds: string[];
  /** Approval-workflow status (061_registration_approval.sql) — 'pending'/'rejected' only ever reaches req.user via requireAuthAllowUnapproved (GET /auth/me). */
  status: "pending" | "approved" | "rejected";
}

declare global {
  namespace Express {
    interface Request {
      /** Populated by auth.middleware.ts after verifying the bearer JWT. */
      user?: AuthenticatedUser;
      /** Request-scoped Supabase client authenticated as req.user, respects RLS. */
      supabase?: SupabaseClient;
    }
  }
}

export {};
