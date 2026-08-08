import { Request } from "express";
import { ApiError } from "./ApiError";
import { canTargetSchool } from "./tenant";

/**
 * Authorizes reading a single school's profile/stats.
 *
 * Unlike the router-level `requirePermission("platform.manage_schools")` guard
 * on the platform-wide list/CRUD endpoints (super_admin only since
 * 066_super_admin_multi_school.sql), this is a row-level check, so it also
 * covers the two roles that legitimately read *a* school without holding any
 * platform permission:
 *   - school_admin — any school in their school_admin_schools assignments
 *   - principal / all other roles — their own school, and nothing else
 */
export function assertCanViewSchool(req: Request, schoolId: string): void {
  const user = req.user;
  if (!user) throw ApiError.unauthorized();
  if (canTargetSchool(user, schoolId)) return;
  throw ApiError.forbidden("You do not have access to this school");
}
