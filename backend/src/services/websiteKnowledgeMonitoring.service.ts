import { supabaseAdmin } from "../config/supabase";
import { ApiError } from "../utils/ApiError";
import { QuizRole } from "../config/websiteKnowledge";
import { isClassTeacherOf } from "../utils/teacherAccess";

export type AssessmentStatus = "not_attempted" | "in_progress" | "failed" | "passed" | "certified";

interface ProgressInfo {
  attempt_count: number;
  latest_attempt: {
    id: string;
    attempt_number: number;
    percentage: number | null;
    passed: boolean | null;
    completed_at: string | null;
  } | null;
  certificate: { id: string; certificate_number: string; percentage: number; issued_at: string } | null;
  status: AssessmentStatus;
}

/** One combined lookup of every user's latest completed attempt + in-progress flag + certificate, for a monitoring list. */
async function getProgressByUser(userIds: string[], roleName: QuizRole): Promise<Map<string, ProgressInfo>> {
  const result = new Map<string, ProgressInfo>();
  if (userIds.length === 0) return result;

  const [{ data: attempts, error: attemptsError }, { data: certs, error: certsError }] = await Promise.all([
    supabaseAdmin
      .from("website_knowledge_attempts")
      .select("id, user_id, attempt_number, percentage, passed, status, completed_at")
      .in("user_id", userIds)
      .eq("role_name", roleName)
      .order("completed_at", { ascending: false }),
    supabaseAdmin
      .from("website_knowledge_certificates")
      .select("id, user_id, certificate_number, percentage, issued_at")
      .in("user_id", userIds)
      .eq("role_name", roleName),
  ]);
  if (attemptsError) throw ApiError.internal(attemptsError.message);
  if (certsError) throw ApiError.internal(certsError.message);

  const certByUser = new Map((certs ?? []).map((c) => [c.user_id as string, c]));

  const byUser = new Map<string, typeof attempts>();
  for (const a of attempts ?? []) {
    const list = byUser.get(a.user_id as string) ?? [];
    list.push(a);
    byUser.set(a.user_id as string, list as never);
  }

  for (const userId of userIds) {
    const userAttempts = (byUser.get(userId) ?? []) as unknown as {
      id: string;
      attempt_number: number;
      percentage: number | null;
      passed: boolean | null;
      status: "in_progress" | "completed";
      completed_at: string | null;
    }[];
    const completed = userAttempts.filter((a) => a.status === "completed");
    const hasInProgress = userAttempts.some((a) => a.status === "in_progress");
    const latest = completed[0] ?? null; // already ordered desc by completed_at
    const cert = certByUser.get(userId) ?? null;

    let status: AssessmentStatus = "not_attempted";
    if (latest) {
      status = latest.passed ? (cert ? "certified" : "passed") : "failed";
    } else if (hasInProgress) {
      status = "in_progress";
    }

    result.set(userId, {
      attempt_count: completed.length,
      latest_attempt: latest
        ? { id: latest.id, attempt_number: latest.attempt_number, percentage: latest.percentage, passed: latest.passed, completed_at: latest.completed_at }
        : null,
      certificate: cert ? { id: cert.id as string, certificate_number: cert.certificate_number as string, percentage: cert.percentage as number, issued_at: cert.issued_at as string } : null,
      status,
    });
  }

  return result;
}

const EMPTY_PROGRESS: ProgressInfo = { attempt_count: 0, latest_attempt: null, certificate: null, status: "not_attempted" };

// ---------------------------------------------------------------------------
// Class Teacher -> Students (spec §15-17)
// ---------------------------------------------------------------------------

export async function listStudentsForClassTeacher(teacherId: string) {
  const { data: classes, error: classesError } = await supabaseAdmin.from("classes").select("id, name, section").eq("class_teacher_id", teacherId);
  if (classesError) throw ApiError.internal(classesError.message);
  const classIds = (classes ?? []).map((c) => c.id as string);
  if (classIds.length === 0) return [];
  const classById = new Map((classes ?? []).map((c) => [c.id as string, c]));

  const { data: students, error: studentsError } = await supabaseAdmin
    .from("students")
    .select("id, class_id, users:users!students_id_fkey(full_name, avatar_url)")
    .in("class_id", classIds);
  if (studentsError) throw ApiError.internal(studentsError.message);

  type StudentRow = { id: string; class_id: string; users: { full_name: string; avatar_url: string | null } | null };
  const rows = (students ?? []) as unknown as StudentRow[];
  const progress = await getProgressByUser(rows.map((s) => s.id), "student");

  return rows.map((s) => {
    const klass = classById.get(s.class_id);
    return {
      student_id: s.id,
      full_name: s.users?.full_name ?? "Unknown",
      avatar_url: s.users?.avatar_url ?? null,
      class_name: klass?.name ?? null,
      section: klass?.section ?? null,
      ...(progress.get(s.id) ?? EMPTY_PROGRESS),
    };
  });
}

export async function getStudentDetailForClassTeacher(teacherId: string, studentId: string) {
  const { data: student, error } = await supabaseAdmin.from("students").select("class_id").eq("id", studentId).maybeSingle();
  if (error) throw ApiError.internal(error.message);
  if (!student?.class_id) throw ApiError.notFound("Student not found");
  if (!(await isClassTeacherOf(student.class_id, teacherId))) {
    throw ApiError.forbidden("You are not this student's class teacher");
  }
  return studentId;
}

export async function getClassTeacherSummary(teacherId: string) {
  const students = await listStudentsForClassTeacher(teacherId);
  return summarize(students);
}

/** Full attempt history + certificate for one target user — shared by every "view details" drawer (spec §17), each gated by its own role-specific ownership check before calling this. */
export async function getAttemptHistoryForUser(userId: string, roleName: QuizRole) {
  const { data: attempts, error } = await supabaseAdmin
    .from("website_knowledge_attempts")
    .select(
      "id, attempt_number, total_questions, correct_answers, wrong_answers, percentage, passed, status, started_at, completed_at, website_knowledge_question_sets(name, set_number)"
    )
    .eq("user_id", userId)
    .eq("role_name", roleName)
    .order("attempt_number", { ascending: false });
  if (error) throw ApiError.internal(error.message);

  const { data: certificate, error: certError } = await supabaseAdmin
    .from("website_knowledge_certificates")
    .select("id, certificate_number, score, percentage, issued_at")
    .eq("user_id", userId)
    .eq("role_name", roleName)
    .maybeSingle();
  if (certError) throw ApiError.internal(certError.message);

  return { attempts: attempts ?? [], certificate };
}

/** Verifies a target teacher belongs to this principal's school before the principal may view their detail/history. */
export async function assertTeacherInPrincipalSchool(schoolId: string, teacherId: string) {
  const { data, error } = await supabaseAdmin
    .from("users")
    .select("id, roles(name)")
    .eq("id", teacherId)
    .eq("school_id", schoolId)
    .maybeSingle();
  if (error) throw ApiError.internal(error.message);
  if (!data) throw ApiError.notFound("Teacher not found in your school");
}

/** Verifies a target principal belongs to one of this school_admin's accessible schools. A super_admin (unbounded — accessibleSchoolIds is always []) bypasses the check entirely, matching its platform-wide reporting access. */
export async function assertPrincipalInAccessibleSchool(accessibleSchoolIds: string[], principalId: string, isSuperAdmin = false) {
  if (isSuperAdmin) return;
  const { data, error } = await supabaseAdmin.from("users").select("id, school_id").eq("id", principalId).maybeSingle();
  if (error) throw ApiError.internal(error.message);
  if (!data || !data.school_id || !accessibleSchoolIds.includes(data.school_id)) {
    throw ApiError.notFound("Principal not found in your assigned schools");
  }
}

/** Every school id in the platform — used when a super_admin (whose accessibleSchoolIds is always empty, being unbounded) needs the full principal roster rather than an assignment-scoped one. */
export async function listAllSchoolIds(): Promise<string[]> {
  const { data, error } = await supabaseAdmin.from("schools").select("id");
  if (error) throw ApiError.internal(error.message);
  return (data ?? []).map((s) => s.id as string);
}

/** Verifies a target user actually holds the school_admin role — super_admin's global view. */
export async function assertIsSchoolAdmin(schoolAdminId: string) {
  const { data, error } = await supabaseAdmin
    .from("user_roles")
    .select("user_id, roles!inner(name)")
    .eq("user_id", schoolAdminId)
    .eq("roles.name", "school_admin")
    .maybeSingle();
  if (error) throw ApiError.internal(error.message);
  if (!data) throw ApiError.notFound("School Admin not found");
}

// ---------------------------------------------------------------------------
// Teacher -> Principal (spec §18)
// ---------------------------------------------------------------------------

export async function listTeachersForPrincipal(schoolId: string) {
  const { data, error } = await supabaseAdmin
    .from("user_roles")
    .select("user_id, roles!inner(name), users:users!inner(id, full_name, avatar_url, school_id)")
    .eq("roles.name", "teacher")
    .eq("users.school_id", schoolId);
  if (error) throw ApiError.internal(error.message);

  type Row = { user_id: string; users: { id: string; full_name: string; avatar_url: string | null } };
  const rows = (data ?? []) as unknown as Row[];
  const progress = await getProgressByUser(rows.map((r) => r.user_id), "teacher");

  return rows.map((r) => ({
    teacher_id: r.user_id,
    full_name: r.users.full_name,
    avatar_url: r.users.avatar_url,
    ...(progress.get(r.user_id) ?? EMPTY_PROGRESS),
  }));
}

export async function getPrincipalSummary(schoolId: string) {
  const teachers = await listTeachersForPrincipal(schoolId);
  return summarize(teachers);
}

// ---------------------------------------------------------------------------
// Principal -> School Admin (spec §19)
// ---------------------------------------------------------------------------

export async function listPrincipalsForSchoolAdmin(accessibleSchoolIds: string[]) {
  if (accessibleSchoolIds.length === 0) return [];
  const { data, error } = await supabaseAdmin
    .from("user_roles")
    .select("user_id, roles!inner(name), users:users!inner(id, full_name, avatar_url, school_id, schools:schools!users_school_id_fkey(name))")
    .eq("roles.name", "principal")
    .in("users.school_id", accessibleSchoolIds);
  if (error) throw ApiError.internal(error.message);

  type Row = { user_id: string; users: { id: string; full_name: string; avatar_url: string | null; school_id: string; schools: { name: string } | null } };
  const rows = (data ?? []) as unknown as Row[];
  const progress = await getProgressByUser(rows.map((r) => r.user_id), "principal");

  return rows.map((r) => ({
    principal_id: r.user_id,
    full_name: r.users.full_name,
    avatar_url: r.users.avatar_url,
    school_name: r.users.schools?.name ?? null,
    ...(progress.get(r.user_id) ?? EMPTY_PROGRESS),
  }));
}

// ---------------------------------------------------------------------------
// School Admin -> Super Admin (spec §20)
// ---------------------------------------------------------------------------

export async function listSchoolAdminsForSuperAdmin() {
  const { data, error } = await supabaseAdmin
    .from("user_roles")
    .select("user_id, roles!inner(name), users:users!inner(id, full_name, avatar_url, school_id, schools:schools!users_school_id_fkey(name))")
    .eq("roles.name", "school_admin");
  if (error) throw ApiError.internal(error.message);

  type Row = { user_id: string; users: { id: string; full_name: string; avatar_url: string | null; school_id: string | null; schools: { name: string } | null } };
  const rows = (data ?? []) as unknown as Row[];
  const uniqueByUser = new Map(rows.map((r) => [r.user_id, r]));
  const progress = await getProgressByUser(Array.from(uniqueByUser.keys()), "school_admin");

  return Array.from(uniqueByUser.values()).map((r) => ({
    school_admin_id: r.user_id,
    full_name: r.users.full_name,
    avatar_url: r.users.avatar_url,
    school_name: r.users.schools?.name ?? null,
    ...(progress.get(r.user_id) ?? EMPTY_PROGRESS),
  }));
}

export async function getGlobalStats() {
  const schoolAdmins = await listSchoolAdminsForSuperAdmin();
  const byRole: Record<string, ReturnType<typeof summarize>> = {};
  for (const role of ["student", "teacher", "principal", "school_admin", "accountant", "driver", "extracurricular_staff"] as QuizRole[]) {
    const { data, error } = await supabaseAdmin
      .from("user_roles")
      .select("user_id, roles!inner(name)")
      .eq("roles.name", role);
    if (error) throw ApiError.internal(error.message);
    const userIds = Array.from(new Set((data ?? []).map((r) => r.user_id as string)));
    const progress = await getProgressByUser(userIds, role);
    byRole[role] = summarize(userIds.map((id) => progress.get(id) ?? EMPTY_PROGRESS));
  }

  const totals = Object.values(byRole).reduce(
    (acc, s) => ({
      total: acc.total + s.total,
      completed: acc.completed + s.completed,
      not_attempted: acc.not_attempted + s.not_attempted,
      passed: acc.passed + s.passed,
      failed: acc.failed + s.failed,
      certified: acc.certified + s.certified,
    }),
    { total: 0, completed: 0, not_attempted: 0, passed: 0, failed: 0, certified: 0 }
  );

  return {
    total_users: totals.total,
    total_completed: totals.completed,
    total_not_attempted: totals.not_attempted,
    total_passed: totals.passed,
    total_failed: totals.failed,
    total_certified: totals.certified,
    overall_pass_percentage: totals.completed > 0 ? Math.round((totals.passed / totals.completed) * 10000) / 100 : 0,
    by_role: byRole,
    school_admins_overview: schoolAdmins,
  };
}

// ---------------------------------------------------------------------------
// Shared summary shape (spec §32-34)
// ---------------------------------------------------------------------------

function summarize(rows: { status: AssessmentStatus }[]) {
  const total = rows.length;
  const not_attempted = rows.filter((r) => r.status === "not_attempted").length;
  const in_progress = rows.filter((r) => r.status === "in_progress").length;
  const failed = rows.filter((r) => r.status === "failed").length;
  const passed = rows.filter((r) => r.status === "passed" || r.status === "certified").length;
  const certified = rows.filter((r) => r.status === "certified").length;
  const completed = failed + passed;
  return { total, completed, not_attempted, in_progress, passed, failed, certified };
}
