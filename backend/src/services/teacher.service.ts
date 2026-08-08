import { supabaseAdmin } from "../config/supabase";
import { ROLE_ID } from "../config/roles";
import { ApiError } from "../utils/ApiError";
import { escapeOrFilterValue } from "../utils/searchFilter";
import { provisionUser } from "../utils/provisionUser";
import { generateDefaultPassword } from "../utils/defaultPassword";

const TEACHER_SELECT =
  "id, employee_id, qualification, joining_date, experience_years, users(full_name, email, phone, avatar_url, is_active)";

interface ListTeachersFilters {
  search?: string;
  qualification?: string;
  status?: "active" | "inactive";
  classId?: string;
  subjectId?: string;
  page: number;
  pageSize: number;
}

/** Maps teacher_id -> the one class they're the class teacher of, for every teacher in the school. */
async function getHomeroomsByTeacher(schoolId: string) {
  const { data, error } = await supabaseAdmin
    .from("classes")
    .select("id, name, section, academic_year_id, class_teacher_id, academic_years(name)")
    .eq("school_id", schoolId)
    .not("class_teacher_id", "is", null);
  if (error) throw ApiError.internal(error.message);

  const map = new Map<string, unknown>();
  for (const row of data ?? []) {
    const { class_teacher_id, ...homeroom } = row as typeof row & { class_teacher_id: string };
    map.set(class_teacher_id, homeroom);
  }
  return map;
}

/** Maps teacher_id -> distinct subject count + class labels, from every class_subjects row assigning them as the subject teacher. */
async function getTeachingSummaryByTeacher(schoolId: string) {
  const { data, error } = await supabaseAdmin
    .from("class_subjects")
    .select("teacher_id, subject_id, classes!inner(name, section, school_id)")
    .eq("classes.school_id", schoolId)
    .not("teacher_id", "is", null);
  if (error) throw ApiError.internal(error.message);

  const bySubjects = new Map<string, Set<string>>();
  const byClasses = new Map<string, Set<string>>();
  for (const row of data ?? []) {
    const teacherId = row.teacher_id as string;
    const klass = row.classes as unknown as { name: string; section: string };

    if (!bySubjects.has(teacherId)) bySubjects.set(teacherId, new Set());
    bySubjects.get(teacherId)!.add(row.subject_id as string);

    if (!byClasses.has(teacherId)) byClasses.set(teacherId, new Set());
    byClasses.get(teacherId)!.add(`${klass.name} - ${klass.section}`);
  }

  const map = new Map<string, { subjectCount: number; classes: string[] }>();
  for (const teacherId of bySubjects.keys()) {
    map.set(teacherId, {
      subjectCount: bySubjects.get(teacherId)!.size,
      classes: Array.from(byClasses.get(teacherId) ?? []).sort(),
    });
  }
  return map;
}

export async function listTeachers(schoolId: string, filters: ListTeachersFilters) {
  // `status` filters on the joined `users.is_active` column, which PostgREST
  // can't filter server-side alongside an embedded select in the same query
  // as pagination — resolved via a separate id lookup, same approach as
  // search below, so pagination/count stay accurate at the DB level.
  let statusUserIds: string[] | null = null;
  if (filters.status) {
    const { data: statusUsers, error: statusError } = await supabaseAdmin
      .from("users")
      .select("id")
      .eq("school_id", schoolId)
      .eq("is_active", filters.status === "active");
    if (statusError) throw ApiError.internal(statusError.message);
    statusUserIds = (statusUsers ?? []).map((u) => u.id);

    if (statusUserIds.length === 0) {
      return { items: [], total: 0, page: filters.page, pageSize: filters.pageSize };
    }
  }

  // Class/Subject filters ("show all teachers teaching Grade 8") resolve
  // through class_subjects — a teacher matches if they teach that class
  // and/or subject there, OR are its homeroom/class teacher.
  let classSubjectTeacherIds: string[] | null = null;
  if (filters.classId || filters.subjectId) {
    let assignmentQuery = supabaseAdmin.from("class_subjects").select("teacher_id").not("teacher_id", "is", null);
    if (filters.classId) assignmentQuery = assignmentQuery.eq("class_id", filters.classId);
    if (filters.subjectId) assignmentQuery = assignmentQuery.eq("subject_id", filters.subjectId);
    const { data: assignments, error: assignmentError } = await assignmentQuery;
    if (assignmentError) throw ApiError.internal(assignmentError.message);

    const teacherIds = new Set((assignments ?? []).map((a) => a.teacher_id as string));

    if (filters.classId && !filters.subjectId) {
      const { data: klass, error: classError } = await supabaseAdmin
        .from("classes")
        .select("class_teacher_id")
        .eq("id", filters.classId)
        .eq("school_id", schoolId)
        .maybeSingle();
      if (classError) throw ApiError.internal(classError.message);
      if (klass?.class_teacher_id) teacherIds.add(klass.class_teacher_id);
    }

    classSubjectTeacherIds = Array.from(teacherIds);
    if (classSubjectTeacherIds.length === 0) {
      return { items: [], total: 0, page: filters.page, pageSize: filters.pageSize };
    }
  }

  let query = supabaseAdmin
    .from("teachers")
    .select(TEACHER_SELECT, { count: "exact" })
    .eq("school_id", schoolId)
    .order("employee_id");

  if (filters.qualification) query = query.eq("qualification", filters.qualification);
  if (statusUserIds) query = query.in("id", statusUserIds);
  if (classSubjectTeacherIds) query = query.in("id", classSubjectTeacherIds);

  if (filters.search) {
    const pattern = escapeOrFilterValue(`%${filters.search}%`);

    // employee_id lives on `teachers`; name/email live on the joined `users`
    // row — same two-step resolve-then-OR approach as student search.
    const { data: matchingUsers, error: userSearchError } = await supabaseAdmin
      .from("users")
      .select("id")
      .eq("school_id", schoolId)
      .or(`full_name.ilike.${pattern},email.ilike.${pattern}`);
    if (userSearchError) throw ApiError.internal(userSearchError.message);

    const matchingIds = (matchingUsers ?? []).map((u) => u.id);
    const idFilter = matchingIds.length > 0 ? `,id.in.(${matchingIds.join(",")})` : "";
    query = query.or(`employee_id.ilike.${pattern}${idFilter}`);
  }

  const from = (filters.page - 1) * filters.pageSize;
  const to = from + filters.pageSize - 1;
  query = query.range(from, to);

  const { data, error, count } = await query;
  if (error) throw ApiError.internal(error.message);

  const homerooms = await getHomeroomsByTeacher(schoolId);
  const teachingSummaries = await getTeachingSummaryByTeacher(schoolId);
  const items = (data ?? []).map((row) => ({
    ...row,
    homeroom: homerooms.get(row.id) ?? null,
    teaching: teachingSummaries.get(row.id) ?? { subjectCount: 0, classes: [] },
  }));

  return { items, total: count ?? 0, page: filters.page, pageSize: filters.pageSize };
}

export async function getTeacher(schoolId: string, teacherId: string) {
  const { data, error } = await supabaseAdmin
    .from("teachers")
    .select(TEACHER_SELECT)
    .eq("id", teacherId)
    .eq("school_id", schoolId)
    .single();
  if (error || !data) throw ApiError.notFound("Teacher not found");

  // Plain select + take-first rather than .maybeSingle(): a teacher is only
  // ever *supposed* to be class teacher of one class (setHomeroomTeacher
  // enforces that going forward), but .maybeSingle() throws on any
  // pre-existing data that has more than one row, which would 500 this
  // whole endpoint over a data issue instead of just showing one of them.
  const { data: homeroomRows, error: homeroomError } = await supabaseAdmin
    .from("classes")
    .select("id, name, section, academic_year_id, academic_years(name)")
    .eq("class_teacher_id", teacherId)
    .eq("school_id", schoolId)
    .limit(1);
  if (homeroomError) throw ApiError.internal(homeroomError.message);

  return { ...data, homeroom: homeroomRows?.[0] ?? null };
}

export async function createTeacher(
  schoolId: string,
  input: {
    email: string;
    full_name: string;
    phone?: string;
    password?: string;
    employee_id: string;
    qualification?: string;
    joining_date?: string;
    experience_years?: number;
  }
) {
  const password = input.password || generateDefaultPassword(input.full_name, input.employee_id);
  const provisioned = await provisionUser({
    email: input.email,
    password,
    full_name: input.full_name,
    role_id: ROLE_ID.TEACHER,
    school_id: schoolId,
  });

  if (input.phone) {
    await supabaseAdmin.from("users").update({ phone: input.phone }).eq("id", provisioned.id);
  }

  const { error: teacherError } = await supabaseAdmin.from("teachers").insert({
    id: provisioned.id,
    school_id: schoolId,
    employee_id: input.employee_id,
    qualification: input.qualification,
    joining_date: input.joining_date,
    experience_years: input.experience_years,
  });

  if (teacherError) {
    await supabaseAdmin.auth.admin.deleteUser(provisioned.id);
    if (teacherError.code === "23505") {
      throw ApiError.conflict("A teacher with this employee ID already exists");
    }
    throw ApiError.internal(teacherError.message);
  }

  return getTeacher(schoolId, provisioned.id);
}

export async function updateTeacher(schoolId: string, teacherId: string, patch: Record<string, unknown>) {
  const { full_name, phone, is_active, avatar_url, ...teacherPatch } = patch as {
    full_name?: string;
    phone?: string;
    is_active?: boolean;
    avatar_url?: string | null;
    [key: string]: unknown;
  };

  if (full_name !== undefined || phone !== undefined || is_active !== undefined || avatar_url !== undefined) {
    const userPatch: Record<string, unknown> = {};
    if (full_name !== undefined) userPatch.full_name = full_name;
    if (phone !== undefined) userPatch.phone = phone;
    if (is_active !== undefined) userPatch.is_active = is_active;
    if (avatar_url !== undefined) userPatch.avatar_url = avatar_url;

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

/**
 * Assigns a teacher to teach several subjects (each a distinct class+subject
 * slot) in one request. Every slot must either be unassigned or already
 * belong to this same teacher — a slot held by a different teacher is a
 * conflict, not a silent overwrite, so this rejects the whole batch rather
 * than partially applying it.
 */
export async function bulkAssignSubjects(
  schoolId: string,
  teacherId: string,
  assignments: { class_id: string; subject_id: string }[]
) {
  const classIds = Array.from(new Set(assignments.map((a) => a.class_id)));
  const subjectIds = Array.from(new Set(assignments.map((a) => a.subject_id)));

  const { data: classes, error: classError } = await supabaseAdmin
    .from("classes")
    .select("id")
    .eq("school_id", schoolId)
    .in("id", classIds);
  if (classError) throw ApiError.internal(classError.message);
  if ((classes ?? []).length !== classIds.length) throw ApiError.notFound("One or more classes not found");

  const { data: subjects, error: subjectError } = await supabaseAdmin
    .from("subjects")
    .select("id, name")
    .eq("school_id", schoolId)
    .in("id", subjectIds);
  if (subjectError) throw ApiError.internal(subjectError.message);
  if ((subjects ?? []).length !== subjectIds.length) throw ApiError.notFound("One or more subjects not found");
  const subjectNameById = new Map((subjects ?? []).map((s) => [s.id, s.name]));

  const { data: existing, error: existingError } = await supabaseAdmin
    .from("class_subjects")
    .select("class_id, subject_id, teacher_id")
    .in("class_id", classIds);
  if (existingError) throw ApiError.internal(existingError.message);

  const existingBySlot = new Map((existing ?? []).map((row) => [`${row.class_id}:${row.subject_id}`, row]));
  for (const { class_id, subject_id } of assignments) {
    const slot = existingBySlot.get(`${class_id}:${subject_id}`);
    if (slot?.teacher_id && slot.teacher_id !== teacherId) {
      throw ApiError.conflict(
        `Another teacher is already assigned to teach ${subjectNameById.get(subject_id) ?? "this subject"} for this class`
      );
    }
  }

  const rows = assignments.map((a) => ({ class_id: a.class_id, subject_id: a.subject_id, teacher_id: teacherId }));
  const { data, error } = await supabaseAdmin
    .from("class_subjects")
    .upsert(rows, { onConflict: "class_id,subject_id" })
    .select();
  if (error) throw ApiError.internal(error.message);
  return data;
}

/** Sets a teacher as the homeroom/class teacher for a class. */
export async function setHomeroomTeacher(
  schoolId: string,
  teacherId: string,
  classId: string,
  force = false
) {
  const { data: klass, error: classError } = await supabaseAdmin
    .from("classes")
    .select("id, class_teacher_id, name, section, class_teacher:users(full_name)")
    .eq("id", classId)
    .eq("school_id", schoolId)
    .single();
  if (classError || !klass) throw ApiError.notFound("Class not found");

  if (klass.class_teacher_id && klass.class_teacher_id !== teacherId && !force) {
    const existingName = (klass.class_teacher as unknown as { full_name: string } | null)?.full_name ?? "another teacher";
    throw ApiError.conflict(
      `${existingName} is already the class teacher for ${klass.name} - ${klass.section}`,
      { existingTeacherName: existingName }
    );
  }

  // A teacher can be homeroom of only one class at a time — release any other
  // class currently pointing at them before assigning the new one.
  const { error: releaseError } = await supabaseAdmin
    .from("classes")
    .update({ class_teacher_id: null })
    .eq("school_id", schoolId)
    .eq("class_teacher_id", teacherId)
    .neq("id", classId);
  if (releaseError) throw ApiError.internal(releaseError.message);

  const { data, error } = await supabaseAdmin
    .from("classes")
    .update({ class_teacher_id: teacherId })
    .eq("id", classId)
    .eq("school_id", schoolId)
    .select("id, name, section, academic_year_id, academic_years(name)")
    .single();
  if (error) throw ApiError.internal(error.message);
  if (!data) throw ApiError.notFound("Class not found");
  return data;
}

/** Clears whatever class currently has this teacher as class teacher, if any. */
export async function clearHomeroomTeacher(schoolId: string, teacherId: string) {
  const { error } = await supabaseAdmin
    .from("classes")
    .update({ class_teacher_id: null })
    .eq("school_id", schoolId)
    .eq("class_teacher_id", teacherId);
  if (error) throw ApiError.internal(error.message);
}

export async function listTeacherAssignments(schoolId: string, teacherId: string) {
  const { data, error } = await supabaseAdmin
    .from("class_subjects")
    .select(
      "id, class_id, subject_id, classes!inner(name, section, school_id, academic_years(name)), subjects(name, code)"
    )
    .eq("teacher_id", teacherId)
    .eq("classes.school_id", schoolId);
  if (error) throw ApiError.internal(error.message);
  return data;
}
