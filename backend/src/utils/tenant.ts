import { Request } from "express";
import { ApiError } from "./ApiError";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Resolves which school_id a request should operate on — the single choke
 * point every school-scoped endpoint goes through, and therefore the place
 * cross-tenant access is actually prevented. Frontend filtering is never
 * relied on: a hand-crafted request carrying someone else's school_id is
 * rejected here regardless of what the UI would have sent.
 *
 * Tiering (066_super_admin_multi_school.sql):
 *  - super_admin  — unbounded. May target any school by passing `school_id`
 *                   explicitly (body, query, then param, in that order).
 *  - school_admin — may target only a school in req.user.accessibleSchoolIds
 *                   (their own users.school_id plus their school_admin_schools
 *                   assignments). Targeting anything else is a 403, not a
 *                   silent fallback to their own school — failing loudly is
 *                   what makes an isolation regression visible in testing.
 *  - everyone else (principal, teacher, accountant, driver, EC staff,
 *                   student) — locked to their own school_id; any school_id
 *                   they pass is ignored rather than trusted.
 */
export function resolveSchoolId(req: Request): string {
  const user = req.user;
  if (!user) throw ApiError.unauthorized();

  const requested =
    (req.body?.school_id as string | undefined) ??
    (req.query?.school_id as string | undefined) ??
    (req.params?.schoolId as string | undefined);

  if (requested) {
    // A stale/garbage client-side value (e.g. leftover demo data) should
    // surface as a clean 400, not an opaque 500 from Postgres rejecting an
    // invalid uuid literal several layers down.
    if (!UUID_RE.test(requested)) {
      throw ApiError.badRequest(`Invalid school_id: "${requested}"`);
    }

    if (user.isSuperAdmin) return requested;

    if (canTargetSchool(user, requested)) return requested;

    // Only complain about an explicit cross-school attempt for a caller that
    // could legitimately have sent one. A principal's UI may still include a
    // school_id for its own school; anything else from them is ignored below.
    if (user.permissions.includes("schools.view_assigned")) {
      throw ApiError.forbidden("You do not have access to this school");
    }
  }

  if (!user.schoolId) {
    throw ApiError.badRequest("Your account is not associated with a school");
  }

  return user.schoolId;
}

/** True when this caller is allowed to act on `schoolId`. Super admins always are. */
export function canTargetSchool(
  user: NonNullable<Request["user"]>,
  schoolId: string
): boolean {
  if (user.isSuperAdmin) return true;
  return user.accessibleSchoolIds.includes(schoolId);
}

/**
 * Row-level guard for endpoints that take a school id in the path and act on
 * it directly (school profile, school stats, school settings). Throws rather
 * than returning a boolean so a caller can't forget to branch on the result.
 */
export function assertSchoolAccess(req: Request, schoolId: string): void {
  const user = req.user;
  if (!user) throw ApiError.unauthorized();
  if (!canTargetSchool(user, schoolId)) {
    throw ApiError.forbidden("You do not have access to this school");
  }
}
