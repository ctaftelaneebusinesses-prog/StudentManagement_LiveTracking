import { api } from "@/lib/axios";
import {
  TeacherAttendanceRecord,
  TeacherAttendanceStatus,
  TeacherAttendanceSummary,
  TeacherDailyAttendance,
  TeacherMonthlyAttendanceRow,
} from "@/types/admin.types";

export async function fetchDailyAttendance(date: string): Promise<TeacherDailyAttendance[]> {
  const { data } = await api.get("/teacher-attendance/daily", { params: { date } });
  return data.data;
}

/** `month` is "YYYY-MM". */
export async function fetchMonthlySummary(month: string): Promise<TeacherMonthlyAttendanceRow[]> {
  const { data } = await api.get("/teacher-attendance/monthly-summary", { params: { month } });
  return data.data;
}

export async function markAttendance(input: {
  teacher_id: string;
  date: string;
  status: TeacherAttendanceStatus;
  remarks?: string;
}): Promise<void> {
  await api.post("/teacher-attendance/mark", input);
}

export async function fetchAttendanceForTeacher(
  teacherId: string,
  from?: string,
  to?: string
): Promise<TeacherAttendanceRecord[]> {
  const { data } = await api.get(`/teachers/${teacherId}/attendance`, { params: { from, to } });
  return data.data;
}

export async function fetchAttendanceSummary(teacherId: string): Promise<TeacherAttendanceSummary> {
  const { data } = await api.get(`/teachers/${teacherId}/attendance/summary`);
  return data.data;
}
