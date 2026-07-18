import { supabaseAdmin } from "../config/supabase";
import { env } from "../config/env";
import { ROLE_ID } from "../config/roles";
import { ApiError } from "../utils/ApiError";

const TEACHER_SELECT =
  "id, employee_id, qualification, joining_date, " +
  "users(full_name, email, phone, avatar_url, is_active)";

export async function listTeachers(schoolId: string) {
  const { data, error } = await supabaseAdmin
    .from("teachers")
    .select(TEACHER_SELECT)
    .eq("school_id", schoolId)
    .order("employee_id");
  if (error) throw ApiError.internal(error.message);
  return data;
}

export async function getTeacher(schoolId: string, teacherId: string) {
  const { data, error } = await supabaseAdmin
    .from("teachers")
    .select(TEACHER_SELECT)
    .eq("id", teacherId)
    .eq("school_id", schoolId)
    .single();
  if (error || !data) throw ApiError.notFound("Teacher not found");
  return data;
}

export async function createTeacher(
  schoolId: string,
  input: {
    email: string;
    full_name: string;
    phone?: string;
    employee_id: string;
    qualification?: string;
    joining_date?: string;
  }
) {
  const { data: invited, error: inviteError } = await supabaseAdmin.auth.admin.inviteUserByEmail(
    input.email,
    {
      redirectTo: `${env.FRONTEND_URL}/reset-password`,
      data: { full_name: input.full_name, role_id: ROLE_ID.TEACHER, school_id: schoolId },
    }
  );

  if (inviteError) {
    if (inviteError.status === 422) throw ApiError.conflict("A user with this email already exists");
    throw ApiError.internal(inviteError.message);
  }

  if (input.phone) {
    await supabaseAdmin.from("users").update({ phone: input.phone }).eq("id", invited.user.id);
  }

  const { error: teacherError } = await supabaseAdmin.from("teachers").insert({
    id: invited.user.id,
    school_id: schoolId,
    employee_id: input.employee_id,
    qualification: input.qualification,
    joining_date: input.joining_date,
  });

  if (teacherError) {
    await supabaseAdmin.auth.admin.deleteUser(invited.user.id);
    if (teacherError.code === "23505") {
      throw ApiError.conflict("A teacher with this employee ID already exists");
    }
    throw ApiError.internal(teacherError.message);
  }

  return getTeacher(schoolId, invited.user.id);
}

export async function updateTeacher(schoolId: string, teacherId: string, patch: Record<string, unknown>) {
  const { full_name, phone, is_active, ...teacherPatch } = patch as {
    full_name?: string;
    phone?: string;
    is_active?: boolean;
    [key: string]: unknown;
  };

  if (full_name !== undefined || phone !== undefined || is_active !== undefined) {
    const userPatch: Record<string, unknown> = {};
    if (full_name !== undefined) userPatch.full_name = full_name;
    if (phone !== undefined) userPatch.phone = phone;
    if (is_active !== undefined) userPatch.is_active = is_active;

    const { error } = await supabaseAdmin
      .from("users")
      .update(userPatch)
      .eq("id", teacherId)
      .eq("school_id", schoolId);
    if (error) throw ApiError.internal(error.message);
  }

  if (Object.keys(teacherPatch).length > 0) {
    const { error } = await supabaseAdmin
      .from("teachers")
      .update(teacherPatch)
      .eq("id", teacherId)
      .eq("school_id", schoolId);
    if (error) throw ApiError.internal(error.message);
  }

  return getTeacher(schoolId, teacherId);
}

export async function deactivateTeacher(schoolId: string, teacherId: string) {
  return updateTeacher(schoolId, teacherId, { is_active: false });
}

/** Assigns a teacher to teach a specific subject in a specific class. */
export async function assignToClassSubject(
  schoolId: string,
  teacherId: string,
  classId: string,
  subjectId: string
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
      { class_id: classId, subject_id: subjectId, teacher_id: teacherId },
      { onConflict: "class_id,subject_id" }
    )
    .select()
    .single();
  if (error) throw ApiError.internal(error.message);
  return data;
}

/** Sets a teacher as the homeroom/class teacher for a class. */
export async function setHomeroomTeacher(schoolId: string, teacherId: string, classId: string) {
  const { data, error } = await supabaseAdmin
    .from("classes")
    .update({ class_teacher_id: teacherId })
    .eq("id", classId)
    .eq("school_id", schoolId)
    .select()
    .single();
  if (error) throw ApiError.internal(error.message);
  if (!data) throw ApiError.notFound("Class not found");
  return data;
}

export async function listTeacherAssignments(schoolId: string, teacherId: string) {
  const { data, error } = await supabaseAdmin
    .from("class_subjects")
    .select("id, class_id, subject_id, classes!inner(name, section, school_id), subjects(name, code)")
    .eq("teacher_id", teacherId)
    .eq("classes.school_id", schoolId);
  if (error) throw ApiError.internal(error.message);
  return data;
}
