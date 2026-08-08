import { supabaseAdmin } from "../config/supabase";
import { ApiError } from "../utils/ApiError";

const CLASS_SELECT = "*, academic_years(name), branches(name), class_teacher:users(full_name)";

/** Seeded into every new class's subject list so admins never have to build this list by hand. */
const DEFAULT_SUBJECTS: { name: string; code: string }[] = [
  { name: "Telugu", code: "TELUGU" },
  { name: "Hindi", code: "HINDI" },
  { name: "English", code: "ENGLISH" },
  { name: "Mathematics", code: "MATHS" },
  { name: "Science", code: "SCIENCE" },
  { name: "Social Studies", code: "SOCIAL" },
  { name: "General Knowledge (GK)", code: "GK" },
  { name: "Computer", code: "COMPUTER" },
];

/**
 * Ensures the school's subject catalog has the default subjects, then assigns all of them
 * to the given (freshly created) class. Uses ignoreDuplicates upserts so this is safe to
 * call even if some of the defaults already exist from a prior class.
 */
async function seedDefaultSubjectsForClass(schoolId: string, classId: string): Promise<void> {
  const { error: subjectsError } = await supabaseAdmin
    .from("subjects")
    .upsert(
      DEFAULT_SUBJECTS.map((s) => ({ ...s, school_id: schoolId })),
      { onConflict: "school_id,code", ignoreDuplicates: true }
    );
  if (subjectsError) throw ApiError.internal(subjectsError.message);

  const { data: catalog, error: catalogError } = await supabaseAdmin
    .from("subjects")
    .select("id, code")
    .eq("school_id", schoolId)
    .in(
      "code",
      DEFAULT_SUBJECTS.map((s) => s.code)
    );
  if (catalogError) throw ApiError.internal(catalogError.message);

  const { error: assignError } = await supabaseAdmin.from("class_subjects").upsert(
    (catalog ?? []).map((s) => ({ class_id: classId, subject_id: s.id })),
    { onConflict: "class_id,subject_id", ignoreDuplicates: true }
  );
  if (assignError) throw ApiError.internal(assignError.message);
}

/**
 * class_subjects.teacher_id is the single source of truth for "who teaches this subject in
 * this class" — Timetable periods for the same class+subject are kept in lockstep so the
 * Subjects tab and the Timetable never disagree about the assigned teacher.
 */
async function syncTeacherToTimetablePeriods(
  schoolId: string,
  classId: string,
  subjectId: string,
  teacherId: string | null
): Promise<void> {
  const { error } = await supabaseAdmin
    .from("timetable_periods")
    .update({ teacher_id: teacherId })
    .eq("school_id", schoolId)
    .eq("class_id", classId)
    .eq("subject_id", subjectId);
  if (error) throw ApiError.internal(error.message);
}

/** Maps class_id -> enrolled student count for every class in the school in one query. */
async function getStudentCountsByClass(schoolId: string): Promise<Map<string, number>> {
  const { data, error } = await supabaseAdmin.from("students").select("class_id").eq("school_id", schoolId);
  if (error) throw ApiError.internal(error.message);

  const counts = new Map<string, number>();
  for (const row of data ?? []) {
    if (!row.class_id) continue;
    counts.set(row.class_id, (counts.get(row.class_id) ?? 0) + 1);
  }
  return counts;
}

// ---------------------------------------------------------------------------
// Classes
// ---------------------------------------------------------------------------
export async function listClasses(schoolId: string) {
  const { data, error } = await supabaseAdmin
    .from("classes")
    .select(CLASS_SELECT)
    .eq("school_id", schoolId)
    .order("name")
    .order("section");
  if (error) throw ApiError.internal(error.message);

  const counts = await getStudentCountsByClass(schoolId);
  return (data ?? []).map((klass) => ({ ...klass, student_count: counts.get(klass.id) ?? 0 }));
}

export async function getClass(schoolId: string, classId: string) {
  const { data, error } = await supabaseAdmin
    .from("classes")
    .select(CLASS_SELECT)
    .eq("id", classId)
    .eq("school_id", schoolId)
    .single();
  if (error || !data) throw ApiError.notFound("Class not found");

  const counts = await getStudentCountsByClass(schoolId);
  return { ...data, student_count: counts.get(data.id) ?? 0 };
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

  await seedDefaultSubjectsForClass(schoolId, data.id);

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
    .select(
      "id, subject_id, teacher_id, subjects(name, code, description, status), users(full_name), classes!inner(school_id)"
    )
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

  const { data: subject, error: subjectError } = await supabaseAdmin
    .from("subjects")
    .select("name")
    .eq("id", input.subject_id)
    .eq("school_id", schoolId)
    .single();
  if (subjectError || !subject) throw ApiError.notFound("Subject not found");

  const { data: existingAssignments, error: existingError } = await supabaseAdmin
    .from("class_subjects")
    .select("subject_id, subjects(name)")
    .eq("class_id", classId);
  if (existingError) throw ApiError.internal(existingError.message);

  const duplicateName = (existingAssignments ?? []).some((row) => {
    const rowSubject = row.subjects as unknown as { name: string } | null;
    return row.subject_id !== input.subject_id && rowSubject?.name.toLowerCase() === subject.name.toLowerCase();
  });
  if (duplicateName) throw ApiError.conflict("A subject with this name is already assigned to this class");

  const { data, error } = await supabaseAdmin
    .from("class_subjects")
    .upsert(
      { class_id: classId, subject_id: input.subject_id, teacher_id: input.teacher_id ?? null },
      { onConflict: "class_id,subject_id" }
    )
    .select()
    .single();
  if (error) throw ApiError.internal(error.message);

  await syncTeacherToTimetablePeriods(schoolId, classId, input.subject_id, input.teacher_id ?? null);

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
