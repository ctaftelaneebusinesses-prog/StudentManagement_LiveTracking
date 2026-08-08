import { api } from "@/lib/axios";
import { AttendanceCalendarResponse, AttendancePeriodSummary } from "@/types/portal.types";

export async function fetchAttendanceRecords(studentId: string, from: string, to: string): Promise<AttendanceCalendarResponse> {
  const { data } = await api.get(`/students/${studentId}/attendance`, { params: { from, to } });
  return data.data;
}

export async function fetchAttendanceSummary(studentId: string, from?: string, to?: string): Promise<AttendancePeriodSummary> {
  const { data } = await api.get(`/students/${studentId}/attendance/summary`, { params: { from, to } });
  return data.data;
}
