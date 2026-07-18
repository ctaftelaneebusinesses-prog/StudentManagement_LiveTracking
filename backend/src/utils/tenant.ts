import { Request } from "express";
import { ApiError } from "./ApiError";

/**
 * Resolves which school_id a request should operate on.
 * - super_admin may target any school by passing `school_id` explicitly
 *   (body, query, or param — checked in that order).
 * - Everyone else is locked to their own school_id from the JWT-derived
 *   profile; a school_id they pass is ignored rather than trusted.
 */
export function resolveSchoolId(req: Request): string {
  const user = req.user;
  if (!user) throw ApiError.unauthorized();

  const isSuperAdmin = user.roles.includes("super_admin");
  const requested =
    (req.body?.school_id as string | undefined) ??
    (req.query?.school_id as string | undefined) ??
    (req.params?.schoolId as string | undefined);

  if (isSuperAdmin && requested) {
    return requested;
  }

  if (!user.schoolId) {
    throw ApiError.badRequest("Your account is not associated with a school");
  }

  return user.schoolId;
}
