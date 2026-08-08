import { supabaseAdmin } from "../config/supabase";
import { logger } from "../config/logger";
import { ApiError } from "../utils/ApiError";

interface LoginAttemptMeta {
  ip?: string | null;
  userAgent?: string | null;
  userId?: string;
  schoolId?: string;
}

/**
 * Records one login attempt (success or failure). Never throws — a logging
 * failure must never break the login flow it's observing. When userId/
 * schoolId aren't already known (e.g. a failed attempt before we've loaded
 * the profile), resolves them from the email so failed attempts are still
 * attributable to a school for admins reviewing their own history.
 */
export async function logLoginAttempt(email: string, success: boolean, meta: LoginAttemptMeta = {}) {
  try {
    let { userId, schoolId } = meta;
    if (!userId || !schoolId) {
      const { data } = await supabaseAdmin.from("users").select("id, school_id").eq("email", email).maybeSingle();
      userId = userId ?? data?.id ?? undefined;
      schoolId = schoolId ?? data?.school_id ?? undefined;
    }

    const { error } = await supabaseAdmin.from("login_history").insert({
      school_id: schoolId ?? null,
      user_id: userId ?? null,
      email,
      success,
      ip_address: meta.ip ?? null,
      user_agent: meta.userAgent ?? null,
    });
    if (error) logger.error({ error }, "Failed to record login attempt");
  } catch (err) {
    logger.error({ err }, "Failed to record login attempt");
  }
}

interface ActivityMeta {
  targetType?: string;
  targetId?: string;
  metadata?: Record<string, unknown>;
}

/** Records one curated admin action. Never throws — see logLoginAttempt. */
export async function logActivity(schoolId: string, actorUserId: string | null, action: string, meta: ActivityMeta = {}) {
  try {
    const { error } = await supabaseAdmin.from("activity_logs").insert({
      school_id: schoolId,
      actor_user_id: actorUserId,
      action,
      target_type: meta.targetType ?? null,
      target_id: meta.targetId ?? null,
      metadata: meta.metadata ?? {},
    });
    if (error) logger.error({ error }, "Failed to record activity log entry");
  } catch (err) {
    logger.error({ err }, "Failed to record activity log entry");
  }
}

export async function listLoginHistory(schoolId: string, { page, pageSize }: { page: number; pageSize: number }) {
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;
  const { data, error, count } = await supabaseAdmin
    .from("login_history")
    .select("id, email, success, ip_address, user_agent, created_at, users(full_name)", { count: "exact" })
    .eq("school_id", schoolId)
    .order("created_at", { ascending: false })
    .range(from, to);
  if (error) throw ApiError.internal(error.message);
  return { items: data ?? [], total: count ?? 0, page, pageSize };
}

export async function listActivityLog(schoolId: string, { page, pageSize }: { page: number; pageSize: number }) {
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;
  const { data, error, count } = await supabaseAdmin
    .from("activity_logs")
    .select("id, action, target_type, target_id, metadata, created_at, users(full_name)", { count: "exact" })
    .eq("school_id", schoolId)
    .order("created_at", { ascending: false })
    .range(from, to);
  if (error) throw ApiError.internal(error.message);
  return { items: data ?? [], total: count ?? 0, page, pageSize };
}
