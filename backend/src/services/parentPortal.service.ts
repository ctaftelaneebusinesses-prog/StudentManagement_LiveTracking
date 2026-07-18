import { supabaseAdmin } from "../config/supabase";
import { ApiError } from "../utils/ApiError";
import * as studentDashboardService from "./studentDashboard.service";
import * as attendanceService from "./attendance.service";
import * as examService from "./exam.service";

export interface ParentChild {
  id: string;
  admission_no: string;
  users: { full_name: string } | null;
  classes: { name: string; section: string } | null;
}

export async function listChildren(schoolId: string, parentId: string): Promise<ParentChild[]> {
  const { data, error } = await supabaseAdmin
    .from("student_parents")
    .select("students!inner(id, admission_no, school_id, users(full_name), classes(name, section))")
    .eq("parent_id", parentId)
    .eq("students.school_id", schoolId);
  if (error) throw ApiError.internal(error.message);
  return (data ?? []).map((row) => (row as unknown as { students: ParentChild }).students);
}

export async function getDashboard(schoolId: string, parentId: string) {
  const children = await listChildren(schoolId, parentId);
  const dashboards = await Promise.all(
    children.map(async (child) => ({ child, overview: await studentDashboardService.getDashboard(schoolId, child.id, parentId) }))
  );
  return { children: dashboards };
}

export async function createLeaveRequest(
  schoolId: string,
  parentId: string,
  input: { student_id: string; start_date: string; end_date: string; reason: string }
) {
  const { data, error } = await supabaseAdmin
    .from("leave_requests")
    .insert({ school_id: schoolId, requested_by: parentId, ...input })
    .select("id, student_id, start_date, end_date, reason, status, created_at")
    .single();
  if (error) throw ApiError.internal(error.message);
  return data;
}

export async function listLeaveRequests(schoolId: string, parentId: string) {
  const { data, error } = await supabaseAdmin
    .from("leave_requests")
    .select("id, student_id, start_date, end_date, reason, status, reviewer_notes, created_at, students(users(full_name))")
    .eq("school_id", schoolId)
    .eq("requested_by", parentId)
    .order("created_at", { ascending: false });
  if (error) throw ApiError.internal(error.message);
  return data;
}

export async function getReportCard(schoolId: string, studentId: string) {
  const [studentResult, attendance, marks] = await Promise.all([
    supabaseAdmin
      .from("students")
      .select("id, admission_no, users(full_name), classes(name, section)")
      .eq("school_id", schoolId)
      .eq("id", studentId)
      .single(),
    attendanceService.getSummaryForStudent(schoolId, studentId),
    examService.getMarksSummaryForStudent(schoolId, studentId),
  ]);
  if (studentResult.error || !studentResult.data) throw ApiError.notFound("Student not found");
  return { generated_at: new Date().toISOString(), student: studentResult.data, attendance, marks };
}
