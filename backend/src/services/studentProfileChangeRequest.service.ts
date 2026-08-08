import { supabaseAdmin } from "../config/supabase";
import { ApiError } from "../utils/ApiError";
import { logger } from "../config/logger";
import * as studentService from "./student.service";
import * as notificationService from "./notification.service";

/**
 * Fields a student may propose a change for via the portal's
 * "Request a change" flow — deliberately excludes identity/administrative
 * fields (full_name, admission_no, roll_no, date_of_birth, gender, class_id,
 * admission_date, aadhaar_number, place_of_birth, nationality, religion,
 * category, father_name, mother_name, is_active), which stay staff-only via
 * the existing direct PATCH /students/:id endpoint. Kept in sync manually
 * with the Zod validator's allow-list (same cross-boundary-enum pattern as
 * NotificationType) — there's no shared schema codegen in this codebase.
 */
export const EDITABLE_FIELDS = [
  "phone",
  "address",
  "city",
  "district",
  "state",
  "pin_code",
  "blood_group",
  "allergies",
  "medical_conditions",
  "emergency_contact_name",
  "emergency_contact_phone",
  "doctor_name",
  "doctor_phone",
  "father_phone",
  "father_email",
  "father_occupation",
  "mother_phone",
  "mother_email",
  "mother_occupation",
  "avatar_url",
] as const;
export type EditableField = (typeof EDITABLE_FIELDS)[number];

const CHANGE_REQUEST_SELECT =
  "id, student_id, requested_by, requester_role, changes, reason, status, reviewer_notes, reviewed_by, reviewed_at, created_at";

interface ChangeRequestRow {
  id: string;
  student_id: string;
  requested_by: string;
  requester_role: "student";
  changes: Record<string, { from: unknown; to: unknown }>;
  reason: string | null;
  status: "pending" | "approved" | "rejected" | "cancelled";
  reviewer_notes: string | null;
  reviewed_by: string | null;
  reviewed_at: string | null;
  created_at: string;
}

/** The one teacher (if any) who is homeroom/class-teacher of this student's class — mirrors studentLeaveRequest.service.ts::getClassTeacherId. */
async function getClassTeacherId(schoolId: string, studentId: string): Promise<string | null> {
  const { data: student, error: studentError } = await supabaseAdmin
    .from("students")
    .select("class_id")
    .eq("id", studentId)
    .eq("school_id", schoolId)
    .maybeSingle();
  if (studentError) throw ApiError.internal(studentError.message);
  if (!student?.class_id) return null;

  const { data: klass, error: classError } = await supabaseAdmin
    .from("classes")
    .select("class_teacher_id")
    .eq("id", student.class_id)
    .maybeSingle();
  if (classError) throw ApiError.internal(classError.message);
  return (klass?.class_teacher_id as string | null) ?? null;
}

export async function submitChangeRequest(
  schoolId: string,
  studentId: string,
  requestedBy: string,
  requesterRole: "student",
  input: { changes: Record<string, { from: unknown; to: unknown }>; reason?: string }
) {
  const invalidField = Object.keys(input.changes).find((field) => !EDITABLE_FIELDS.includes(field as EditableField));
  if (invalidField) {
    throw ApiError.badRequest(`"${invalidField}" cannot be changed through a profile change request`);
  }
  if (Object.keys(input.changes).length === 0) {
    throw ApiError.badRequest("At least one field change is required");
  }

  const { data: duplicate, error: duplicateError } = await supabaseAdmin
    .from("student_profile_change_requests")
    .select("id")
    .eq("school_id", schoolId)
    .eq("student_id", studentId)
    .eq("status", "pending")
    .maybeSingle();
  if (duplicateError) throw ApiError.internal(duplicateError.message);
  if (duplicate) {
    throw ApiError.conflict("A profile change request is already pending review for this student.");
  }

  const { data, error } = await supabaseAdmin
    .from("student_profile_change_requests")
    .insert({
      school_id: schoolId,
      student_id: studentId,
      requested_by: requestedBy,
      requester_role: requesterRole,
      changes: input.changes,
      reason: input.reason,
    })
    .select(CHANGE_REQUEST_SELECT)
    .single();
  if (error) throw ApiError.internal(error.message);
  const row = data as unknown as ChangeRequestRow;

  const classTeacherId = await getClassTeacherId(schoolId, studentId);
  if (classTeacherId) {
    notificationService
      .notifyUsers(schoolId, requestedBy, [classTeacherId], {
        title: "Profile change request submitted",
        message: "A student has requested a profile update for your review.",
        type: "profile_change_submitted",
        metadata: { student_profile_change_request_id: row.id, student_id: studentId },
      })
      .catch((err) =>
        logger.error({ err, requestId: row.id }, "Failed to send profile-change-submitted notification")
      );
  }

  return row;
}

/** Full history for one student, regardless of who filed it. */
export async function listForStudent(schoolId: string, studentId: string) {
  const { data, error } = await supabaseAdmin
    .from("student_profile_change_requests")
    .select(CHANGE_REQUEST_SELECT)
    .eq("school_id", schoolId)
    .eq("student_id", studentId)
    .order("created_at", { ascending: false });
  if (error) throw ApiError.internal(error.message);
  return data ?? [];
}

/** The class teacher's review queue — every request from a student in the one class they're homeroom teacher of. */
export async function listForClassTeacher(
  schoolId: string,
  teacherId: string,
  filters: { status?: "pending" | "approved" | "rejected" | "cancelled" }
) {
  const { data: classes, error: classError } = await supabaseAdmin
    .from("classes")
    .select("id")
    .eq("school_id", schoolId)
    .eq("class_teacher_id", teacherId);
  if (classError) throw ApiError.internal(classError.message);

  const classIds = (classes ?? []).map((c) => c.id as string);
  if (classIds.length === 0) return [];

  const { data: students, error: studentsError } = await supabaseAdmin
    .from("students")
    .select("id, admission_no, users(full_name), classes(name, section)")
    .eq("school_id", schoolId)
    .in("class_id", classIds);
  if (studentsError) throw ApiError.internal(studentsError.message);

  const studentIds = (students ?? []).map((s) => s.id as string);
  if (studentIds.length === 0) return [];

  let query = supabaseAdmin
    .from("student_profile_change_requests")
    .select(CHANGE_REQUEST_SELECT)
    .eq("school_id", schoolId)
    .in("student_id", studentIds)
    .order("created_at", { ascending: false });
  if (filters.status) query = query.eq("status", filters.status);

  const { data: requests, error: requestsError } = await query;
  if (requestsError) throw ApiError.internal(requestsError.message);

  const studentById = new Map((students ?? []).map((s) => [s.id as string, s]));
  return (requests ?? []).map((r) => ({ ...r, student: studentById.get(r.student_id) ?? null }));
}

/**
 * Approve/reject — only the student's own class teacher may act. On approve,
 * applies the requested patch via studentService.updateStudent (which already
 * routes users-table fields like phone/avatar_url vs. students-table fields
 * correctly), then notifies the submitter via the 'user' audience scope
 * added in migration 036.
 */
export async function review(
  schoolId: string,
  requestId: string,
  reviewerId: string,
  status: "approved" | "rejected",
  reviewerNotes?: string
) {
  const { data: existing, error: existingError } = await supabaseAdmin
    .from("student_profile_change_requests")
    .select(CHANGE_REQUEST_SELECT)
    .eq("id", requestId)
    .eq("school_id", schoolId)
    .maybeSingle();
  if (existingError) throw ApiError.internal(existingError.message);
  if (!existing) throw ApiError.notFound("Profile change request not found");
  const existingRow = existing as unknown as ChangeRequestRow;

  const classTeacherId = await getClassTeacherId(schoolId, existingRow.student_id);
  if (classTeacherId !== reviewerId) {
    throw ApiError.forbidden("Only this student's class teacher can review their profile change requests");
  }

  const { data, error } = await supabaseAdmin
    .from("student_profile_change_requests")
    .update({
      status,
      reviewer_notes: reviewerNotes,
      reviewed_by: reviewerId,
      reviewed_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", requestId)
    .eq("school_id", schoolId)
    .eq("status", "pending")
    .select(CHANGE_REQUEST_SELECT)
    .single();

  if (error && error.code !== "PGRST116") throw ApiError.internal(error.message);

  if (!data) {
    return { ...existingRow, alreadyReviewed: true };
  }

  const updatedRow = data as unknown as ChangeRequestRow;

  if (status === "approved") {
    const patch = Object.fromEntries(Object.entries(updatedRow.changes).map(([field, { to }]) => [field, to]));
    await studentService.updateStudent(schoolId, updatedRow.student_id, patch);
  }

  notificationService
    .createNotification(schoolId, reviewerId, {
      title: `Your profile change request was ${status}`,
      message:
        status === "approved"
          ? "Your requested profile update has been approved and applied."
          : "Your requested profile update has been rejected.",
      audience_scope: "user",
      audience_user_id: updatedRow.requested_by,
      type: status === "approved" ? "profile_change_approved" : "profile_change_rejected",
      metadata: { student_profile_change_request_id: updatedRow.id, student_id: updatedRow.student_id },
    })
    .catch((err) => logger.error({ err, requestId }, "Failed to send profile-change-reviewed notification"));

  return { ...updatedRow, alreadyReviewed: false };
}
