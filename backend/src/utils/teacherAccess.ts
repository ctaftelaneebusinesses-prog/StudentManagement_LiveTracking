import { Request, Response, NextFunction } from "express";
import { supabaseAdmin } from "../config/supabase";
import { ApiError } from "./ApiError";

const STAFF_ROLES = ["school_admin", "principal", "super_admin"];

export function isStaff(roles: string[]): boolean {
  return roles.some((role) => STAFF_ROLES.includes(role));
}

/**
 * Router-level guard for the `students.manage` actions that stay
 * staff-only even after migration 057 gave teachers `students.manage` for
 * their own classes: bulk operations (span classes outside any one
 * teacher's ownership), moving a student to a different class, and
 * deactivate/reactivate/permanent-delete (account-lifecycle actions, not
 * "edit this student's details").
 */
export function requireStaffOnly(req: Request, _res: Response, next: NextFunction) {
  if (!req.user) return next(ApiError.unauthorized());
  if (!isStaff(req.user.roles)) {
    return next(ApiError.forbidden("Staff only"));
  }
  next();
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

/** Looks up the student's class, then delegates to assertTeacherOwnsClass — used by every teacher-portal student-detail endpoint so a teacher can never reach a student outside their own classes. */
export async function assertTeacherOwnsStudent(req: Request, studentId: string): Promise<string> {
  const { data: student, error } = await supabaseAdmin
    .from("students")
    .select("class_id")
    .eq("id", studentId)
    .maybeSingle();
  if (error) throw ApiError.internal(error.message);
  if (!student?.class_id) throw ApiError.notFound("Student not found");

  await assertTeacherOwnsClass(req, student.class_id);
  return student.class_id;
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

/**
 * Router-level guard for `POST /students` and `PATCH /students/:id` (incl.
 * photo updates, which ride the same PATCH body) — lets a class/subject
 * teacher create or edit students in their own class, in addition to staff
 * (`students.manage`). On create, ownership is checked against the new
 * student's `class_id`; on update, against the *existing* student's class,
 * and a non-staff caller may never use this path to move a student to a
 * different class (that stays admin-only, via the dedicated
 * `PATCH /:id/class` endpoint).
 */
export async function requireStudentWriteAccess(req: Request, _res: Response, next: NextFunction) {
  try {
    const user = req.user;
    if (!user) throw ApiError.unauthorized();

    if (isStaff(user.roles) || user.permissions.includes("students.manage")) {
      return next();
    }
    if (!user.roles.includes("teacher")) {
      throw ApiError.forbidden("You do not have access to manage students");
    }

    const isCreate = req.method === "POST";
    if (isCreate) {
      const classId = req.body?.class_id as string | undefined;
      if (!classId) throw ApiError.forbidden("A class must be specified");
      await assertTeacherOwnsClass(req, classId);
      return next();
    }

    const studentId = req.params.id;
    const { data: student, error } = await supabaseAdmin
      .from("students")
      .select("class_id")
      .eq("id", studentId)
      .maybeSingle();
    if (error) throw ApiError.internal(error.message);
    if (!student?.class_id) throw ApiError.notFound("Student not found");

    const requestedClassId = req.body?.class_id as string | undefined;
    if (requestedClassId && requestedClassId !== student.class_id) {
      throw ApiError.forbidden("Only staff can move a student to a different class");
    }

    await assertTeacherOwnsClass(req, student.class_id);
    return next();
  } catch (err) {
    next(err);
  }
}

/**
 * Router-level guard for the `students.manage` sub-resource endpoints keyed
 * by an existing student's `:id` (parents, documents, siblings) — same
 * ownership rule as `requireStudentWriteAccess`, but for routes that don't
 * touch `class_id` directly. Staff bypass; a `teacher` caller must own the
 * target student's class via `assertTeacherOwnsClass`, so granting teachers
 * `students.manage` (see migration 057) doesn't hand them every student in
 * the school — only the ones in classes they teach.
 */
export async function requireStudentManageAccess(req: Request, _res: Response, next: NextFunction) {
  try {
    const user = req.user;
    if (!user) throw ApiError.unauthorized();

    if (isStaff(user.roles)) return next();
    if (!user.roles.includes("teacher")) {
      throw ApiError.forbidden("You do not have access to manage students");
    }

    await assertTeacherOwnsStudent(req, req.params.id);
    next();
  } catch (err) {
    next(err);
  }
}

/** Every student in a class this teacher owns (homeroom via classes.class_teacher_id, or a class_subjects assignment) — used to scope read-only cross-module views (e.g. transport monitoring) to only a teacher's own students, without granting them access to anyone else's. */
export async function listTeacherStudentIds(teacherId: string): Promise<string[]> {
  const [homeroom, subjects] = await Promise.all([
    supabaseAdmin.from("classes").select("id").eq("class_teacher_id", teacherId),
    supabaseAdmin.from("class_subjects").select("class_id").eq("teacher_id", teacherId),
  ]);
  if (homeroom.error) throw ApiError.internal(homeroom.error.message);
  if (subjects.error) throw ApiError.internal(subjects.error.message);

  const classIds = Array.from(
    new Set([...(homeroom.data ?? []).map((c) => c.id as string), ...(subjects.data ?? []).map((s) => s.class_id as string)])
  );
  if (classIds.length === 0) return [];

  const { data: students, error } = await supabaseAdmin.from("students").select("id").in("class_id", classIds);
  if (error) throw ApiError.internal(error.message);
  return (students ?? []).map((s) => s.id as string);
}

/** Non-throwing homeroom check — for call sites that need a boolean (e.g. "show everything" vs "show only my own") rather than an all-or-nothing guard. Staff are NOT treated as true here; check `isStaff` separately at the call site. */
export async function isClassTeacherOf(classId: string, userId: string): Promise<boolean> {
  const { data, error } = await supabaseAdmin
    .from("classes")
    .select("id")
    .eq("id", classId)
    .eq("class_teacher_id", userId)
    .maybeSingle();
  if (error) throw ApiError.internal(error.message);
  return !!data;
}

/**
 * Coordinator-only guard: unlike `assertTeacherOwnsClass` (which also lets any
 * subject teacher in), this requires the caller be staff or the class's actual
 * homeroom teacher (`classes.class_teacher_id`) — used for homework review/
 * approve and the marks-overview/reminder endpoints, which are the Class
 * Teacher's coordinator-only surface, not something any subject teacher should reach.
 */
export async function assertIsClassTeacher(req: Request, classId: string): Promise<void> {
  const user = req.user;
  if (!user) throw ApiError.unauthorized();
  if (isStaff(user.roles)) return;

  if (!(await isClassTeacherOf(classId, user.id))) {
    throw ApiError.forbidden("Only this class's class teacher can do that");
  }
}

/** For homework update/delete: staff bypass, else the caller must be the homework's creator or the homework's class teacher. */
export async function assertOwnHomeworkOrStaff(req: Request, homeworkId: string): Promise<void> {
  const user = req.user;
  if (!user) throw ApiError.unauthorized();
  if (isStaff(user.roles)) return;

  const { data: homework, error } = await supabaseAdmin
    .from("homework")
    .select("teacher_id, class_id")
    .eq("id", homeworkId)
    .maybeSingle();
  if (error) throw ApiError.internal(error.message);
  if (!homework) throw ApiError.notFound("Homework not found");

  if (homework.teacher_id === user.id) return;

  const { data: homeroom, error: homeroomError } = await supabaseAdmin
    .from("classes")
    .select("id")
    .eq("id", homework.class_id)
    .eq("class_teacher_id", user.id)
    .maybeSingle();
  if (homeroomError) throw ApiError.internal(homeroomError.message);
  if (homeroom) return;

  throw ApiError.forbidden("You can only manage homework you created");
}
