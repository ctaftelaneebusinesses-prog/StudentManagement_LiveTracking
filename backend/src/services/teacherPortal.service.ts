import { supabaseAdmin } from "../config/supabase";
import { ApiError } from "../utils/ApiError";
import * as studentService from "./student.service";
import * as attendanceService from "./attendance.service";
import * as examService from "./exam.service";
import * as homeworkService from "./homework.service";
import * as feesService from "./fees.service";
import * as studentDocumentService from "./studentDocument.service";
import * as leaveRequestService from "./leaveRequest.service";

interface ClassSubjectRow {
  class_id: string;
  classes: { id: string; name: string; section: string; school_id: string } | null;
  subject_id: string;
  subjects: { id: string; name: string; code: string } | null;
}

interface HomeroomClassRow {
  id: string;
  name: string;
  section: string;
}

interface TeacherClassSummary {
  id: string;
  name: string;
  section: string;
  isHomeroom: boolean;
  subjects: { id: string; name: string; code: string }[];
  studentCount: number;
}

/** Assigned classes + subjects (from class_subjects) merged with homeroom classes (classes.class_teacher_id), each with a student count. */
export async function getDashboard(schoolId: string, teacherId: string) {
  const [assignmentsResult, homeroomResult] = await Promise.all([
    supabaseAdmin
      .from("class_subjects")
      .select("class_id, classes!inner(id, name, section, school_id), subject_id, subjects(id, name, code)")
      .eq("teacher_id", teacherId)
      .eq("classes.school_id", schoolId),
    supabaseAdmin
      .from("classes")
      .select("id, name, section")
      .eq("class_teacher_id", teacherId)
      .eq("school_id", schoolId),
  ]);

  if (assignmentsResult.error) throw ApiError.internal(assignmentsResult.error.message);
  if (homeroomResult.error) throw ApiError.internal(homeroomResult.error.message);

  const assignments = (assignmentsResult.data ?? []) as unknown as ClassSubjectRow[];
  const homeroomClasses = (homeroomResult.data ?? []) as HomeroomClassRow[];

  const byClass = new Map<string, TeacherClassSummary>();

  for (const row of assignments) {
    if (!row.classes) continue;
    if (!byClass.has(row.class_id)) {
      byClass.set(row.class_id, {
        id: row.classes.id,
        name: row.classes.name,
        section: row.classes.section,
        isHomeroom: false,
        subjects: [],
        studentCount: 0,
      });
    }
    if (row.subjects) {
      byClass.get(row.class_id)!.subjects.push(row.subjects);
    }
  }

  for (const klass of homeroomClasses) {
    if (!byClass.has(klass.id)) {
      byClass.set(klass.id, {
        id: klass.id,
        name: klass.name,
        section: klass.section,
        isHomeroom: true,
        subjects: [],
        studentCount: 0,
      });
    } else {
      byClass.get(klass.id)!.isHomeroom = true;
    }
  }

  const classIds = Array.from(byClass.keys());
  if (classIds.length > 0) {
    const { data: students, error: studentsError } = await supabaseAdmin
      .from("students")
      .select("class_id")
      .eq("school_id", schoolId)
      .in("class_id", classIds);
    if (studentsError) throw ApiError.internal(studentsError.message);

    for (const student of students ?? []) {
      const entry = byClass.get(student.class_id as string);
      if (entry) entry.studentCount += 1;
    }
  }

  const classes = Array.from(byClass.values()).sort((a, b) => a.name.localeCompare(b.name) || a.section.localeCompare(b.section));
  const totalSubjects = new Set(classes.flatMap((c) => c.subjects.map((s) => s.id))).size;
  const totalStudents = classes.reduce((sum, c) => sum + c.studentCount, 0);

  const [todayClasses, pendingHomeworkCount, upcomingAssessments, leaveSummary] = await Promise.all([
    getTodayTimetable(schoolId, teacherId),
    countPendingHomework(schoolId, classIds, teacherId),
    examService.listUpcomingAssessmentsForClasses(schoolId, classIds),
    leaveRequestService.getLeaveSummary(schoolId, teacherId, "teacher"),
  ]);

  return {
    classes,
    totalClasses: classes.length,
    totalSubjects,
    totalStudents,
    todayClassesCount: todayClasses.length,
    pendingHomeworkCount,
    upcomingAssessmentsCount: upcomingAssessments.length,
    leaveBalance: leaveSummary.totalRemaining,
    pendingLeaveRequestsCount: leaveSummary.pendingCount,
  };
}

/** Homework this teacher assigned to their own classes that's still open (due today or later). */
async function countPendingHomework(schoolId: string, classIds: string[], teacherId: string): Promise<number> {
  if (classIds.length === 0) return 0;
  const today = new Date().toISOString().slice(0, 10);

  const { count, error } = await supabaseAdmin
    .from("homework")
    .select("id", { count: "exact", head: true })
    .eq("school_id", schoolId)
    .eq("teacher_id", teacherId)
    .in("class_id", classIds)
    .gte("due_date", today);
  if (error) throw ApiError.internal(error.message);
  return count ?? 0;
}

interface TeacherProfileRow {
  id: string;
  employee_id: string;
  qualification: string | null;
  experience_years: number | null;
  joining_date: string;
  address: string | null;
  users: { full_name: string; email: string; phone: string | null; avatar_url: string | null } | null;
  schools: { name: string } | null;
}

interface HomeroomClassRow2 {
  id: string;
  name: string;
  section: string;
  academic_years: { name: string } | null;
}

/** Own profile + (if applicable) the class this teacher is homeroom/class-teacher of, with strength. */
export async function getProfile(schoolId: string, teacherId: string) {
  const { data, error } = await supabaseAdmin
    .from("teachers")
    .select(
      "id, employee_id, qualification, experience_years, joining_date, address, " +
        "users(full_name, email, phone, avatar_url), schools(name)"
    )
    .eq("id", teacherId)
    .eq("school_id", schoolId)
    .single();
  if (error || !data) throw ApiError.notFound("Teacher profile not found");
  const teacher = data as unknown as TeacherProfileRow;

  // A teacher can end up assigned as class-teacher of more than one class
  // (nothing in the schema prevents it), so this can't assume a single row —
  // just show the first one rather than erroring the whole profile out.
  const { data: homeroomRows, error: homeroomError } = await supabaseAdmin
    .from("classes")
    .select("id, name, section, academic_years(name)")
    .eq("class_teacher_id", teacherId)
    .eq("school_id", schoolId)
    .limit(1);
  if (homeroomError) throw ApiError.internal(homeroomError.message);
  const homeroomClass = (homeroomRows?.[0] as unknown as HomeroomClassRow2 | undefined) ?? null;

  let classTeacherOf = null;
  if (homeroomClass) {
    const { count, error: countError } = await supabaseAdmin
      .from("students")
      .select("id", { count: "exact", head: true })
      .eq("school_id", schoolId)
      .eq("class_id", homeroomClass.id);
    if (countError) throw ApiError.internal(countError.message);

    classTeacherOf = {
      classId: homeroomClass.id,
      className: homeroomClass.name,
      section: homeroomClass.section,
      academicYear: homeroomClass.academic_years?.name ?? "",
      totalStudents: count ?? 0,
    };
  }

  return { ...teacher, isClassTeacher: !!homeroomClass, classTeacherOf };
}

/**
 * Self-service profile edit — `full_name`/`phone` live on `users`, `address`
 * on `teachers`; both updates go through the service-role client because
 * `teachers_write_staff` (rls_policies.sql) only lets staff write that table,
 * not the teacher themself. Qualification/experience/employee ID stay
 * admin-managed and are never accepted here.
 */
export async function updateProfile(
  schoolId: string,
  teacherId: string,
  patch: { full_name?: string; phone?: string | null; address?: string | null }
) {
  const { full_name, phone, address } = patch;

  if (full_name !== undefined || phone !== undefined) {
    const userPatch: Record<string, unknown> = {};
    if (full_name !== undefined) userPatch.full_name = full_name;
    if (phone !== undefined) userPatch.phone = phone;

    const { error } = await supabaseAdmin.from("users").update(userPatch).eq("id", teacherId).eq("school_id", schoolId);
    if (error) throw ApiError.internal(error.message);
  }

  if (address !== undefined) {
    const { error } = await supabaseAdmin
      .from("teachers")
      .update({ address })
      .eq("id", teacherId)
      .eq("school_id", schoolId);
    if (error) throw ApiError.internal(error.message);
  }

  return getProfile(schoolId, teacherId);
}

interface MyStudentRow {
  id: string;
  admission_no: string;
  roll_no: string | null;
  class_id: string;
  father_name: string | null;
  father_phone: string | null;
  mother_name: string | null;
  mother_phone: string | null;
  users: { full_name: string; email: string; phone: string | null; avatar_url: string | null } | null;
}

/** Roster for one class, enriched with attendance % and fee status — the Class Teacher's full student list, and reused (with the same columns) for a subject-teacher's filtered list. Ownership is checked by the caller. */
export async function listMyStudents(schoolId: string, classId: string) {
  const { data, error } = await supabaseAdmin
    .from("students")
    .select(
      "id, admission_no, roll_no, class_id, father_name, father_phone, mother_name, mother_phone, " +
        "users(full_name, email, phone, avatar_url)"
    )
    .eq("school_id", schoolId)
    .eq("class_id", classId)
    .order("roll_no");
  if (error) throw ApiError.internal(error.message);
  const students = (data ?? []) as unknown as MyStudentRow[];
  if (students.length === 0) return [];

  const [attendanceRows, feeDetails] = await Promise.all([
    attendanceService.getStudentWiseReport(schoolId, classId),
    feesService.listStudentFeeDetails(schoolId, { classId, status: "all", page: 1, pageSize: 1000 }),
  ]);

  const attendanceByStudent = new Map<string, number | null>(
    (attendanceRows as unknown as { student_id: string; present_pct: number | null }[]).map((r) => [r.student_id, r.present_pct])
  );
  const feeByStudent = new Map(feeDetails.items.map((f) => [f.id, f]));

  return students.map((s) => {
    const fee = feeByStudent.get(s.id);
    return {
      ...s,
      attendancePercentage: attendanceByStudent.get(s.id) ?? null,
      fee: fee ? { due: fee.due, paid: fee.paid, balance: fee.balance, status: fee.status } : null,
    };
  });
}

/**
 * Full student profile for the Teacher Portal's "View" drawer — combines the
 * same building blocks the admin Student Profile page uses (profile,
 * attendance, marks, homework, fees, documents) but read-only, and only ever
 * reached after the caller has verified class ownership.
 */
export async function getStudentDetail(schoolId: string, studentId: string) {
  const [profile, attendance, marksSummary, homework, fees, documents] = await Promise.all([
    studentService.getStudentProfile(schoolId, studentId),
    attendanceService.getSummaryForStudent(schoolId, studentId),
    examService.getMarksSummaryForStudent(schoolId, studentId),
    homeworkService.listAllForStudent(schoolId, studentId),
    feesService.getFeeSummary(schoolId, studentId).catch(() => null),
    studentDocumentService.listDocuments(schoolId, studentId).catch(() => []),
  ]);

  return { profile, attendance, marks: marksSummary, homework, fees, documents };
}

/** Today's periods across every class this teacher teaches, ordered by period number — the Teacher Portal's "Today's Timetable". */
export async function getTodayTimetable(schoolId: string, teacherId: string) {
  const dayOfWeek = new Date().getDay(); // 0 = Sunday .. 6 = Saturday, matching timetable_periods.day_of_week

  const { data, error } = await supabaseAdmin
    .from("timetable_periods")
    .select("id, class_id, day_of_week, period_no, subject_id, room_number, start_time, end_time, classes(name, section), subjects(name, code)")
    .eq("school_id", schoolId)
    .eq("teacher_id", teacherId)
    .eq("day_of_week", dayOfWeek)
    .order("period_no");
  if (error) throw ApiError.internal(error.message);
  return data ?? [];
}

/** Roster for one of the teacher's own classes — ownership is checked by the caller (assertTeacherOwnsClass). */
export async function listStudentsForClass(schoolId: string, classId: string) {
  const { data, error } = await supabaseAdmin
    .from("students")
    .select("id, admission_no, roll_no, date_of_birth, gender, users(full_name, email, phone, avatar_url)")
    .eq("school_id", schoolId)
    .eq("class_id", classId)
    .order("roll_no");
  if (error) throw ApiError.internal(error.message);
  return data;
}
