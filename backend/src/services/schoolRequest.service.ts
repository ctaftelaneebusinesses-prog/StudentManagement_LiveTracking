import { supabaseAdmin } from "../config/supabase";
import { ApiError } from "../utils/ApiError";
import { ROLE_ID } from "../config/roles";
import { logger } from "../config/logger";
import * as schoolService from "./school.service";
import * as superAdminService from "./superAdmin.service";
import * as notificationService from "./notification.service";
import * as pushService from "./push.service";

/**
 * A school_admin's request to add a new school, reviewed by a super_admin.
 *
 * Since 066_super_admin_multi_school.sql only super_admin can create a school
 * directly (holds platform.manage_schools); this is the school_admin's path
 * to the same outcome — nothing is created until a super_admin approves.
 */

interface SchoolRequestPayload {
  name: string;
  code?: string;
  branch_name?: string;
  principal_name?: string;
  address?: string;
  phone?: string;
  alternate_phone?: string;
  email?: string;
  city?: string;
  district?: string;
  state?: string;
  pin_code?: string;
  country?: string;
  logo_url?: string;
  requester_notes?: string;
}

interface RequestRow {
  id: string;
  requested_by: string;
  status: "pending" | "approved" | "rejected";
  payload: SchoolRequestPayload;
  reviewed_by: string | null;
  reviewed_at: string | null;
  reviewer_notes: string | null;
  created_school_id: string | null;
  created_at: string;
  users: { full_name: string; email: string } | null;
}

const REQUEST_SELECT =
  "id, requested_by, status, payload, reviewed_by, reviewed_at, reviewer_notes, created_school_id, created_at, " +
  "users!school_creation_requests_requested_by_fkey(full_name, email)";

/** Every super_admin on the platform — global reach, not tied to any school_id. */
async function getSuperAdminIds(): Promise<string[]> {
  const { data, error } = await supabaseAdmin.from("user_roles").select("user_id").eq("role_id", ROLE_ID.SUPER_ADMIN);
  if (error) throw ApiError.internal(error.message);
  return Array.from(new Set((data ?? []).map((row) => row.user_id as string)));
}

/**
 * In-app (bell + sidebar list) and desktop-push notification, fire-and-forget
 * — mirrors the pattern used throughout the app (e.g. leaveRequest.service.ts,
 * fees.service.ts): logged on failure, never thrown, so a notification hiccup
 * can never fail the request/approval/rejection that triggered it.
 */
async function notify(
  schoolId: string | null,
  actorId: string | null,
  recipientIds: string[],
  input: {
    title: string;
    message: string;
    type: notificationService.NotificationType;
    /** Where clicking the desktop push notification lands — differs by which console the recipient uses. */
    url: string;
    metadata?: Record<string, unknown>;
  }
): Promise<void> {
  if (recipientIds.length === 0) return;
  try {
    // `metadata.url` powers click-to-navigate in the in-app notification list
    // (frontend NotificationsPage/NotificationsMenu), mirroring the `url` the
    // desktop push payload already carries for the same event.
    await notificationService.notifyUsers(schoolId, actorId, recipientIds, {
      ...input,
      metadata: { ...input.metadata, url: input.url },
    });
    await pushService.sendToUserIds(recipientIds, { title: input.title, body: input.message, url: input.url });
  } catch (err) {
    logger.error({ err, recipientIds }, "Failed to send school-request notification");
  }
}

export async function createRequest(requestedBy: string, payload: SchoolRequestPayload) {
  const { data, error } = await supabaseAdmin
    .from("school_creation_requests")
    .insert({ requested_by: requestedBy, payload })
    .select(REQUEST_SELECT)
    .single();
  if (error) throw ApiError.internal(error.message);
  const request = data as unknown as RequestRow;

  const superAdminIds = await getSuperAdminIds();
  await notify(null, requestedBy, superAdminIds, {
    title: "New school request",
    message: `${request.users?.full_name ?? "A School Admin"} requested a new school: ${payload.name}.`,
    type: "school_request_submitted",
    url: "/dashboard/super-admin/school-requests",
    metadata: { request_id: request.id },
  });

  return request;
}

export async function listMyRequests(userId: string) {
  const { data, error } = await supabaseAdmin
    .from("school_creation_requests")
    .select(REQUEST_SELECT)
    .eq("requested_by", userId)
    .order("created_at", { ascending: false });
  if (error) throw ApiError.internal(error.message);
  return (data ?? []) as unknown as RequestRow[];
}

export async function listAllRequests(status?: "pending" | "approved" | "rejected") {
  let query = supabaseAdmin
    .from("school_creation_requests")
    .select(REQUEST_SELECT)
    .order("created_at", { ascending: false });
  if (status) query = query.eq("status", status);

  const { data, error } = await query;
  if (error) throw ApiError.internal(error.message);
  return (data ?? []) as unknown as RequestRow[];
}

export async function getRequest(requestId: string): Promise<RequestRow> {
  const { data, error } = await supabaseAdmin
    .from("school_creation_requests")
    .select(REQUEST_SELECT)
    .eq("id", requestId)
    .maybeSingle();
  if (error) throw ApiError.internal(error.message);
  if (!data) throw ApiError.notFound("Request not found");
  return data as unknown as RequestRow;
}

async function getPendingRequest(requestId: string): Promise<RequestRow> {
  const request = await getRequest(requestId);
  if (request.status !== "pending") {
    throw ApiError.conflict(`This request has already been ${request.status}`);
  }
  return request;
}

/**
 * Approves a request: creates the real school from the submitted payload,
 * assigns it to the requester ON TOP of their existing assignments (never
 * replacing them), and marks the request approved.
 */
export async function approveRequest(requestId: string, reviewerId: string, reviewerNotes?: string) {
  const request = await getPendingRequest(requestId);
  const { requester_notes: _omit, ...schoolFields } = request.payload;

  const school = await schoolService.createSchool(schoolFields);

  const currentAdmin = await superAdminService.getSchoolAdmin(request.requested_by);
  const nextSchoolIds = Array.from(new Set([...currentAdmin.schools.map((s) => s.id), school.id]));
  await superAdminService.replaceAssignments(request.requested_by, nextSchoolIds, reviewerId);

  const { data, error } = await supabaseAdmin
    .from("school_creation_requests")
    .update({
      status: "approved",
      reviewed_by: reviewerId,
      reviewed_at: new Date().toISOString(),
      reviewer_notes: reviewerNotes ?? null,
      created_school_id: school.id,
    })
    .eq("id", requestId)
    .select(REQUEST_SELECT)
    .single();
  if (error) throw ApiError.internal(error.message);
  const updated = data as unknown as RequestRow;

  await notify(school.id, reviewerId, [request.requested_by], {
    title: "School request approved",
    message: `${school.name} has been created and added to your schools.`,
    type: "school_request_approved",
    url: "/dashboard/admin/schools/request",
    metadata: { request_id: updated.id, school_id: school.id },
  });

  return { request: updated, school };
}

export async function rejectRequest(requestId: string, reviewerId: string, reviewerNotes?: string) {
  await getPendingRequest(requestId);

  const { data, error } = await supabaseAdmin
    .from("school_creation_requests")
    .update({
      status: "rejected",
      reviewed_by: reviewerId,
      reviewed_at: new Date().toISOString(),
      reviewer_notes: reviewerNotes ?? null,
    })
    .eq("id", requestId)
    .select(REQUEST_SELECT)
    .single();
  if (error) throw ApiError.internal(error.message);
  const updated = data as unknown as RequestRow;

  await notify(null, reviewerId, [updated.requested_by], {
    title: "School request rejected",
    message: reviewerNotes
      ? `Your request for "${(updated.payload as { name?: string }).name}" was rejected: ${reviewerNotes}`
      : `Your request for "${(updated.payload as { name?: string }).name}" was rejected.`,
    type: "school_request_rejected",
    url: "/dashboard/admin/schools/request",
    metadata: { request_id: updated.id },
  });

  return updated;
}
