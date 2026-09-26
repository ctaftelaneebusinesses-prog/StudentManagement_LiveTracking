import { Request } from "express";
import { supabaseAdmin } from "../config/supabase";
import { ApiError } from "./ApiError";
import { isClassTeacherOf } from "./teacherAccess";
import { canTargetSchool } from "./tenant";

/**
 * Authorizes access to one student's records for endpoints that must be
 * reachable by staff AND the student's own self-service portals (the
 * student themself, and a teacher of their class) — unlike the
 * router-level `requirePermission("students.view")` guard used for
 * staff-only list/search endpoints, this checks row-level ownership.
 * Throws ApiError.forbidden if none of those relationships hold.
 */
export async function assertStudentAccess(req: Request, studentId: string): Promise<void> {
  const user = req.user;
  if (!user) throw ApiError.unauthorized();

  if (user.id === studentId) return;

  const { data: student, error } = await supabaseAdmin
    .from("students")
    .select("school_id, class_id")
    .eq("id", studentId)
    .maybeSingle();
  if (error) throw ApiError.internal(error.message);
  if (!student) throw ApiError.notFound("Student not found");

  // FN-02: use canTargetSchool (super_admin unbounded + every accessible school,
  // i.e. home school PLUS school_admin_schools assignments) instead of only the
  // caller's home school — a multi-school admin was wrongly blocked from students
  // in their other assigned schools.
  if (user.permissions.includes("students.view") && canTargetSchool(user, student.school_id)) {
    return;
  }

  if (user.roles.includes("teacher") && student.class_id) {
    if (await isClassTeacherOf(student.class_id, user.id)) return;

    // FN-01: teacher may teach multiple subjects in the class → multiple rows;
    // .limit(1) avoids the maybeSingle multi-row error.
    const { data: assignment } = await supabaseAdmin
      .from("class_subjects")
      .select("id")
      .eq("teacher_id", user.id)
      .eq("class_id", student.class_id)
      .limit(1);
    if (assignment && assignment.length > 0) return;
  }

  throw ApiError.forbidden("You do not have access to this student's records");
}

/**
 * Narrower sibling of assertStudentAccess for fee-only endpoints
 * (getFeeSummaryForStudent / listPaymentsForStudent / getReceipt). Staff
 * holding `fees.view` (accountant, admin, principal) pass through without
 * needing the broader `students.view` permission — granting accountant
 * `students.view` would also unlock every other `/students/:id/...`
 * endpoint (exams, timetable, marks, ...) that the role is explicitly not
 * meant to reach. Falls back to the same self/teacher-of-class
 * ownership checks as assertStudentAccess for everyone else.
 */
export async function assertStudentFeeAccess(req: Request, studentId: string): Promise<void> {
  const user = req.user;
  if (!user) throw ApiError.unauthorized();

  if (user.id === studentId) return;

  const { data: student, error } = await supabaseAdmin
    .from("students")
    .select("school_id, class_id")
    .eq("id", studentId)
    .maybeSingle();
  if (error) throw ApiError.internal(error.message);
  if (!student) throw ApiError.notFound("Student not found");

  // FN-02: see assertStudentAccess — honour multi-school assignments.
  if (user.permissions.includes("fees.view") && canTargetSchool(user, student.school_id)) {
    return;
  }

  return assertStudentAccess(req, studentId);
}
