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
