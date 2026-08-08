import { supabaseAdmin } from "../config/supabase";
import { ApiError } from "../utils/ApiError";
import { notifyUsers } from "./notification.service";
import { QuizRole } from "../config/websiteKnowledge";

/**
 * Resolves who should be notified when a given role completes the Website
 * Knowledge quiz, per the fixed hierarchy (spec §15-21):
 *   student -> their class's homeroom teacher
 *   teacher -> the principal(s) of their school
 *   principal -> the school_admin(s) assigned to their school
 *   school_admin -> every super_admin (platform-wide, no school context)
 *   accountant / driver / extracurricular_staff -> the principal(s) of their
 *     school (not explicitly named in the spec's hierarchy diagram, but they
 *     report to the same school leadership as a teacher does)
 */
export async function resolveNotificationRecipients(roleName: QuizRole, userId: string, schoolId: string | null): Promise<string[]> {
  if (roleName === "student") {
    const { data: student, error } = await supabaseAdmin.from("students").select("class_id").eq("id", userId).maybeSingle();
    if (error) throw ApiError.internal(error.message);
    if (!student?.class_id) return [];

    const { data: klass, error: classError } = await supabaseAdmin
      .from("classes")
      .select("class_teacher_id")
      .eq("id", student.class_id)
      .maybeSingle();
    if (classError) throw ApiError.internal(classError.message);
    return klass?.class_teacher_id ? [klass.class_teacher_id as string] : [];
  }

  if (roleName === "school_admin") {
    const { data, error } = await supabaseAdmin
      .from("user_roles")
      .select("user_id, roles!inner(name)")
      .eq("roles.name", "super_admin");
    if (error) throw ApiError.internal(error.message);
    return Array.from(new Set((data ?? []).map((r) => r.user_id as string)));
  }

  // teacher / principal / accountant / driver / extracurricular_staff all
  // escalate to their school's principal(s) (roleName === "principal" would
  // escalate to school_admin instead — handled below).
  if (!schoolId) return [];

  const escalateToRole = roleName === "principal" ? "school_admin" : "principal";

  if (escalateToRole === "school_admin") {
    const { data, error } = await supabaseAdmin
      .from("school_admin_schools")
      .select("user_id")
      .eq("school_id", schoolId);
    if (error) throw ApiError.internal(error.message);
    const assigned = (data ?? []).map((r) => r.user_id as string);
    if (assigned.length > 0) return Array.from(new Set(assigned));

    // Fallback: a school_admin's home school (users.school_id) predates
    // school_admin_schools assignment in some seed data — see 066's backfill.
    const { data: home, error: homeError } = await supabaseAdmin
      .from("user_roles")
      .select("user_id, roles!inner(name)")
      .eq("roles.name", "school_admin");
    if (homeError) throw ApiError.internal(homeError.message);
    const { data: homeUsers, error: homeUsersError } = await supabaseAdmin
      .from("users")
      .select("id")
      .eq("school_id", schoolId)
      .in(
        "id",
        (home ?? []).map((r) => r.user_id as string)
      );
    if (homeUsersError) throw ApiError.internal(homeUsersError.message);
    return Array.from(new Set((homeUsers ?? []).map((u) => u.id as string)));
  }

  const { data, error } = await supabaseAdmin
    .from("user_roles")
    .select("user_id, roles!inner(name)")
    .eq("roles.name", "principal");
  if (error) throw ApiError.internal(error.message);
  const principalIds = (data ?? []).map((r) => r.user_id as string);
  if (principalIds.length === 0) return [];

  const { data: schoolPrincipals, error: spError } = await supabaseAdmin
    .from("users")
    .select("id")
    .eq("school_id", schoolId)
    .in("id", principalIds);
  if (spError) throw ApiError.internal(spError.message);
  return Array.from(new Set((schoolPrincipals ?? []).map((u) => u.id as string)));
}

/**
 * Idempotent completion notification: inserts into
 * website_knowledge_notification_log first (unique on attempt_id +
 * recipient_user_id) and only actually sends when that insert wasn't a
 * conflict — notification.service.ts has no dedup of its own, so this is the
 * one place that guarantees "one event -> one notification per recipient"
 * (spec §37), safe even if completeAttempt is ever called twice for the
 * same attempt (retried request, double-click, etc).
 */
export async function notifyCompletionOnce(
  attemptId: string,
  recipientIds: string[],
  schoolId: string | null,
  createdBy: string,
  input: { title: string; message: string; metadata: Record<string, unknown> }
) {
  if (recipientIds.length === 0) return;

  const rows = recipientIds.map((recipient_user_id) => ({ attempt_id: attemptId, recipient_user_id }));
  const { data: inserted, error } = await supabaseAdmin
    .from("website_knowledge_notification_log")
    .upsert(rows, { onConflict: "attempt_id,recipient_user_id", ignoreDuplicates: true })
    .select("recipient_user_id");
  if (error) throw ApiError.internal(error.message);

  const freshRecipientIds = (inserted ?? []).map((r) => r.recipient_user_id as string);
  if (freshRecipientIds.length === 0) return; // already notified for this attempt

  await notifyUsers(schoolId, createdBy, freshRecipientIds, {
    title: input.title,
    message: input.message,
    type: "website_knowledge_completed",
    metadata: input.metadata,
  });
}
