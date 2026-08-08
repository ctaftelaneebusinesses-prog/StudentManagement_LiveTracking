import { Request } from "express";
import { ApiError } from "./ApiError";

const ADMIN_TIER_ROLES = ["school_admin", "super_admin", "principal"];

/**
 * Staff-directory audiences (Principal, Accountants, Extracurricular Staff)
 * are restricted to Admin/Principal — a teacher (who also holds
 * announcements.manage) must not be able to page these groups via a mass
 * announcement. No-op for unrestricted audiences.
 */
const RESTRICTED_AUDIENCE_TYPES = ["principal", "accountants", "extracurricular_staff", "specific_extracurricular_staff"];

export function assertMayTargetRestrictedAudience(req: Request, audienceType: string): void {
  if (!RESTRICTED_AUDIENCE_TYPES.includes(audienceType)) return;
  const roles = req.user?.roles ?? [];
  if (roles.some((r) => ADMIN_TIER_ROLES.includes(r))) return;
  throw ApiError.forbidden("Only an Admin or Principal can send an announcement to this audience");
}
