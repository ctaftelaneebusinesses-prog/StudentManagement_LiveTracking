import { Request } from "express";
import { supabaseAdmin } from "../config/supabase";
import { logger } from "../config/logger";
import { ApiError } from "../utils/ApiError";

/**
 * The platform-wide audit trail for super_admin actions
 * (066_super_admin_multi_school.sql).
 *
 * Deliberately separate from auditLog.service.ts, which writes activity_logs —
 * that table's school_id is NOT NULL and every read filters by it, so it can't
 * represent an action that spans three schools at once (a cascade), or one
 * that belongs to no school at all (creating a school admin before any
 * assignment exists).
 */

export type PlatformAuditAction =
  | "school.created"
  | "school.updated"
  | "school.activated"
  | "school.deactivated"
  | "school.bulk_deactivated"
  | "school.bulk_activated"
  | "school.deleted"
  | "school_admin.created"
  | "school_admin.updated"
  | "school_admin.activated"
  | "school_admin.deactivated"
  | "school_admin.password_reset"
  | "school_admin.schools_assigned"
  | "school_admin.school_removed"
  | "school_request.created"
  | "school_request.approved"
  | "school_request.rejected";

interface PlatformAuditEntry {
  action: PlatformAuditAction;
  targetType?: "school" | "school_admin" | "user" | "assignment";
  targetId?: string | null;
  targetLabel?: string | null;
  schoolId?: string | null;
  schoolName?: string | null;
  status?: "success" | "failed";
  metadata?: Record<string, unknown>;
}

/**
 * Records one platform action. Never throws — an audit-write failure must not
 * roll back the administrative action it is describing (matching the existing
 * logActivity/logLoginAttempt contract in auditLog.service.ts).
 *
 * Actor name/email and school name are denormalised at write time so an entry
 * stays readable after the school or account it refers to is renamed.
 */
export async function logPlatformAction(req: Request, entry: PlatformAuditEntry): Promise<void> {
  try {
    const actor = req.user;
    let actorName: string | null = null;

    if (actor) {
      const { data } = await supabaseAdmin
        .from("users")
        .select("full_name")
        .eq("id", actor.id)
        .maybeSingle();
      actorName = data?.full_name ?? null;
    }

    const { error } = await supabaseAdmin.from("platform_audit_logs").insert({
      actor_user_id: actor?.id ?? null,
      actor_name: actorName,
      actor_email: actor?.email ?? null,
      action: entry.action,
      target_type: entry.targetType ?? null,
      target_id: entry.targetId ?? null,
      target_label: entry.targetLabel ?? null,
      school_id: entry.schoolId ?? null,
      school_name: entry.schoolName ?? null,
      status: entry.status ?? "success",
      metadata: entry.metadata ?? {},
    });

    if (error) logger.error({ error }, "Failed to write platform audit log entry");
  } catch (err) {
    logger.error({ err }, "Failed to write platform audit log entry");
  }
}

interface AuditLogFilters {
  page: number;
  pageSize: number;
  action?: string;
  schoolId?: string;
  search?: string;
  from?: string;
  to?: string;
}

export async function listPlatformAuditLog(filters: AuditLogFilters) {
  let query = supabaseAdmin
    .from("platform_audit_logs")
    .select(
      "id, action, actor_user_id, actor_name, actor_email, target_type, target_id, target_label, school_id, school_name, status, metadata, created_at",
      { count: "exact" }
    )
    .order("created_at", { ascending: false });

  if (filters.action) query = query.eq("action", filters.action);
  if (filters.schoolId) query = query.eq("school_id", filters.schoolId);
  if (filters.from) query = query.gte("created_at", filters.from);
  if (filters.to) query = query.lte("created_at", filters.to);
  if (filters.search) {
    const term = filters.search.replace(/[%,()]/g, "");
    query = query.or(
      `actor_name.ilike.%${term}%,actor_email.ilike.%${term}%,target_label.ilike.%${term}%,school_name.ilike.%${term}%`
    );
  }

  const from = (filters.page - 1) * filters.pageSize;
  query = query.range(from, from + filters.pageSize - 1);

  const { data, error, count } = await query;
  if (error) throw ApiError.internal(error.message);

  return { items: data ?? [], total: count ?? 0, page: filters.page, pageSize: filters.pageSize };
}

/** Distinct action codes present in the log — powers the audit page's filter dropdown. */
export async function listAuditActions(): Promise<string[]> {
  const { data, error } = await supabaseAdmin.from("platform_audit_logs").select("action");
  if (error) throw ApiError.internal(error.message);
  return Array.from(new Set((data ?? []).map((row) => row.action))).sort();
}
