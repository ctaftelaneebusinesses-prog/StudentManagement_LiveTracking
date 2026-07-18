import { supabaseAdmin } from "../config/supabase";
import { ApiError } from "./ApiError";

/**
 * Write-path tenant guards. Update/delete queries protect themselves by
 * always including `.eq("school_id", schoolId)` (fails closed on a
 * cross-tenant id), but inserts that reference another table's row (a
 * student, a class) have no such natural filter — these pre-checks close
 * that gap, mirroring the class-ownership check already used by
 * student.service.assignClass.
 */
export async function assertStudentInSchool(schoolId: string, studentId: string): Promise<void> {
  const { data, error } = await supabaseAdmin
    .from("students")
    .select("id")
    .eq("id", studentId)
    .eq("school_id", schoolId)
    .maybeSingle();
  if (error) throw ApiError.internal(error.message);
  if (!data) throw ApiError.notFound("Student not found");
}

export async function assertClassInSchool(schoolId: string, classId: string): Promise<void> {
  const { data, error } = await supabaseAdmin
    .from("classes")
    .select("id")
    .eq("id", classId)
    .eq("school_id", schoolId)
    .maybeSingle();
  if (error) throw ApiError.internal(error.message);
  if (!data) throw ApiError.notFound("Class not found");
}

export async function assertUserInSchool(schoolId: string, userId: string): Promise<void> {
  const { data, error } = await supabaseAdmin
    .from("users")
    .select("id")
    .eq("id", userId)
    .eq("school_id", schoolId)
    .maybeSingle();
  if (error) throw ApiError.internal(error.message);
  if (!data) throw ApiError.notFound("User not found");
}

export async function assertExamInSchool(schoolId: string, examId: string): Promise<void> {
  const { data, error } = await supabaseAdmin
    .from("exams")
    .select("id")
    .eq("id", examId)
    .eq("school_id", schoolId)
    .maybeSingle();
  if (error) throw ApiError.internal(error.message);
  if (!data) throw ApiError.notFound("Exam not found");
}
