import { supabaseAdmin } from "../config/supabase";
import { ApiError } from "../utils/ApiError";
import * as examService from "./exam.service";

interface AttendanceRow {
  date: string;
  status: string;
  class_id: string | null;
  student_id: string;
}

function isoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function percentageOf(rows: { status: string }[]): number | null {
  if (rows.length === 0) return null;
  const present = rows.filter((r) => r.status === "present").length;
  return Math.round((present / rows.length) * 1000) / 10;
}

async function queryAttendanceRows(
  schoolId: string,
  filter: { classId?: string; studentId?: string; from: string; to: string }
): Promise<AttendanceRow[]> {
  let query = supabaseAdmin
    .from("attendance")
    .select("date, status, class_id, student_id")
    .eq("school_id", schoolId)
    .gte("date", filter.from)
    .lte("date", filter.to);
  if (filter.classId) query = query.eq("class_id", filter.classId);
  if (filter.studentId) query = query.eq("student_id", filter.studentId);

  const { data, error } = await query;
  if (error) throw ApiError.internal(error.message);
  return (data ?? []) as unknown as AttendanceRow[];
}

/** Present-day percentage over a trailing window (default: last 30 days). */
export async function getAttendancePercentage(
  schoolId: string,
  filter: { classId?: string; studentId?: string; days?: number } = {}
) {
  const to = new Date();
  const from = new Date(to.getTime() - (filter.days ?? 30) * 24 * 60 * 60 * 1000);
  const rows = await queryAttendanceRows(schoolId, {
    classId: filter.classId,
    studentId: filter.studentId,
    from: isoDate(from),
    to: isoDate(to),
  });
  return { percentage: percentageOf(rows), total: rows.length, from: isoDate(from), to: isoDate(to) };
}

/** Month-bucketed present percentage, oldest first — chart-ready trend data. */
export async function getAttendanceTrend(
  schoolId: string,
  filter: { classId?: string; studentId?: string; months?: number } = {}
) {
  const months = filter.months ?? 6;
  const to = new Date();
  const from = new Date(to.getFullYear(), to.getMonth() - (months - 1), 1);
  const rows = await queryAttendanceRows(schoolId, {
    classId: filter.classId,
    studentId: filter.studentId,
    from: isoDate(from),
    to: isoDate(to),
  });

  const buckets = new Map<string, { status: string }[]>();
  for (const row of rows) {
    const key = row.date.slice(0, 7);
    if (!buckets.has(key)) buckets.set(key, []);
    buckets.get(key)!.push(row);
  }

  return Array.from(buckets.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([month, monthRows]) => ({ month, percentage: percentageOf(monthRows), total: monthRows.length }));
}

/** Trailing-30-day present percentage per class — the principal's class breakdown. */
export async function getAttendanceByClass(schoolId: string) {
  const to = new Date();
  const from = new Date(to.getTime() - 30 * 24 * 60 * 60 * 1000);
  const [rows, { data: classes, error: classError }] = await Promise.all([
    queryAttendanceRows(schoolId, { from: isoDate(from), to: isoDate(to) }),
    supabaseAdmin.from("classes").select("id, name, section").eq("school_id", schoolId),
  ]);
  if (classError) throw ApiError.internal(classError.message);

  const byClass = new Map<string, { status: string }[]>();
  for (const row of rows) {
    if (!row.class_id) continue;
    if (!byClass.has(row.class_id)) byClass.set(row.class_id, []);
    byClass.get(row.class_id)!.push(row);
  }

  return (classes ?? []).map((c) => ({
    classId: c.id,
    className: [c.name, c.section].filter(Boolean).join(" "),
    percentage: percentageOf(byClass.get(c.id) ?? []),
    total: (byClass.get(c.id) ?? []).length,
  }));
}

interface ExamMarkRow {
  student_id: string;
  marks_obtained: number;
  max_marks: number;
  exams: { class_id: string; classes: { name: string; section: string } | null } | null;
}

/** School-wide exam average plus a per-class breakdown, most recent-marks-derived. */
async function getPerformanceByClass(schoolId: string) {
  const { data, error } = await supabaseAdmin
    .from("exam_marks")
    .select("student_id, marks_obtained, max_marks, exams(class_id, classes(name, section))")
    .eq("school_id", schoolId);
  if (error) throw ApiError.internal(error.message);

  const rows = (data ?? []) as unknown as ExamMarkRow[];

  const byClass = new Map<string, { className: string; obtained: number; max: number; studentIds: Set<string> }>();
  const allStudents = new Set<string>();
  let totalObtained = 0;
  let totalMax = 0;

  for (const row of rows) {
    const classId = row.exams?.class_id;
    allStudents.add(row.student_id);
    totalObtained += Number(row.marks_obtained);
    totalMax += Number(row.max_marks);
    if (!classId) continue;

    const className = [row.exams?.classes?.name, row.exams?.classes?.section].filter(Boolean).join(" ") || "Unassigned";
    if (!byClass.has(classId)) byClass.set(classId, { className, obtained: 0, max: 0, studentIds: new Set() });
    const entry = byClass.get(classId)!;
    entry.obtained += Number(row.marks_obtained);
    entry.max += Number(row.max_marks);
    entry.studentIds.add(row.student_id);
  }

  const byClassSummary = Array.from(byClass.entries())
    .map(([classId, e]) => ({
      classId,
      className: e.className,
      studentCount: e.studentIds.size,
      averagePercentage: e.max > 0 ? Math.round((e.obtained / e.max) * 1000) / 10 : null,
    }))
    .sort((a, b) => (b.averagePercentage ?? -1) - (a.averagePercentage ?? -1));

  return {
    averagePercentage: totalMax > 0 ? Math.round((totalObtained / totalMax) * 1000) / 10 : null,
    studentsWithMarks: allStudents.size,
    byClass: byClassSummary,
  };
}

/** Admin overview widget: headcounts, trailing attendance rate, school-wide exam average. */
export async function getAdminOverview(schoolId: string) {
  const [
    { count: studentCount, error: studentError },
    { count: teacherCount, error: teacherError },
    { count: classCount, error: classError },
    attendance,
    performance,
  ] = await Promise.all([
    supabaseAdmin.from("students").select("id", { count: "exact", head: true }).eq("school_id", schoolId),
    supabaseAdmin.from("teachers").select("id", { count: "exact", head: true }).eq("school_id", schoolId),
    supabaseAdmin.from("classes").select("id", { count: "exact", head: true }).eq("school_id", schoolId),
    getAttendancePercentage(schoolId),
    getPerformanceByClass(schoolId),
  ]);
  if (studentError) throw ApiError.internal(studentError.message);
  if (teacherError) throw ApiError.internal(teacherError.message);
  if (classError) throw ApiError.internal(classError.message);

  return {
    studentCount: studentCount ?? 0,
    teacherCount: teacherCount ?? 0,
    classCount: classCount ?? 0,
    attendance,
    performance: { averagePercentage: performance.averagePercentage, studentsWithMarks: performance.studentsWithMarks },
  };
}

/** Principal's school-wide dashboard: overview + attendance trend + per-class breakdowns. */
export async function getSchoolAnalytics(schoolId: string) {
  const [overview, attendanceTrend, attendanceByClass, performance] = await Promise.all([
    getAdminOverview(schoolId),
    getAttendanceTrend(schoolId),
    getAttendanceByClass(schoolId),
    getPerformanceByClass(schoolId),
  ]);

  return { ...overview, attendanceTrend, attendanceByClass, performanceByClass: performance.byClass };
}

interface SubjectMarkRow {
  subject_id: string;
  marks_obtained: number;
  max_marks: number;
  subjects: { name: string; code: string } | null;
}

/** One teacher's class: headcount, trailing attendance rate, subject-wise exam averages. */
export async function getClassPerformance(schoolId: string, classId: string) {
  const [{ count: studentCount, error: studentCountError }, attendance, { data: markRows, error: markError }] = await Promise.all([
    supabaseAdmin.from("students").select("id", { count: "exact", head: true }).eq("school_id", schoolId).eq("class_id", classId),
    getAttendancePercentage(schoolId, { classId }),
    supabaseAdmin
      .from("exam_marks")
      .select("subject_id, marks_obtained, max_marks, subjects(name, code), exams!inner(class_id)")
      .eq("school_id", schoolId)
      .eq("exams.class_id", classId),
  ]);
  if (studentCountError) throw ApiError.internal(studentCountError.message);
  if (markError) throw ApiError.internal(markError.message);

  const rows = (markRows ?? []) as unknown as SubjectMarkRow[];
  const bySubject = new Map<string, { name: string; code: string; obtained: number; max: number }>();
  for (const row of rows) {
    if (!bySubject.has(row.subject_id)) {
      bySubject.set(row.subject_id, { name: row.subjects?.name ?? "Subject", code: row.subjects?.code ?? "", obtained: 0, max: 0 });
    }
    const entry = bySubject.get(row.subject_id)!;
    entry.obtained += Number(row.marks_obtained);
    entry.max += Number(row.max_marks);
  }

  const subjectPerformance = Array.from(bySubject.entries())
    .map(([subjectId, s]) => ({
      subjectId,
      subjectName: s.name,
      subjectCode: s.code,
      averagePercentage: s.max > 0 ? Math.round((s.obtained / s.max) * 1000) / 10 : null,
    }))
    .sort((a, b) => (b.averagePercentage ?? -1) - (a.averagePercentage ?? -1));

  return { studentCount: studentCount ?? 0, attendance, subjectPerformance };
}

/** A student's progress: attendance trend + marks trend (oldest first) for charting. */
export async function getStudentProgress(schoolId: string, studentId: string) {
  const [attendanceTrend, marks] = await Promise.all([
    getAttendanceTrend(schoolId, { studentId }),
    examService.getMarksSummaryForStudent(schoolId, studentId),
  ]);

  const marksTrend = [...marks.exams]
    .sort((a, b) => (a.examDate ?? "").localeCompare(b.examDate ?? ""))
    .map((e) => ({ examName: e.examName, examDate: e.examDate, percentage: e.percentage }));

  return { attendanceTrend, marksTrend, latestExam: marks.latestExam };
}
