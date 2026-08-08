import { supabaseAdmin } from "../config/supabase";
import { ApiError } from "../utils/ApiError";
import { logger } from "../config/logger";
import { assertNotPastLeaveDate } from "../utils/leaveDate";
import * as notificationService from "./notification.service";

const STUDENT_LEAVE_SELECT =
  "id, student_id, requester_role, start_date, end_date, reason, status, reviewer_notes, reviewed_by, reviewed_at, created_at";

interface StudentLeaveRow {
  id: string;
  student_id: string;
  requester_role: "student";
  start_date: string;
  end_date: string;
  reason: string;
  status: "pending" | "approved" | "rejected" | "cancelled";
  reviewer_notes: string | null;
  reviewed_by: string | null;
  reviewed_at: string | null;
  created_at: string;
}

/** The one teacher (if any) who is homeroom/class-teacher of this student's class — the only teacher allowed to review their leave requests. */
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

/** Student self-service "apply for leave" — always on their own behalf, never client-supplied. */
export async function applyForLeave(
  schoolId: string,
  studentId: string,
  input: { start_date: string; end_date: string; reason: string }
) {
  if (input.end_date < input.start_date) {
    throw ApiError.badRequest("End date must be on or after the start date");
  }
  assertNotPastLeaveDate(input.start_date);

  const { data: duplicate, error: duplicateError } = await supabaseAdmin
    .from("student_leave_requests")
    .select("id")
    .eq("school_id", schoolId)
    .eq("student_id", studentId)
    .eq("start_date", input.start_date)
    .eq("end_date", input.end_date)
    .eq("status", "pending")
    .maybeSingle();
  if (duplicateError) throw ApiError.internal(duplicateError.message);
  if (duplicate) {
    throw ApiError.conflict("You already have a pending leave request for these dates.");
  }

  const { data, error } = await supabaseAdmin
    .from("student_leave_requests")
    .insert({
      school_id: schoolId,
      student_id: studentId,
      requested_by: studentId,
      requester_role: "student",
      ...input,
    })
    .select(STUDENT_LEAVE_SELECT)
    .single();
  if (error) throw ApiError.internal(error.message);
  const row = data as unknown as StudentLeaveRow;

  const classTeacherId = await getClassTeacherId(schoolId, studentId);
  if (classTeacherId) {
    notificationService
      .notifyUsers(schoolId, studentId, [classTeacherId], {
        title: "Student leave request submitted",
        message: "One of your students has requested leave.",
        type: "student_leave_submitted",
        metadata: { student_leave_request_id: row.id, student_id: studentId },
      })
      .catch((err) => logger.error({ err, leaveRequestId: row.id }, "Failed to send student-leave-submitted notification"));
  }

  return row;
}

/** Every leave request for one student — their own "leave status & history" view. */
export async function listForStudent(schoolId: string, studentId: string) {
  const { data, error } = await supabaseAdmin
    .from("student_leave_requests")
    .select(STUDENT_LEAVE_SELECT)
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
    .from("student_leave_requests")
    .select(STUDENT_LEAVE_SELECT)
    .eq("school_id", schoolId)
    .in("student_id", studentIds)
    .order("created_at", { ascending: false });
  if (filters.status) query = query.eq("status", filters.status);

  const { data: requests, error: requestsError } = await query;
  if (requestsError) throw ApiError.internal(requestsError.message);

  const studentById = new Map((students ?? []).map((s) => [s.id as string, s]));
  return (requests ?? []).map((r) => ({ ...r, student: studentById.get(r.student_id) ?? null }));
}

/** Approve/reject — only the student's own class teacher may act (staff never reach this path; see studentLeaveRequest.routes.ts). Same conditional-update-on-pending race-safety as leaveRequest.service.ts::reviewLeaveRequest. */
export async function review(
  schoolId: string,
  requestId: string,
  reviewerId: string,
  status: "approved" | "rejected"
) {
  const { data: existing, error: existingError } = await supabaseAdmin
    .from("student_leave_requests")
    .select(STUDENT_LEAVE_SELECT)
    .eq("id", requestId)
    .eq("school_id", schoolId)
    .maybeSingle();
  if (existingError) throw ApiError.internal(existingError.message);
  if (!existing) throw ApiError.notFound("Leave request not found");
  const existingRow = existing as unknown as StudentLeaveRow;

  const classTeacherId = await getClassTeacherId(schoolId, existingRow.student_id);
  if (classTeacherId !== reviewerId) {
    throw ApiError.forbidden("Only this student's class teacher can review their leave requests");
  }

  const { data, error } = await supabaseAdmin
    .from("student_leave_requests")
    .update({ status, reviewed_by: reviewerId, reviewed_at: new Date().toISOString(), updated_at: new Date().toISOString() })
    .eq("id", requestId)
    .eq("school_id", schoolId)
    .eq("status", "pending")
    .select(STUDENT_LEAVE_SELECT)
    .single();

  if (error && error.code !== "PGRST116") throw ApiError.internal(error.message);

  if (!data) {
    return { ...existingRow, alreadyReviewed: true };
  }

  const updatedRow = data as unknown as StudentLeaveRow;
  notificationService
    .createNotification(schoolId, reviewerId, {
      title: `Your leave request was ${status}`,
      message: status === "approved" ? "Your leave request has been approved." : "Your leave request has been rejected.",
      audience_scope: "student",
      audience_user_id: updatedRow.student_id,
      type: status === "approved" ? "student_leave_approved" : "student_leave_rejected",
      metadata: { student_leave_request_id: updatedRow.id },
    })
    .catch((err) => logger.error({ err, requestId }, "Failed to send student-leave-reviewed notification"));

  return { ...updatedRow, alreadyReviewed: false };
}
