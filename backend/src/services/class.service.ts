import { supabaseAdmin } from "../config/supabase";
import { ApiError } from "../utils/ApiError";

// ---------------------------------------------------------------------------
// Classes
// ---------------------------------------------------------------------------
export async function listClasses(schoolId: string) {
  const { data, error } = await supabaseAdmin
    .from("classes")
    .select("*, academic_years(name), branches(name)")
    .eq("school_id", schoolId)
    .order("name");
  if (error) throw ApiError.internal(error.message);
  return data;
}

export async function createClass(
  schoolId: string,
  input: {
    name: string;
    section: string;
    academic_year_id: string;
    branch_id?: string;
    class_teacher_id?: string;
  }
) {
  const { data, error } = await supabaseAdmin
    .from("classes")
    .insert({ ...input, school_id: schoolId })
    .select()
    .single();
  if (error) {
    if (error.code === "23505") throw ApiError.conflict("This class/section already exists for the academic year");
    throw ApiError.internal(error.message);
  }
  return data;
}

export async function updateClass(schoolId: string, classId: string, patch: Record<string, unknown>) {
  const { data, error } = await supabaseAdmin
    .from("classes")
    .update(patch)
    .eq("id", classId)
    .eq("school_id", schoolId)
    .select()
    .single();
  if (error) throw ApiError.internal(error.message);
  if (!data) throw ApiError.notFound("Class not found");
  return data;
}

export async function deleteClass(schoolId: string, classId: string) {
  const { error } = await supabaseAdmin.from("classes").delete().eq("id", classId).eq("school_id", schoolId);
  if (error) throw ApiError.internal(error.message);
}

// ---------------------------------------------------------------------------
// Subjects
// ---------------------------------------------------------------------------
export async function listSubjects(schoolId: string) {
  const { data, error } = await supabaseAdmin
    .from("subjects")
    .select("*")
    .eq("school_id", schoolId)
    .order("name");
  if (error) throw ApiError.internal(error.message);
  return data;
}

export async function createSubject(schoolId: string, input: { name: string; code: string }) {
  const { data, error } = await supabaseAdmin
    .from("subjects")
    .insert({ ...input, school_id: schoolId })
    .select()
    .single();
  if (error) {
    if (error.code === "23505") throw ApiError.conflict("A subject with this code already exists");
    throw ApiError.internal(error.message);
  }
  return data;
}

export async function updateSubject(schoolId: string, subjectId: string, patch: Record<string, unknown>) {
  const { data, error } = await supabaseAdmin
    .from("subjects")
    .update(patch)
    .eq("id", subjectId)
    .eq("school_id", schoolId)
    .select()
    .single();
  if (error) throw ApiError.internal(error.message);
  if (!data) throw ApiError.notFound("Subject not found");
  return data;
}

export async function deleteSubject(schoolId: string, subjectId: string) {
  const { error } = await supabaseAdmin
    .from("subjects")
    .delete()
    .eq("id", subjectId)
    .eq("school_id", schoolId);
  if (error) throw ApiError.internal(error.message);
}

// ---------------------------------------------------------------------------
// Class <-> Subject <-> Teacher assignments
// ---------------------------------------------------------------------------
export async function listClassSubjects(schoolId: string, classId: string) {
  // school_id ownership is verified implicitly by joining through classes.
  const { data, error } = await supabaseAdmin
    .from("class_subjects")
    .select("id, subject_id, teacher_id, subjects(name, code), users(full_name), classes!inner(school_id)")
    .eq("class_id", classId)
    .eq("classes.school_id", schoolId);
  if (error) throw ApiError.internal(error.message);
  return data;
}

export async function assignSubjectToClass(
  schoolId: string,
  classId: string,
  input: { subject_id: string; teacher_id?: string }
) {
  const { data: klass, error: classError } = await supabaseAdmin
    .from("classes")
    .select("id")
    .eq("id", classId)
    .eq("school_id", schoolId)
    .single();
  if (classError || !klass) throw ApiError.notFound("Class not found");

  const { data, error } = await supabaseAdmin
    .from("class_subjects")
    .upsert(
      { class_id: classId, subject_id: input.subject_id, teacher_id: input.teacher_id ?? null },
      { onConflict: "class_id,subject_id" }
    )
    .select()
    .single();
  if (error) throw ApiError.internal(error.message);
  return data;
}

export async function removeSubjectFromClass(schoolId: string, classId: string, subjectId: string) {
  const { data: klass, error: classError } = await supabaseAdmin
    .from("classes")
    .select("id")
    .eq("id", classId)
    .eq("school_id", schoolId)
    .single();
  if (classError || !klass) throw ApiError.notFound("Class not found");

  const { error } = await supabaseAdmin
    .from("class_subjects")
    .delete()
    .eq("class_id", classId)
    .eq("subject_id", subjectId);
  if (error) throw ApiError.internal(error.message);
}
