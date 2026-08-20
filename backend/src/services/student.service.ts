import { supabaseAdmin } from "../config/supabase";
import { ROLE_ID } from "../config/roles";
import { ApiError } from "../utils/ApiError";
import { escapeOrFilterValue } from "../utils/searchFilter";
import { provisionUser } from "../utils/provisionUser";
import { generateDefaultPassword } from "../utils/defaultPassword";

const STUDENT_SELECT =
  "id, admission_no, roll_no, date_of_birth, gender, address, admission_date, class_id, " +
  "blood_group, allergies, medical_conditions, emergency_contact_name, emergency_contact_phone, " +
  "doctor_name, doctor_phone, aadhaar_number, " +
  "place_of_birth, nationality, religion, category, city, district, state, pin_code, " +
  "father_name, father_phone, father_email, father_occupation, " +
  "mother_name, mother_phone, mother_email, mother_occupation, " +
  "classes(name, section), users(full_name, email, phone, avatar_url, is_active)";

const STUDENT_PROFILE_SELECT = STUDENT_SELECT;

/**
 * Same as STUDENT_SELECT but with an inner join hint (`users!inner`) plus
 * `status` — lets listStudents filter on `users.status` directly in the
 * query. A self-registered student's `students` row exists as soon as they
 * submit (registration.service.ts::registerStudent creates it before
 * markPending flips users.status to 'pending'), so without this filter the
 * Student Management table showed pending/rejected registrations as if they
 * were already active. getStudent/getStudentProfile deliberately keep using
 * STUDENT_SELECT's plain (non-inner) `users(...)` — those are single-record
 * lookups (e.g. the student's own profile pages) that must keep resolving
 * regardless of approval status.
 */
const STUDENT_LIST_SELECT = STUDENT_SELECT.replace(
  "users(full_name, email, phone, avatar_url, is_active)",
  "users!inner(full_name, email, phone, avatar_url, is_active, status)"
);

interface ListStudentsFilters {
  classId?: string;
  search?: string;
  page: number;
  pageSize: number;
}

export async function listStudents(schoolId: string, filters: ListStudentsFilters) {
  let query = supabaseAdmin
    .from("students")
    .select(STUDENT_LIST_SELECT, { count: "exact" })
    .eq("school_id", schoolId)
    .eq("users.status", "approved")
    .order("admission_no");

  if (filters.classId) query = query.eq("class_id", filters.classId);

  if (filters.search) {
    const pattern = escapeOrFilterValue(`%${filters.search}%`);

    // admission_no lives on `students`; name/email live on the joined `users`
    // row, and PostgREST can't OR across a base table and an embedded one in
    // a single filter — so resolve matching user ids first, then OR them in.
    const { data: matchingUsers, error: userSearchError } = await supabaseAdmin
      .from("users")
      .select("id")
      .eq("school_id", schoolId)
      .or(`full_name.ilike.${pattern},email.ilike.${pattern}`);
    if (userSearchError) throw ApiError.internal(userSearchError.message);

    const matchingIds = (matchingUsers ?? []).map((u) => u.id);
    const idFilter = matchingIds.length > 0 ? `,id.in.(${matchingIds.join(",")})` : "";
    query = query.or(`admission_no.ilike.${pattern}${idFilter}`);
  }

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

interface PersonalInfoInput {
  place_of_birth?: string;
  nationality?: string;
  religion?: string;
  category?: string;
  city?: string;
  district?: string;
  state?: string;
  pin_code?: string;
  blood_group?: string;
  aadhaar_number?: string;
}

interface ParentContactInput {
  father_name?: string;
  father_phone?: string;
  father_email?: string;
  father_occupation?: string;
  mother_name?: string;
  mother_phone?: string;
  mother_email?: string;
  mother_occupation?: string;
}

export async function createStudent(
  schoolId: string,
  input: {
    email: string;
    full_name: string;
    phone?: string;
    password?: string;
    admission_no: string;
    roll_no?: string;
    date_of_birth?: string;
    gender?: string;
    address?: string;
    class_id?: string;
  } & PersonalInfoInput &
    ParentContactInput
) {
  const password = input.password || generateDefaultPassword(input.full_name, input.roll_no || input.admission_no);
  const provisioned = await provisionUser({
    email: input.email,
    password,
    full_name: input.full_name,
    role_id: ROLE_ID.STUDENT,
    school_id: schoolId,
  });

  if (input.phone) {
    await supabaseAdmin.from("users").update({ phone: input.phone }).eq("id", provisioned.id);
  }

  const { error: studentError } = await supabaseAdmin.from("students").insert({
    id: provisioned.id,
    school_id: schoolId,
    admission_no: input.admission_no,
    roll_no: input.roll_no,
    date_of_birth: input.date_of_birth,
    gender: input.gender,
    address: input.address,
    class_id: input.class_id,
    place_of_birth: input.place_of_birth,
    nationality: input.nationality,
    religion: input.religion,
    category: input.category,
    city: input.city,
    district: input.district,
    state: input.state,
    pin_code: input.pin_code,
    blood_group: input.blood_group,
    aadhaar_number: input.aadhaar_number,
    father_name: input.father_name,
    father_phone: input.father_phone,
    father_email: input.father_email || undefined,
    father_occupation: input.father_occupation,
    mother_name: input.mother_name,
    mother_phone: input.mother_phone,
    mother_email: input.mother_email || undefined,
    mother_occupation: input.mother_occupation,
  });

  if (studentError) {
    // Roll back the just-created auth user so a failed student insert
    // doesn't leave an orphaned account with no student record.
    await supabaseAdmin.auth.admin.deleteUser(provisioned.id);
    if (studentError.code === "23505") {
      throw ApiError.conflict("A student with this admission number already exists");
    }
    throw ApiError.internal(studentError.message);
  }

  return getStudent(schoolId, provisioned.id);
}

export async function updateStudent(schoolId: string, studentId: string, patch: Record<string, unknown>) {
  const { full_name, phone, is_active, avatar_url, ...studentPatch } = patch as {
    full_name?: string;
    phone?: string;
    is_active?: boolean;
    avatar_url?: string;
    [key: string]: unknown;
  };

  if (full_name !== undefined || phone !== undefined || is_active !== undefined || avatar_url !== undefined) {
    const userPatch: Record<string, unknown> = {};
    if (full_name !== undefined) userPatch.full_name = full_name;
    if (phone !== undefined) userPatch.phone = phone;
    if (is_active !== undefined) userPatch.is_active = is_active;
    if (avatar_url !== undefined) userPatch.avatar_url = avatar_url;

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

export async function activateStudent(schoolId: string, studentId: string) {
  return updateStudent(schoolId, studentId, { is_active: true });
}

/**
 * Hard-deletes a student — removes the auth user, which cascades through
 * `public.users` -> `public.students` (and every FK'd child row: parents
 * links, siblings, attendance, marks, homework, fee payments, documents,
 * notifications) per the `on delete cascade` chain in schema.sql. Mirrors
 * the same rollback call createStudent() uses on a failed insert.
 */
export async function permanentlyDeleteStudent(schoolId: string, studentId: string) {
  const { data, error } = await supabaseAdmin
    .from("students")
    .select("id")
    .eq("id", studentId)
    .eq("school_id", schoolId)
    .single();
  if (error || !data) throw ApiError.notFound("Student not found");

  const { error: deleteError } = await supabaseAdmin.auth.admin.deleteUser(studentId);
  if (deleteError) throw ApiError.internal(deleteError.message);
}

export async function bulkDeleteStudents(schoolId: string, studentIds: string[]) {
  const { data: matching, error } = await supabaseAdmin
    .from("students")
    .select("id")
    .eq("school_id", schoolId)
    .in("id", studentIds);
  if (error) throw ApiError.internal(error.message);

  const results = await Promise.allSettled(
    (matching ?? []).map((s) => supabaseAdmin.auth.admin.deleteUser(s.id as string))
  );
  const deletedCount = results.filter((r) => r.status === "fulfilled").length;
  return { deletedCount, requestedCount: studentIds.length };
}

// ---------------------------------------------------------------------------
// Bulk operations
// ---------------------------------------------------------------------------
interface BulkCreateStudentInput extends PersonalInfoInput, ParentContactInput {
  email: string;
  full_name: string;
  phone?: string;
  password?: string;
  admission_no: string;
  roll_no?: string;
  date_of_birth?: string;
  gender?: string;
  address?: string;
  class_id?: string;
}

/**
 * Creates students one row at a time (each goes through the same
 * invite-then-insert flow as a single createStudent call, including its
 * auth-user rollback on failure) so one bad row can't abort the whole batch
 * — every row gets its own success/failure outcome in the response.
 */
export async function bulkCreateStudents(schoolId: string, rows: BulkCreateStudentInput[]) {
  const created: Awaited<ReturnType<typeof createStudent>>[] = [];
  const failed: { index: number; admission_no?: string; email?: string; message: string }[] = [];

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    try {
      created.push(await createStudent(schoolId, row));
    } catch (err) {
      failed.push({
        index: i,
        admission_no: row.admission_no,
        email: row.email,
        message: err instanceof ApiError ? err.message : "Unexpected error while creating this row",
      });
    }
  }

  return { created, failed, totalRequested: rows.length };
}

/** Bulk-moves students into a target class — the shared mechanic behind both "Promote" and "Transfer" in the UI. */
export async function bulkAssignClass(schoolId: string, studentIds: string[], classId: string) {
  const { data: klass, error: classError } = await supabaseAdmin
    .from("classes")
    .select("id")
    .eq("id", classId)
    .eq("school_id", schoolId)
    .single();
  if (classError || !klass) throw ApiError.notFound("Class not found");

  const { data, error } = await supabaseAdmin
    .from("students")
    .update({ class_id: classId })
    .in("id", studentIds)
    .eq("school_id", schoolId)
    .select("id");
  if (error) throw ApiError.internal(error.message);

  return { updatedCount: data?.length ?? 0 };
}
