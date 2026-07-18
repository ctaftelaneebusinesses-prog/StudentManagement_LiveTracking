import { Request } from "express";
import { supabaseAdmin } from "../config/supabase";
import { ApiError } from "./ApiError";

const STAFF_ROLES = ["school_admin", "principal", "super_admin"];

function isStaff(roles: string[]): boolean {
  return roles.some((role) => STAFF_ROLES.includes(role));
}

/**
 * Row-level ownership guards for the teacher-facing write/read paths
 * (attendance, exams/marks, homework). Staff (school_admin/principal/
 * super_admin) always bypass — they're already gated by the router-level
 * requirePermission check. A `teacher`-only caller must additionally own the
 * class/subject via `class_subjects` (or be its homeroom teacher via
 * `classes.class_teacher_id`), mirroring the ownership check
 * `utils/studentAccess.ts::assertStudentAccess` already does for the
 * student-scoped endpoints. Throws ApiError.forbidden when ownership fails.
 */
export async function assertTeacherOwnsClass(req: Request, classId: string): Promise<void> {
  const user = req.user;
  if (!user) throw ApiError.unauthorized();
  if (isStaff(user.roles)) return;

  if (!user.roles.includes("teacher")) {
    throw ApiError.forbidden("You do not have access to this class");
  }

  const { data: homeroom, error: homeroomError } = await supabaseAdmin
    .from("classes")
    .select("id")
    .eq("id", classId)
    .eq("class_teacher_id", user.id)
    .maybeSingle();
  if (homeroomError) throw ApiError.internal(homeroomError.message);
  if (homeroom) return;

  const { data: assignment, error } = await supabaseAdmin
    .from("class_subjects")
    .select("id")
    .eq("teacher_id", user.id)
    .eq("class_id", classId)
    .maybeSingle();
  if (error) throw ApiError.internal(error.message);
  if (!assignment) throw ApiError.forbidden("You do not teach this class");
}

export async function assertTeacherOwnsClassSubject(
  req: Request,
  classId: string,
  subjectId: string
): Promise<void> {
  const user = req.user;
  if (!user) throw ApiError.unauthorized();
  if (isStaff(user.roles)) return;

  if (!user.roles.includes("teacher")) {
    throw ApiError.forbidden("You do not have access to this class/subject");
  }

  const { data, error } = await supabaseAdmin
    .from("class_subjects")
    .select("id")
    .eq("teacher_id", user.id)
    .eq("class_id", classId)
    .eq("subject_id", subjectId)
    .maybeSingle();
  if (error) throw ApiError.internal(error.message);
  if (!data) throw ApiError.forbidden("You do not teach this subject in this class");
}

/** Looks up the exam's class, then delegates to assertTeacherOwnsClass. */
export async function assertTeacherOwnsExam(req: Request, examId: string): Promise<string> {
  const { data: exam, error } = await supabaseAdmin
    .from("exams")
    .select("class_id")
    .eq("id", examId)
    .maybeSingle();
  if (error) throw ApiError.internal(error.message);
  if (!exam) throw ApiError.notFound("Exam not found");

  await assertTeacherOwnsClass(req, exam.class_id);
  return exam.class_id;
}

/** For homework update/delete: staff bypass, else the caller must be the homework's creator. */
export async function assertOwnHomeworkOrStaff(req: Request, homeworkId: string): Promise<void> {
  const user = req.user;
  if (!user) throw ApiError.unauthorized();
  if (isStaff(user.roles)) return;

  const { data: homework, error } = await supabaseAdmin
    .from("homework")
    .select("teacher_id")
    .eq("id", homeworkId)
    .maybeSingle();
  if (error) throw ApiError.internal(error.message);
  if (!homework) throw ApiError.notFound("Homework not found");

  if (homework.teacher_id !== user.id) {
    throw ApiError.forbidden("You can only manage homework you created");
  }
}
