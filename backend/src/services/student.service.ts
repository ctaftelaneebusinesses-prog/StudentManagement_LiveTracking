import { supabaseAdmin } from "../config/supabase";
import { env } from "../config/env";
import { ROLE_ID } from "../config/roles";
import { ApiError } from "../utils/ApiError";

const STUDENT_SELECT =
  "id, admission_no, roll_no, date_of_birth, gender, address, admission_date, class_id, " +
  "classes(name, section), users(full_name, email, phone, avatar_url, is_active)";

const STUDENT_PROFILE_SELECT =
  STUDENT_SELECT +
  ", student_parents(relation, parents(id, occupation, address, users(full_name, email, phone, avatar_url)))";

interface ListStudentsFilters {
  classId?: string;
  search?: string;
  page: number;
  pageSize: number;
}

export async function listStudents(schoolId: string, filters: ListStudentsFilters) {
  let query = supabaseAdmin
    .from("students")
    .select(STUDENT_SELECT, { count: "exact" })
    .eq("school_id", schoolId)
    .order("admission_no");

  if (filters.classId) query = query.eq("class_id", filters.classId);
  if (filters.search) query = query.ilike("admission_no", `%${filters.search}%`);

  const from = (filters.page - 1) * filters.pageSize;
  const to = from + filters.pageSize - 1;
  query = query.range(from, to);

  const { data, error, count } = await query;
  if (error) throw ApiError.internal(error.message);
  return { items: data, total: count ?? 0, page: filters.page, pageSize: filters.pageSize };
}

export async function getStudent(schoolId: string, studentId: string) {
  const { data, error } = await supabaseAdmin
    .from("students")
    .select(STUDENT_SELECT)
    .eq("id", studentId)
    .eq("school_id", schoolId)
    .single();
  if (error || !data) throw ApiError.notFound("Student not found");
  return data;
}

/** Full profile — personal, class, and linked parent details — for the Student Profile page. */
export async function getStudentProfile(schoolId: string, studentId: string) {
  const { data, error } = await supabaseAdmin
    .from("students")
    .select(STUDENT_PROFILE_SELECT)
    .eq("id", studentId)
    .eq("school_id", schoolId)
    .single();
  if (error || !data) throw ApiError.notFound("Student not found");
  return data;
}

export async function createStudent(
  schoolId: string,
  input: {
    email: string;
    full_name: string;
    phone?: string;
    admission_no: string;
    roll_no?: string;
    date_of_birth?: string;
    gender?: string;
    address?: string;
    class_id?: string;
  }
) {
  const { data: invited, error: inviteError } = await supabaseAdmin.auth.admin.inviteUserByEmail(
    input.email,
    {
      redirectTo: `${env.FRONTEND_URL}/reset-password`,
      data: { full_name: input.full_name, role_id: ROLE_ID.STUDENT, school_id: schoolId },
    }
  );

  if (inviteError) {
    if (inviteError.status === 422) throw ApiError.conflict("A user with this email already exists");
    throw ApiError.internal(inviteError.message);
  }

  if (input.phone) {
    await supabaseAdmin.from("users").update({ phone: input.phone }).eq("id", invited.user.id);
  }

  const { error: studentError } = await supabaseAdmin.from("students").insert({
    id: invited.user.id,
    school_id: schoolId,
    admission_no: input.admission_no,
    roll_no: input.roll_no,
    date_of_birth: input.date_of_birth,
    gender: input.gender,
    address: input.address,
    class_id: input.class_id,
  });

  if (studentError) {
    // Roll back the just-created auth user so a failed student insert
    // doesn't leave an orphaned account with no student record.
    await supabaseAdmin.auth.admin.deleteUser(invited.user.id);
    if (studentError.code === "23505") {
      throw ApiError.conflict("A student with this admission number already exists");
    }
    throw ApiError.internal(studentError.message);
  }

  return getStudent(schoolId, invited.user.id);
}

export async function updateStudent(schoolId: string, studentId: string, patch: Record<string, unknown>) {
  const { full_name, phone, is_active, ...studentPatch } = patch as {
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

    const { error: userError } = await supabaseAdmin
      .from("users")
      .update(userPatch)
      .eq("id", studentId)
      .eq("school_id", schoolId);
    if (userError) throw ApiError.internal(userError.message);
  }

  if (Object.keys(studentPatch).length > 0) {
    const { error: studentError } = await supabaseAdmin
      .from("students")
      .update(studentPatch)
      .eq("id", studentId)
      .eq("school_id", schoolId);
    if (studentError) throw ApiError.internal(studentError.message);
  }

  return getStudent(schoolId, studentId);
}

export async function assignClass(schoolId: string, studentId: string, classId: string) {
  const { data: klass, error: classError } = await supabaseAdmin
    .from("classes")
    .select("id")
    .eq("id", classId)
    .eq("school_id", schoolId)
    .single();
  if (classError || !klass) throw ApiError.notFound("Class not found");

  const { error } = await supabaseAdmin
    .from("students")
    .update({ class_id: classId })
    .eq("id", studentId)
    .eq("school_id", schoolId);
  if (error) throw ApiError.internal(error.message);

  return getStudent(schoolId, studentId);
}

export async function deactivateStudent(schoolId: string, studentId: string) {
  return updateStudent(schoolId, studentId, { is_active: false });
}
