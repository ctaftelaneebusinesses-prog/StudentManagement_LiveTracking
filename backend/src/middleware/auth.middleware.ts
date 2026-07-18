import { NextFunction, Request, Response } from "express";
import { supabaseAdmin, createUserScopedClient } from "../config/supabase";
import { ApiError } from "../utils/ApiError";

/**
 * Verifies the Supabase-issued JWT sent as `Authorization: Bearer <token>`.
 * On success, attaches:
 *  - req.user: identity, primary role, all assigned roles, and flattened
 *    permission codes (read from public.users / user_roles / role_permissions)
 *  - req.supabase: a client scoped to that user's token, so every downstream
 *    query goes through Postgres RLS as that user, never as an admin.
 */
export async function requireAuth(req: Request, _res: Response, next: NextFunction) {
  try {
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

    const { data: profile, error: profileError } = await supabaseAdmin
      .from("users")
      .select("id, email, school_id, role_id, roles(name)")
      .eq("id", userId)
      .single();

    if (profileError || !profile) {
      throw ApiError.unauthorized("User profile not found");
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
      roleName: (profile as unknown as { roles: { name: string } }).roles.name,
      roles,
      permissions,
    };
    req.supabase = createUserScopedClient(token);

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
