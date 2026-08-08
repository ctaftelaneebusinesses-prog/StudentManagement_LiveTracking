import { supabaseAdmin } from "../config/supabase";
import { ApiError } from "./ApiError";

/**
 * Row-level ownership guards for the Extracurricular Staff self-service
 * portal (attendance, practice work, events, schedule/roster reads). Unlike
 * `teacherAccess.ts`, there is no staff-bypass concept here — the portal
 * router is mounted with `requireAuth` only (see
 * `routes/extracurricularPortal.routes.ts`), so every write must be checked
 * against the calling staff member's own rows. Mirrors teacherAccess.ts's
 * error-throwing/query style: `.maybeSingle()`, `ApiError.internal` on a
 * Postgres error, `ApiError.notFound`/`ApiError.forbidden` on an ownership
 * miss.
 */

export interface OwnedBatch {
  id: string;
  staff_id: string;
  activity_id: string;
  class_id: string;
  scope: "entire_class" | "selected_students";
}

/**
 * Confirms `batchId` exists in this school and belongs to `staffId`. Returns
 * the batch row (scope/class_id) so callers that immediately need it (e.g.
 * `getBatchStudents`, `markAttendance`) don't have to re-query.
 */
export async function assertStaffOwnsBatch(staffId: string, batchId: string, schoolId: string): Promise<OwnedBatch> {
  const { data: batch, error } = await supabaseAdmin
    .from("extracurricular_batches")
    .select("id, staff_id, activity_id, class_id, scope")
    .eq("id", batchId)
    .eq("school_id", schoolId)
    .maybeSingle();
  if (error) throw ApiError.internal(error.message);
  if (!batch) throw ApiError.notFound("Batch not found");
  if (batch.staff_id !== staffId) throw ApiError.forbidden("You do not own this batch");

  return batch as unknown as OwnedBatch;
}

export interface OwnedActivityAssignment {
  id: string;
  status: "assigned" | "completed";
  assigned_by: string | null;
}

/**
 * Confirms `activityId` is assigned to `staffId` in this school. Returns the
 * join row (extracurricular_staff_activities) so callers that immediately
 * need it (markActivityCompleted) don't have to re-query.
 */
export async function assertStaffOwnsActivityAssignment(staffId: string, activityId: string, schoolId: string): Promise<OwnedActivityAssignment> {
  const { data: assignment, error } = await supabaseAdmin
    .from("extracurricular_staff_activities")
    .select("id, status, assigned_by")
    .eq("staff_id", staffId)
    .eq("activity_id", activityId)
    .eq("school_id", schoolId)
    .maybeSingle();
  if (error) throw ApiError.internal(error.message);
  if (!assignment) throw ApiError.notFound("Activity assignment not found");

  return assignment as unknown as OwnedActivityAssignment;
}

/**
 * Confirms `studentId` is trained by `staffId` in at least one of their
 * batches — for an `entire_class` batch that means the student's `class_id`
 * matches the batch's `class_id`; for a `selected_students` batch it means a
 * row exists in `extracurricular_batch_students`. Throws if neither holds
 * across every batch this staff member owns.
 */
export async function assertStaffOwnsStudent(staffId: string, studentId: string, schoolId: string): Promise<void> {
  const { data: student, error: studentError } = await supabaseAdmin
    .from("students")
    .select("id, class_id")
    .eq("id", studentId)
    .eq("school_id", schoolId)
    .maybeSingle();
  if (studentError) throw ApiError.internal(studentError.message);
  if (!student) throw ApiError.notFound("Student not found");

  const { data: batches, error: batchesError } = await supabaseAdmin
    .from("extracurricular_batches")
    .select("id, class_id, scope")
    .eq("staff_id", staffId)
    .eq("school_id", schoolId);
  if (batchesError) throw ApiError.internal(batchesError.message);

  const ownedBatches = batches ?? [];

  const entireClassMatch = ownedBatches.some((b) => b.scope === "entire_class" && b.class_id === student.class_id);
  if (entireClassMatch) return;

  const selectedBatchIds = ownedBatches.filter((b) => b.scope === "selected_students").map((b) => b.id);
  if (selectedBatchIds.length > 0) {
    const { data: membership, error: membershipError } = await supabaseAdmin
      .from("extracurricular_batch_students")
      .select("id")
      .eq("student_id", studentId)
      .in("batch_id", selectedBatchIds)
      .limit(1);
    if (membershipError) throw ApiError.internal(membershipError.message);
    if (membership && membership.length > 0) return;
  }

  throw ApiError.forbidden("You do not train this student");
}
