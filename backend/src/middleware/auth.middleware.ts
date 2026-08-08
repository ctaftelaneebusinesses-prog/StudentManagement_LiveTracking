import { NextFunction, Request, Response } from "express";
import { supabaseAdmin, createUserScopedClient } from "../config/supabase";
import { ApiError } from "../utils/ApiError";

/**
 * Verifies the Supabase-issued JWT sent as `Authorization: Bearer <token>`
 * and attaches req.user/req.supabase. Shared by requireAuth and
 * requireAuthAllowUnapproved below — the only difference is whether a
 * non-'approved' users.status (see 061_registration_approval.sql) blocks
 * the request or not.
 */
async function loadAuthenticatedUser(req: Request, enforceApproval: boolean): Promise<void> {
  const header = req.headers.authorization;
  if (!header?.startsWith("Bearer ")) {
    throw ApiError.unauthorized("Missing or malformed Authorization header");
  }

  const token = header.slice("Bearer ".length);
  const { data: authData, error: authError } = await supabaseAdmin.auth.getUser(token);

  if (authError || !authData.user) {
    throw ApiError.unauthorized("Invalid or expired session");
  }

  const userId = authData.user.id;

  // The `schools!users_school_id_fkey` hint is REQUIRED, not cosmetic: since
  // 066_super_admin_multi_school.sql added school_admin_schools (which
  // references both users and schools), PostgREST sees two relationship paths
  // between users and schools — the direct FK and the new junction — and an
  // unqualified `schools(...)` embed becomes ambiguous, failing the whole
  // query. That surfaces here as a bogus "User profile not found" 401 on
  // every authenticated request.
  //
  // Naming the constraint also collapses supabase-js's select-type inference
  // (see the codebase-wide pattern in homework.service.ts), hence the
  // explicit row interface + cast below rather than relying on inference.
  const { data: profileRow, error: profileError } = await supabaseAdmin
    .from("users")
    .select(
      "id, email, school_id, role_id, status, is_active, roles(name), schools!users_school_id_fkey(is_active, name)"
    )
    .eq("id", userId)
    .single();

  // Only "no matching row" genuinely means the token doesn't correspond to a
  // real user (401). Any other error here — network blip, PostgREST hiccup,
  // DB timeout — is a transient failure, not proof the session is invalid,
  // and must not be reported as 401: the frontend's axios interceptor signs
  // the user out on every 401, so misclassifying a transient error here was
  // forcing logged-in users back to /login without ever touching Logout.
  if (profileError && profileError.code !== "PGRST116") {
    throw ApiError.internal("Failed to load user profile");
  }
  if (profileError || !profileRow) {
    throw ApiError.unauthorized("User profile not found");
  }

  const profile = profileRow as unknown as {
    id: string;
    email: string;
    school_id: string | null;
    role_id: number;
    status: string;
    is_active: boolean;
    roles: { name: string };
    schools: { is_active: boolean; name: string } | null;
  };

  const status = profile.status;
  if (enforceApproval && status !== "approved") {
    const err = ApiError.forbidden(
      status === "pending"
        ? "Your account is awaiting approval. Please wait until your registration request is approved."
        : "Your registration request has been rejected. Please contact your school administrator for more information."
    );
    (err as ApiError & { code?: string }).code = status === "pending" ? "ACCOUNT_PENDING" : "ACCOUNT_REJECTED";
    throw err;
  }

  // All roles this user holds (a person may be e.g. both teacher and parent).
  const { data: roleRows, error: roleError } = await supabaseAdmin
    .from("user_roles")
    .select("role_id, roles(name)")
    .eq("user_id", userId);

  if (roleError) {
    throw ApiError.internal("Failed to load user roles");
  }

  const roleIds = (roleRows ?? []).map((row) => row.role_id);
  const roles = (roleRows ?? []).map(
    (row) => (row as unknown as { roles: { name: string } }).roles.name
  );
  const isSuperAdmin = roles.includes("super_admin");

  // Access gates (066_super_admin_multi_school.sql). Deliberately AFTER the
  // role load so a super_admin is never locked out by their own home school
  // being deactivated — a platform operator must always be able to get back
  // in to reverse it. Both checks run on every request, not just at login, so
  // revoking access takes effect immediately for sessions already issued.
  if (enforceApproval && !isSuperAdmin) {
    const account = profile;

    // School first — see the same ordering note in auth.service.ts: after a
    // cascade both flags are off, and the school is the real reason.
    if (account.schools && account.schools.is_active === false) {
      const err = ApiError.forbidden(
        `${account.schools.name} is currently inactive. Please contact your administrator.`
      );
      (err as ApiError & { code?: string }).code = "SCHOOL_INACTIVE";
      throw err;
    }

    if (!account.is_active) {
      const err = ApiError.forbidden(
        "Your account has been deactivated. Please contact your school administrator."
      );
      (err as ApiError & { code?: string }).code = "ACCOUNT_DEACTIVATED";
      throw err;
    }
  }

  // Multi-school reach for a school_admin. A super_admin is unbounded, so the
  // list stays empty and callers must branch on isSuperAdmin (see
  // utils/tenant.ts::resolveSchoolId) rather than treating [] as "no access".
  let accessibleSchoolIds: string[] = [];
  if (!isSuperAdmin) {
    const { data: assignmentRows, error: assignmentError } = await supabaseAdmin
      .from("school_admin_schools")
      .select("school_id")
      .eq("user_id", userId);

    if (assignmentError) {
      throw ApiError.internal("Failed to load school assignments");
    }

    accessibleSchoolIds = Array.from(
      new Set(
        [profile.school_id, ...(assignmentRows ?? []).map((row) => row.school_id)].filter(
          (id): id is string => Boolean(id)
        )
      )
    );
  }

  // Flattened, de-duplicated permission codes across all of those roles.
  let permissions: string[] = [];
  if (roleIds.length > 0) {
    const { data: permissionRows, error: permissionError } = await supabaseAdmin
      .from("role_permissions")
      .select("permissions(code)")
      .in("role_id", roleIds);

    if (permissionError) {
      throw ApiError.internal("Failed to load user permissions");
    }

    permissions = Array.from(
      new Set(
        (permissionRows ?? []).map(
          (row) => (row as unknown as { permissions: { code: string } }).permissions.code
        )
      )
    );
  }

  req.user = {
    id: profile.id,
    email: profile.email,
    schoolId: profile.school_id,
    roleId: profile.role_id,
    roleName: profile.roles.name,
    roles,
    permissions,
    isSuperAdmin,
    accessibleSchoolIds,
    status: status as "pending" | "approved" | "rejected",
  };
  req.supabase = createUserScopedClient(token);
}

/**
 * Verifies the Supabase-issued JWT sent as `Authorization: Bearer <token>`.
 * On success, attaches:
 *  - req.user: identity, primary role, all assigned roles, and flattened
 *    permission codes (read from public.users / user_roles / role_permissions)
 *  - req.supabase: a client scoped to that user's token, so every downstream
 *    query goes through Postgres RLS as that user, never as an admin.
 * Rejects a 'pending'/'rejected' account (see 061_registration_approval.sql)
 * — the real approval-workflow gate. Use requireAuthAllowUnapproved instead
 * for the one route (GET /auth/me) that a not-yet-approved account must
 * still be able to call, to read its own status.
 */
export async function requireAuth(req: Request, _res: Response, next: NextFunction) {
  try {
    await loadAuthenticatedUser(req, true);
    next();
  } catch (err) {
    next(err);
  }
}

/** Same as requireAuth, but does not reject a pending/rejected account — see loadAuthenticatedUser. Only use on routes a not-yet-approved user must still reach. */
export async function requireAuthAllowUnapproved(req: Request, _res: Response, next: NextFunction) {
  try {
    await loadAuthenticatedUser(req, false);
    next();
  } catch (err) {
    next(err);
  }
}

/** Restricts a route to callers holding at least one of the given roles. */
export function requireRole(...allowedRoles: string[]) {
  return (req: Request, _res: Response, next: NextFunction) => {
    if (!req.user) {
      return next(ApiError.unauthorized());
    }
    const hasAllowedRole = req.user.roles.some((role) => allowedRoles.includes(role));
    if (!hasAllowedRole) {
      return next(ApiError.forbidden(`Requires one of roles: ${allowedRoles.join(", ")}`));
    }
    next();
  };
}

/** Restricts a route to callers holding a specific permission code. */
export function requirePermission(permissionCode: string) {
  return (req: Request, _res: Response, next: NextFunction) => {
    if (!req.user) {
      return next(ApiError.unauthorized());
    }
    if (!req.user.permissions.includes(permissionCode)) {
      return next(ApiError.forbidden(`Requires permission: ${permissionCode}`));
    }
    next();
  };
}
