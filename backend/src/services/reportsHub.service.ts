import { supabaseAdmin } from "../config/supabase";
import { ApiError } from "../utils/ApiError";
import * as attendanceService from "./attendance.service";
import * as studentService from "./student.service";
import * as teacherService from "./teacher.service";
import { calculateGrade } from "./exam.service";

interface AttendanceReportFilter {
  classId?: string;
  from?: string;
  to?: string;
}

/** Attendance Reports tab: school-wide trend/by-class/overall + a student-wise drill-down table. */
export async function getAttendanceReport(schoolId: string, filter: AttendanceReportFilter = {}) {
  const [analytics, studentWise] = await Promise.all([
    attendanceService.getOverallAnalytics(schoolId, filter.from, filter.to),
    attendanceService.getStudentWiseReport(schoolId, filter.classId),
  ]);
  return { ...analytics, studentWise };
}

interface PageFilter {
  search?: string;
  page: number;
  pageSize: number;
}

/** Student Reports tab: roster page enriched with all-time attendance % and exam average %. */
export async function getStudentReport(schoolId: string, filter: PageFilter & { classId?: string }) {
  const roster = await studentService.listStudents(schoolId, {
    classId: filter.classId,
    search: filter.search,
    page: filter.page,
    pageSize: filter.pageSize,
  });

  const items = (roster.items ?? []) as unknown as Array<{ id: string } & Record<string, unknown>>;
  const studentIds = items.map((s) => s.id);
  if (studentIds.length === 0) return { ...roster, items: [] };

  const [{ data: attendanceRows, error: attendanceError }, { data: markRows, error: markError }] = await Promise.all([
    supabaseAdmin.from("vw_attendance_student_summary").select("student_id, present_pct").in("student_id", studentIds),
    supabaseAdmin.from("exam_marks").select("student_id, marks_obtained, max_marks").in("student_id", studentIds),
  ]);
  if (attendanceError) throw ApiError.internal(attendanceError.message);
  if (markError) throw ApiError.internal(markError.message);

  const attendanceByStudent = new Map<string, number | null>();
  for (const row of attendanceRows ?? []) attendanceByStudent.set(row.student_id, row.present_pct);

  const marksByStudent = new Map<string, { obtained: number; max: number }>();
  for (const row of markRows ?? []) {
    if (!marksByStudent.has(row.student_id)) marksByStudent.set(row.student_id, { obtained: 0, max: 0 });
    const entry = marksByStudent.get(row.student_id)!;
    entry.obtained += Number(row.marks_obtained);
    entry.max += Number(row.max_marks);
  }

  const enriched = items.map((s) => {
    const marks = marksByStudent.get(s.id);
    return {
      ...s,
      attendancePercentage: attendanceByStudent.get(s.id) ?? null,
      examAveragePercentage: marks && marks.max > 0 ? Math.round((marks.obtained / marks.max) * 1000) / 10 : null,
    };
  });

  return { ...roster, items: enriched };
}

/** Teacher Reports tab: roster page enriched with assignment count, this-month attendance %, and pending leave count. */
export async function getTeacherReport(schoolId: string, filter: PageFilter) {
  const roster = await teacherService.listTeachers(schoolId, {
    search: filter.search,
    page: filter.page,
    pageSize: filter.pageSize,
  });

  const items = (roster.items ?? []) as unknown as Array<{ id: string } & Record<string, unknown>>;
  const teacherIds = items.map((t) => t.id);
  if (teacherIds.length === 0) return { ...roster, items: [] };

  const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().slice(0, 10);

  const [
    { data: assignmentRows, error: assignmentError },
    { data: attendanceRows, error: attendanceError },
    { data: leaveRows, error: leaveError },
  ] = await Promise.all([
    supabaseAdmin.from("class_subjects").select("teacher_id").in("teacher_id", teacherIds),
    supabaseAdmin
      .from("teacher_attendance")
      .select("teacher_id, status")
      .eq("school_id", schoolId)
      .in("teacher_id", teacherIds)
      .gte("date", monthStart),
    supabaseAdmin
      .from("leave_requests")
      .select("teacher_id")
      .eq("school_id", schoolId)
      .eq("status", "pending")
      .in("teacher_id", teacherIds),
  ]);
  if (assignmentError) throw ApiError.internal(assignmentError.message);
  if (attendanceError) throw ApiError.internal(attendanceError.message);
  if (leaveError) throw ApiError.internal(leaveError.message);

  const assignmentCounts = new Map<string, number>();
  for (const row of assignmentRows ?? []) assignmentCounts.set(row.teacher_id, (assignmentCounts.get(row.teacher_id) ?? 0) + 1);

  const attendanceCounts = new Map<string, { present: number; total: number }>();
  for (const row of attendanceRows ?? []) {
    if (!attendanceCounts.has(row.teacher_id)) attendanceCounts.set(row.teacher_id, { present: 0, total: 0 });
    const entry = attendanceCounts.get(row.teacher_id)!;
    entry.total += 1;
    if (row.status === "present") entry.present += 1;
  }

  const pendingLeaveCounts = new Map<string, number>();
  for (const row of leaveRows ?? []) pendingLeaveCounts.set(row.teacher_id, (pendingLeaveCounts.get(row.teacher_id) ?? 0) + 1);

  const enriched = items.map((t) => {
    const attendance = attendanceCounts.get(t.id);
    return {
      ...t,
      assignmentCount: assignmentCounts.get(t.id) ?? 0,
      attendancePercentageThisMonth:
        attendance && attendance.total > 0 ? Math.round((attendance.present / attendance.total) * 1000) / 10 : null,
      pendingLeaveCount: pendingLeaveCounts.get(t.id) ?? 0,
    };
  });

  return { ...roster, items: enriched };
}

interface ExamMarkRow {
  exam_id: string;
  student_id: string;
  marks_obtained: number;
  max_marks: number;
  exams: { name: string; exam_date: string | null; classes: { name: string; section: string } | null } | null;
}

/** Exam Reports tab: exam-wise average/pass-fail table (the byClass chart reuses exam.service's existing getPerformanceAnalytics). */
export async function getExamReportSummary(schoolId: string) {
  const { data, error } = await supabaseAdmin
    .from("exam_marks")
    .select("exam_id, student_id, marks_obtained, max_marks, exams(name, exam_date, classes(name, section))")
    .eq("school_id", schoolId);
  if (error) throw ApiError.internal(error.message);

  const rows = (data ?? []) as unknown as ExamMarkRow[];

  const byExam = new Map<
    string,
    {
      examName: string;
      examDate: string | null;
      className: string;
      studentTotals: Map<string, { obtained: number; max: number }>;
    }
  >();

  for (const row of rows) {
    if (!byExam.has(row.exam_id)) {
      byExam.set(row.exam_id, {
        examName: row.exams?.name ?? "Exam",
        examDate: row.exams?.exam_date ?? null,
        className: [row.exams?.classes?.name, row.exams?.classes?.section].filter(Boolean).join(" ") || "Unassigned",
        studentTotals: new Map(),
      });
    }
    const entry = byExam.get(row.exam_id)!;
    if (!entry.studentTotals.has(row.student_id)) entry.studentTotals.set(row.student_id, { obtained: 0, max: 0 });
    const totals = entry.studentTotals.get(row.student_id)!;
    totals.obtained += Number(row.marks_obtained);
    totals.max += Number(row.max_marks);
  }

  const exams = Array.from(byExam.entries())
    .map(([examId, e]) => {
      let obtained = 0;
      let max = 0;
      let passCount = 0;
      let failCount = 0;
      for (const totals of e.studentTotals.values()) {
        obtained += totals.obtained;
        max += totals.max;
        if (calculateGrade(totals.obtained, totals.max) === "E") failCount += 1;
        else passCount += 1;
      }
      return {
        examId,
        examName: e.examName,
        examDate: e.examDate,
        className: e.className,
        studentCount: e.studentTotals.size,
        averagePercentage: max > 0 ? Math.round((obtained / max) * 1000) / 10 : null,
        passCount,
        failCount,
      };
    })
    .sort((a, b) => (b.examDate ?? "").localeCompare(a.examDate ?? ""));

  return { exams };
}
