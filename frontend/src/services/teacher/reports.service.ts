import { api } from "@/lib/axios";
import { AttendanceSummary, MarksSummary } from "@/types/dashboard.types";

/**
 * Reuses the student self-service endpoints — assertStudentAccess already
 * grants a teacher access here whenever they have a class_subjects row for
 * that student's class (see backend/src/utils/studentAccess.ts), so no new
 * backend endpoint is needed for teacher-facing student performance reports.
 */
export async function fetchStudentAttendanceSummary(studentId: string): Promise<AttendanceSummary> {
  const { data } = await api.get(`/students/${studentId}/attendance/summary`);
  return data.data;
}

export async function fetchStudentMarksSummary(studentId: string): Promise<MarksSummary> {
  const { data } = await api.get(`/students/${studentId}/marks/summary`);
  return data.data;
}

export interface ClassPerformance {
  studentCount: number;
  attendance: { percentage: number | null; total: number; from: string; to: string };
  subjectPerformance: { subjectId: string; subjectName: string; subjectCode: string; averagePercentage: number | null }[];
}

export async function fetchClassPerformance(classId: string): Promise<ClassPerformance> {
  const { data } = await api.get("/reports/teacher/class-performance", { params: { classId } });
  return data.data;
}
