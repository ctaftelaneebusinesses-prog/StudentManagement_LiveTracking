import { api } from "@/lib/axios";
import { AttendanceStatus } from "@/types/dashboard.types";
import { AttendanceHistoryRow, ClassAttendanceRecord } from "@/types/teacher.types";

export async function fetchForClassDate(classId: string, date: string): Promise<ClassAttendanceRecord[]> {
  const { data } = await api.get("/attendance/daily", { params: { class_id: classId, date } });
  return data.data;
}

export interface BulkAttendanceRecord {
  student_id: string;
  status: AttendanceStatus;
  remarks?: string;
}

export async function bulkMarkAttendance(
  classId: string,
  date: string,
  records: BulkAttendanceRecord[]
): Promise<void> {
  await api.post("/attendance/mark", { class_id: classId, attendance_date: date, entries: records });
}

export async function fetchHistory(classId: string, from?: string, to?: string): Promise<AttendanceHistoryRow[]> {
  const { data } = await api.get("/attendance/history", { params: { class_id: classId, from, to } });
  return data.data;
}
