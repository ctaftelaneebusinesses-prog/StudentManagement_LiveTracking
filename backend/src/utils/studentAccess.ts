import { Request } from "express";
import { supabaseAdmin } from "../config/supabase";
import { ApiError } from "./ApiError";

/**
 * Authorizes access to one student's records for endpoints that must be
 * reachable by staff AND the student's own self-service portals (the
 * student themself, their linked parents, and a teacher of their class) —
 * unlike the router-level `requirePermission("students.view")` guard used
 * for staff-only list/search endpoints, this checks row-level ownership.
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

  const isSuperAdmin = user.roles.includes("super_admin");
  if (user.permissions.includes("students.view") && (isSuperAdmin || student.school_id === user.schoolId)) {
    return;
  }

  if (user.roles.includes("parent")) {
    const { data } = await supabaseAdmin
      .from("student_parents")
      .select("student_id")
      .eq("parent_id", user.id)
      .eq("student_id", studentId)
      .maybeSingle();
    if (data) return;
  }

  if (user.roles.includes("teacher") && student.class_id) {
    const { data: assignment } = await supabaseAdmin
      .from("class_subjects")
      .select("id")
      .eq("teacher_id", user.id)
      .eq("class_id", student.class_id)
      .maybeSingle();
    if (assignment) return;
  }

  throw ApiError.forbidden("You do not have access to this student's records");
}
