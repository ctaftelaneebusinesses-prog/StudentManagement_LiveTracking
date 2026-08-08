import { supabaseAdmin } from "../config/supabase";
import { ROLE_ID } from "../config/roles";
import { ApiError } from "./ApiError";

/**
 * Resolves every school_admin actually assigned to one school — multi-school
 * aware via school_admin_schools, NOT a plain `user_roles.eq('school_id',
 * schoolId)` filter.
 *
 * That older pattern (pre-066_super_admin_multi_school.sql) silently missed a
 * school_admin managing MORE than one school: their user_roles row only ever
 * carries their fixed "home" school_id, so a notification-worthy event in
 * their SECOND assigned school never matched it.
 *
 * Deliberately does NOT include super_admin. Product decision (2026-08-07):
 * super_admin only wants notifications for something a school_admin sends
 * THEM directly (the school-creation-request queue — see
 * schoolRequest.service.ts's own getSuperAdminIds/notify, which is separate
 * from this function on purpose) — not routine principal/teacher/student
 * activity at a school they don't manage day-to-day. An earlier version of
 * this function unioned in every super_admin platform-wide; that was
 * reverted here per explicit user feedback after shipping it, not restored.
 *
 * Every notification-fan-out call site that means "whoever administers this
 * school" (day-to-day, not the platform) should resolve recipients through
 * this function, not by filtering user_roles on school_id directly.
 */
export async function resolveSchoolAdminRecipientIds(schoolId: string): Promise<string[]> {
  const { data, error } = await supabaseAdmin
    .from("school_admin_schools")
    .select("user_id")
    .eq("school_id", schoolId);
  if (error) throw ApiError.internal(error.message);

  return Array.from(new Set((data ?? []).map((row) => row.user_id as string)));
}

/** Same as above, plus every principal at the school — principal is single-school, so a plain user_roles filter is still correct for them. */
export async function resolveSchoolAdminAndPrincipalRecipientIds(schoolId: string): Promise<string[]> {
  const [adminIds, principalResult] = await Promise.all([
    resolveSchoolAdminRecipientIds(schoolId),
    supabaseAdmin.from("user_roles").select("user_id").eq("school_id", schoolId).eq("role_id", ROLE_ID.PRINCIPAL),
  ]);
  if (principalResult.error) throw ApiError.internal(principalResult.error.message);

  return Array.from(new Set([...adminIds, ...(principalResult.data ?? []).map((row) => row.user_id as string)]));
}
