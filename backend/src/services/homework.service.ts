import { supabaseAdmin } from "../config/supabase";
import { ApiError } from "../utils/ApiError";
import { assertClassInSchool } from "../utils/scopeGuards";

const HOMEWORK_SELECT =
  "id, class_id, subject_id, teacher_id, title, description, due_date, attachment_url, created_at, " +
  "classes(name, section), subjects(name, code), users(full_name)";

export async function listForClass(schoolId: string, classId: string) {
  const { data, error } = await supabaseAdmin
    .from("homework")
    .select(HOMEWORK_SELECT)
    .eq("school_id", schoolId)
    .eq("class_id", classId)
    .order("due_date", { ascending: false });
  if (error) throw ApiError.internal(error.message);
  return data;
}

export async function createHomework(
  schoolId: string,
  teacherId: string,
  input: { class_id: string; subject_id?: string; title: string; description?: string; due_date: string; attachment_url?: string }
) {
  await assertClassInSchool(schoolId, input.class_id);

  const { data, error } = await supabaseAdmin
    .from("homework")
    .insert({ school_id: schoolId, teacher_id: teacherId, ...input })
    .select(HOMEWORK_SELECT)
    .single();
  if (error) throw ApiError.internal(error.message);
  return data;
}

export async function updateHomework(schoolId: string, homeworkId: string, patch: Record<string, unknown>) {
  const { data, error } = await supabaseAdmin
    .from("homework")
    .update(patch)
    .eq("id", homeworkId)
    .eq("school_id", schoolId)
    .select(HOMEWORK_SELECT)
    .single();
  if (error) throw ApiError.internal(error.message);
  if (!data) throw ApiError.notFound("Homework not found");
  return data;
}

export async function deleteHomework(schoolId: string, homeworkId: string) {
  const { error } = await supabaseAdmin.from("homework").delete().eq("id", homeworkId).eq("school_id", schoolId);
  if (error) throw ApiError.internal(error.message);
}

/** Upcoming homework for the student's own class, soonest due first — the dashboard view. */
export async function listUpcomingForStudent(schoolId: string, studentId: string, limit = 10) {
  const { data: student, error: studentError } = await supabaseAdmin
    .from("students")
    .select("class_id")
    .eq("id", studentId)
    .eq("school_id", schoolId)
    .maybeSingle();
  if (studentError) throw ApiError.internal(studentError.message);
  if (!student?.class_id) return [];

  const today = new Date().toISOString().slice(0, 10);

  const { data, error } = await supabaseAdmin
    .from("homework")
    .select(HOMEWORK_SELECT)
    .eq("school_id", schoolId)
    .eq("class_id", student.class_id)
    .gte("due_date", today)
    .order("due_date", { ascending: true })
    .limit(limit);
  if (error) throw ApiError.internal(error.message);
  return data;
}
