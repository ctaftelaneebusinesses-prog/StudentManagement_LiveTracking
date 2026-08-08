import { supabaseAdmin } from "../config/supabase";
import { ApiError } from "../utils/ApiError";
import { logger } from "../config/logger";
import { ROLE_ID } from "../config/roles";
import { assertNotPastLeaveDate } from "../utils/leaveDate";
import { resolveSchoolAdminRecipientIds } from "../utils/notificationRecipients";
import * as notificationService from "./notification.service";
import * as pushService from "./push.service";

const LEAVE_REQUEST_SELECT =
  "id, teacher_id, applicant_role, leave_type, start_date, end_date, reason, status, reviewed_by, reviewed_by_role, reviewed_at, created_at";

type LeaveType = "casual" | "sick" | "other";
type ApplicantRole = "teacher" | "principal";

/**
 * `leave_requests` has three FKs to `users` (teacher_id, reviewed_by,
 * created_by), which makes an embedded `users(...)` select ambiguous.
 * PostgREST's `!fkey_name` disambiguation hint depends on its schema cache
 * having picked up the FK — that lags (sometimes indefinitely, until a
 * manual "reload schema") right after a migration renames/re-points a
 * constraint, which is exactly what 034_leave_requests_dual_approval.sql
 * does. Resolving the applicant's name as a second, plain query instead
 * sidesteps PostgREST relationship resolution entirely.
 */
interface LeaveRequestRow {
  id: string;
  teacher_id: string;
  applicant_role: ApplicantRole;
  leave_type: LeaveType;
  start_date: string;
  end_date: string;
  reason: string | null;
  status: "pending" | "approved" | "rejected";
  reviewed_by: string | null;
  reviewed_by_role: string | null;
  reviewed_at: string | null;
  created_at: string;
  users: { full_name: string; email: string } | null;
}

async function attachApplicantNames<T extends { teacher_id: string }>(rows: T[]): Promise<(T & { users: { full_name: string; email: string } | null })[]> {
  const teacherIds = Array.from(new Set(rows.map((r) => r.teacher_id)));
  if (teacherIds.length === 0) return rows.map((r) => ({ ...r, users: null }));

  const { data, error } = await supabaseAdmin.from("users").select("id, full_name, email").in("id", teacherIds);
  if (error) throw ApiError.internal(error.message);

  const byId = new Map((data ?? []).map((u) => [u.id as string, { full_name: u.full_name as string, email: u.email as string }]));
  return rows.map((r) => ({ ...r, users: byId.get(r.teacher_id) ?? null }));
}

interface LeavePolicy {
  casual: number;
  sick: number;
  other: number;
}

const DEFAULT_LEAVE_POLICY: LeavePolicy = { casual: 12, sick: 10, other: 5 };

function inclusiveDayCount(startDate: string, endDate: string): number {
  const start = new Date(`${startDate}T00:00:00Z`);
  const end = new Date(`${endDate}T00:00:00Z`);
  return Math.max(1, Math.round((end.getTime() - start.getTime()) / 86_400_000) + 1);
}

interface ListLeaveRequestsFilters {
  teacherId?: string;
  status?: "pending" | "approved" | "rejected";
  applicantRole?: ApplicantRole;
  page: number;
  pageSize: number;
  /** When the caller is a principal, force-scope to teacher-applied requests — principals have no visibility into principal leave (see reviewLeaveRequest's symmetrical guard). */
  viewerRole?: string;
}

async function assertTeacherInSchool(schoolId: string, teacherId: string): Promise<void> {
  const { data, error } = await supabaseAdmin
    .from("teachers")
    .select("id")
    .eq("id", teacherId)
    .eq("school_id", schoolId)
    .maybeSingle();
  if (error) throw ApiError.internal(error.message);
  if (!data) throw ApiError.notFound("Teacher not found");
}

/** Resolves every user holding a given role at this school, via `user_roles` (multi-role aware) — mirrors announcement.service.ts's principal-audience lookup. */
async function resolveUserIdsByRole(schoolId: string, roleId: number): Promise<string[]> {
  const { data, error } = await supabaseAdmin
    .from("user_roles")
    .select("user_id")
    .eq("school_id", schoolId)
    .eq("role_id", roleId);
  if (error) throw ApiError.internal(error.message);
  return (data ?? []).map((r) => r.user_id as string);
}

export async function listLeaveRequests(schoolId: string, filters: ListLeaveRequestsFilters) {
  let query = supabaseAdmin
    .from("leave_requests")
    .select(LEAVE_REQUEST_SELECT, { count: "exact" })
    .eq("school_id", schoolId)
    .order("created_at", { ascending: false });

  if (filters.teacherId) query = query.eq("teacher_id", filters.teacherId);
  if (filters.status) query = query.eq("status", filters.status);
  if (filters.applicantRole) query = query.eq("applicant_role", filters.applicantRole);
  // A principal reviews teacher leave only — they have no view into other
  // principals' leave requests at all (only true admin/super_admin do).
  // Overrides any applicantRole the client asked for.
  if (filters.viewerRole === "principal") query = query.eq("applicant_role", "teacher");

  const from = (filters.page - 1) * filters.pageSize;
  const to = from + filters.pageSize - 1;
  query = query.range(from, to);

  const { data, error, count } = await query;
  if (error) throw ApiError.internal(error.message);
  const items = await attachApplicantNames((data ?? []) as unknown as LeaveRequestRow[]);
  return { items, total: count ?? 0, page: filters.page, pageSize: filters.pageSize };
}

export async function listForTeacher(schoolId: string, teacherId: string) {
  await assertTeacherInSchool(schoolId, teacherId);

  const { data, error } = await supabaseAdmin
    .from("leave_requests")
    .select(LEAVE_REQUEST_SELECT)
    .eq("school_id", schoolId)
    .eq("teacher_id", teacherId)
    .order("created_at", { ascending: false });
  if (error) throw ApiError.internal(error.message);
  return attachApplicantNames((data ?? []) as unknown as LeaveRequestRow[]);
}

/** Admin logs a leave request on a teacher's behalf — always starts "pending" pending review. */
export async function createLeaveRequest(
  schoolId: string,
  createdBy: string,
  input: { teacher_id: string; start_date: string; end_date: string; reason?: string; leave_type?: LeaveType }
) {
  await assertTeacherInSchool(schoolId, input.teacher_id);

  const { data, error } = await supabaseAdmin
    .from("leave_requests")
    .insert({
      school_id: schoolId,
      teacher_id: input.teacher_id,
      leave_type: input.leave_type ?? "other",
      start_date: input.start_date,
      end_date: input.end_date,
      reason: input.reason,
      created_by: createdBy,
    })
    .select(LEAVE_REQUEST_SELECT)
    .single();
  if (error) throw ApiError.internal(error.message);
  const [row] = await attachApplicantNames([data as unknown as LeaveRequestRow]);
  return row;
}

/**
 * Notifies the right reviewer(s) once a teacher/principal leave request is
 * filed — fire-and-forget, same pattern homework.service.ts uses for
 * homework-created notifications. Teacher leave routes to the principal only
 * (not admin — admin can still see/act on it via the Leave Requests console,
 * but doesn't need a notification for every one); principal leave routes to
 * admin/super_admin only, and never back to the applying principal.
 */
async function notifyOnApply(schoolId: string, applicantId: string, applicantRole: ApplicantRole, leaveRequestId: string) {
  try {
    // Multi-school- and super_admin-aware — see utils/notificationRecipients.ts.
    // This is the exact path that used to silently skip super_admin: a
    // principal applying for leave notifies "admin", and the old per-school
    // user_roles filter almost never matched a super_admin's row.
    const recipientIds =
      applicantRole === "principal"
        ? await resolveSchoolAdminRecipientIds(schoolId)
        : await resolveUserIdsByRole(schoolId, ROLE_ID.PRINCIPAL);
    if (recipientIds.length === 0) return;

    const title =
      applicantRole === "principal" ? "Principal leave request submitted" : "Teacher leave request submitted";
    const message = "A new leave request is waiting for your review.";

    const url = "/dashboard/admin/leave-requests";

    await notificationService.notifyUsers(schoolId, applicantId, recipientIds, {
      title,
      message,
      type: applicantRole === "principal" ? "principal_leave_submitted" : "teacher_leave_submitted",
      metadata: { leave_request_id: leaveRequestId, url },
    });
    await pushService.sendToUserIds(recipientIds, { title, body: message, url });
  } catch (err) {
    logger.error({ err, leaveRequestId }, "Failed to send leave-request-submitted notification");
  }
}

/** Notifies the applicant once their leave request is resolved. */
async function notifyOnReview(schoolId: string, reviewedBy: string, applicantId: string, applicantRole: ApplicantRole, status: "approved" | "rejected", leaveRequestId: string) {
  try {
    const typeByRole: Record<ApplicantRole, Record<"approved" | "rejected", notificationService.NotificationType>> = {
      teacher: { approved: "teacher_leave_approved", rejected: "teacher_leave_rejected" },
      principal: { approved: "principal_leave_approved", rejected: "principal_leave_rejected" },
    };
    await notificationService.notifyUsers(schoolId, reviewedBy, [applicantId], {
      title: `Your leave request was ${status}`,
      message: status === "approved" ? "Your leave request has been approved." : "Your leave request has been rejected.",
      type: typeByRole[applicantRole][status],
      metadata: { leave_request_id: leaveRequestId },
    });
  } catch (err) {
    logger.error({ err, leaveRequestId }, "Failed to send leave-request-reviewed notification");
  }
}

/**
 * Self-service "apply for leave" for a teacher OR a principal (never
 * client-supplied — `applicantId`/`applicantRole` always come from the
 * caller's own session in the controller, so nobody can apply on someone
 * else's behalf here).
 */
export async function applyForLeave(
  schoolId: string,
  applicantId: string,
  applicantRole: ApplicantRole,
  input: { start_date: string; end_date: string; reason?: string; leave_type: LeaveType }
) {
  if (input.end_date < input.start_date) {
    throw ApiError.badRequest("End date must be on or after the start date");
  }
  assertNotPastLeaveDate(input.start_date);

  const { data: duplicate, error: duplicateError } = await supabaseAdmin
    .from("leave_requests")
    .select("id")
    .eq("school_id", schoolId)
    .eq("teacher_id", applicantId)
    .eq("start_date", input.start_date)
    .eq("end_date", input.end_date)
    .eq("status", "pending")
    .maybeSingle();
  if (duplicateError) throw ApiError.internal(duplicateError.message);
  if (duplicate) {
    throw ApiError.conflict("You already have a pending leave request for these dates.");
  }

  const { data, error } = await supabaseAdmin
    .from("leave_requests")
    .insert({
      school_id: schoolId,
      teacher_id: applicantId,
      applicant_role: applicantRole,
      leave_type: input.leave_type,
      start_date: input.start_date,
      end_date: input.end_date,
      reason: input.reason,
      created_by: applicantId,
    })
    .select(LEAVE_REQUEST_SELECT)
    .single();
  if (error) throw ApiError.internal(error.message);
  const [row] = await attachApplicantNames([data as unknown as LeaveRequestRow]);

  void notifyOnApply(schoolId, applicantId, applicantRole, row.id);
  return row;
}

/**
 * Entitlement comes from admin settings (`schools.settings.leavePolicy`,
 * falls back to a sensible default when the school hasn't configured one —
 * see school.service.ts's namespaced settings jsonb). "Used" is the sum of
 * approved leave days (inclusive) taken so far this calendar year, broken
 * down by leave_type; teachers can apply but never change these numbers
 * themselves.
 */
export async function getLeaveSummary(schoolId: string, teacherId: string) {
  const yearStart = `${new Date().getFullYear()}-01-01`;

  const [{ data: school, error: schoolError }, { data: requests, error: requestsError }] = await Promise.all([
    supabaseAdmin.from("schools").select("settings").eq("id", schoolId).maybeSingle(),
    supabaseAdmin
      .from("leave_requests")
      .select("leave_type, start_date, end_date, status")
      .eq("school_id", schoolId)
      .eq("teacher_id", teacherId)
      .gte("start_date", yearStart),
  ]);
  if (schoolError) throw ApiError.internal(schoolError.message);
  if (requestsError) throw ApiError.internal(requestsError.message);

  const settings = (school?.settings as Record<string, unknown> | null) ?? {};
  const policy: LeavePolicy = { ...DEFAULT_LEAVE_POLICY, ...(settings.leavePolicy as Partial<LeavePolicy> | undefined) };

  const used: LeavePolicy = { casual: 0, sick: 0, other: 0 };
  let pendingCount = 0;
  let approvedCount = 0;
  let rejectedCount = 0;

  for (const row of requests ?? []) {
    const type = (row.leave_type as LeaveType) ?? "other";
    if (row.status === "approved") {
      used[type] += inclusiveDayCount(row.start_date, row.end_date);
      approvedCount += 1;
    } else if (row.status === "pending") {
      pendingCount += 1;
    } else if (row.status === "rejected") {
      rejectedCount += 1;
    }
  }

  const remaining: LeavePolicy = {
    casual: Math.max(0, policy.casual - used.casual),
    sick: Math.max(0, policy.sick - used.sick),
    other: Math.max(0, policy.other - used.other),
  };

  const totalEntitlement = policy.casual + policy.sick + policy.other;
  const totalUsed = used.casual + used.sick + used.other;

  return {
    policy,
    used,
    remaining,
    totalEntitlement,
    totalUsed,
    totalRemaining: Math.max(0, totalEntitlement - totalUsed),
    pendingCount,
    approvedCount,
    rejectedCount,
  };
}

/**
 * Race-safe, role-aware review. The update is conditional on the row still
 * being "pending" — if admin and principal both click Approve at nearly the
 * same moment, only the first write actually changes anything; the loser
 * gets back the already-resolved row (`alreadyReviewed: true`) with who
 * really acted, instead of silently overwriting or throwing a confusing
 * error. A principal may never resolve another principal's leave request —
 * that's admin/super_admin-only, even though principals otherwise have
 * `teachers.manage` parity with admin (027/029 migrations).
 */
export async function reviewLeaveRequest(
  schoolId: string,
  leaveRequestId: string,
  reviewedBy: string,
  reviewerRole: string,
  status: "approved" | "rejected"
) {
  const { data: existing, error: existingError } = await supabaseAdmin
    .from("leave_requests")
    .select(LEAVE_REQUEST_SELECT)
    .eq("id", leaveRequestId)
    .eq("school_id", schoolId)
    .maybeSingle();
  if (existingError) throw ApiError.internal(existingError.message);
  if (!existing) throw ApiError.notFound("Leave request not found");
  const [existingRow] = await attachApplicantNames([existing as unknown as LeaveRequestRow]);

  if (existingRow.applicant_role === "principal" && reviewerRole === "principal") {
    throw ApiError.forbidden("Only an admin can review a principal's leave request");
  }

  const { data, error } = await supabaseAdmin
    .from("leave_requests")
    .update({
      status,
      reviewed_by: reviewedBy,
      reviewed_by_role: reviewerRole,
      reviewed_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", leaveRequestId)
    .eq("school_id", schoolId)
    .eq("status", "pending")
    .select(LEAVE_REQUEST_SELECT)
    .single();

  if (error && error.code !== "PGRST116") throw ApiError.internal(error.message);

  if (!data) {
    // Lost the race (or it was already resolved earlier) — return the
    // current state rather than erroring, so the caller can show
    // "Already reviewed by X" instead of a generic failure.
    return { ...existingRow, alreadyReviewed: true };
  }

  const [updatedRow] = await attachApplicantNames([data as unknown as LeaveRequestRow]);
  void notifyOnReview(schoolId, reviewedBy, updatedRow.teacher_id, updatedRow.applicant_role, status, updatedRow.id);
  return { ...updatedRow, alreadyReviewed: false };
}

export async function deleteLeaveRequest(schoolId: string, leaveRequestId: string) {
  const { error } = await supabaseAdmin
    .from("leave_requests")
    .delete()
    .eq("id", leaveRequestId)
    .eq("school_id", schoolId);
  if (error) throw ApiError.internal(error.message);
}
