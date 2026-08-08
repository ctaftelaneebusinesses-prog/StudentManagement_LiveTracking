import { supabaseAdmin } from "../config/supabase";
import { ApiError } from "../utils/ApiError";
import { logger } from "../config/logger";
import { resolveSchoolAdminAndPrincipalRecipientIds } from "../utils/notificationRecipients";
import * as notificationService from "./notification.service";

const SELECT =
  "id, class_id, period_id, teacher_id, day_of_week, period_no, proposed_change, reason, status, reviewed_by, reviewed_at, created_at, " +
  "classes(name, section)";

interface ProposedChange {
  subject_id?: string;
  room_number?: string;
  start_time?: string;
  end_time?: string;
}

/**
 * `timetable_change_requests` has two FKs to `users` (teacher_id,
 * reviewed_by), so an embedded `users(...)` select would be ambiguous.
 * Resolving the suggesting teacher's name as a second, plain query avoids
 * relying on PostgREST's `!fkey_name` disambiguation hint, whose schema
 * cache can lag behind a just-run migration (see leaveRequest.service.ts's
 * attachApplicantNames for the same fix, hit first).
 */
interface ChangeRequestRow {
  id: string;
  class_id: string;
  period_id: string | null;
  teacher_id: string;
  day_of_week: number;
  period_no: number;
  proposed_change: ProposedChange;
  reason: string;
  status: "pending" | "approved" | "rejected";
  reviewed_by: string | null;
  reviewed_at: string | null;
  created_at: string;
  classes: { name: string; section: string } | null;
}

// Multi-school- and super_admin-aware — see utils/notificationRecipients.ts.
const resolveAdminUserIds = resolveSchoolAdminAndPrincipalRecipientIds;

async function attachTeacherNames<T extends { teacher_id: string }>(rows: T[]): Promise<(T & { users: { full_name: string } | null })[]> {
  const teacherIds = Array.from(new Set(rows.map((r) => r.teacher_id)));
  if (teacherIds.length === 0) return rows.map((r) => ({ ...r, users: null }));

  const { data, error } = await supabaseAdmin.from("users").select("id, full_name").in("id", teacherIds);
  if (error) throw ApiError.internal(error.message);

  const byId = new Map((data ?? []).map((u) => [u.id as string, { full_name: u.full_name as string }]));
  return rows.map((r) => ({ ...r, users: byId.get(r.teacher_id) ?? null }));
}

export async function create(
  schoolId: string,
  teacherId: string,
  input: {
    class_id: string;
    period_id?: string;
    day_of_week: number;
    period_no: number;
    proposed_change: ProposedChange;
    reason: string;
  }
) {
  const { data, error } = await supabaseAdmin
    .from("timetable_change_requests")
    .insert({ school_id: schoolId, teacher_id: teacherId, ...input })
    .select(SELECT)
    .single();
  if (error) throw ApiError.internal(error.message);
  const [row] = await attachTeacherNames([data as unknown as ChangeRequestRow]);

  resolveAdminUserIds(schoolId)
    .then((adminIds) =>
      notificationService.notifyUsers(schoolId, teacherId, adminIds, {
        title: "Timetable change suggested",
        message: "A teacher has suggested a timetable change for review.",
        type: "timetable_change_suggested",
        metadata: { timetable_change_request_id: row.id },
      })
    )
    .catch((err) => logger.error({ err }, "Failed to send timetable-change-suggested notification"));

  return row;
}

export async function listOpenForSchool(schoolId: string) {
  const { data, error } = await supabaseAdmin
    .from("timetable_change_requests")
    .select(SELECT)
    .eq("school_id", schoolId)
    .eq("status", "pending")
    .order("created_at", { ascending: false });
  if (error) throw ApiError.internal(error.message);
  return attachTeacherNames((data ?? []) as unknown as ChangeRequestRow[]);
}

export async function listMine(schoolId: string, teacherId: string) {
  const { data, error } = await supabaseAdmin
    .from("timetable_change_requests")
    .select(SELECT)
    .eq("school_id", schoolId)
    .eq("teacher_id", teacherId)
    .order("created_at", { ascending: false });
  if (error) throw ApiError.internal(error.message);
  return attachTeacherNames((data ?? []) as unknown as ChangeRequestRow[]);
}

/** Admin resolves the suggestion (approve just acknowledges it was actioned — applying the actual period change still goes through the validated admin Timetable form, never this endpoint). */
export async function review(schoolId: string, id: string, reviewedBy: string, status: "approved" | "rejected") {
  const { data, error } = await supabaseAdmin
    .from("timetable_change_requests")
    .update({ status, reviewed_by: reviewedBy, reviewed_at: new Date().toISOString(), updated_at: new Date().toISOString() })
    .eq("id", id)
    .eq("school_id", schoolId)
    .select(SELECT)
    .single();
  if (error) throw ApiError.internal(error.message);
  if (!data) throw ApiError.notFound("Timetable change request not found");
  const [row] = await attachTeacherNames([data as unknown as ChangeRequestRow]);
  return row;
}
