import { api } from '@/lib/axios';
import type { AttendanceStatus } from '@/types/dashboard.types';
export type { AttendanceStatus };

export interface MarkAttendanceEntry {
  student_id: string;
  status: AttendanceStatus;
  remarks?: string;
}

export async function getDailyAttendance(classId: string | number, date: string) {
  return api.get('/attendance/daily', { params: { class_id: classId, date } });
}

export async function markAttendance(classId: string | number, date: string, entries: MarkAttendanceEntry[]) {
  return api.post('/attendance/mark', { class_id: classId, attendance_date: date, entries });
}

export async function editAttendance(attendanceId: string, status: AttendanceStatus, remarks?: string) {
  return api.put(`/attendance/${attendanceId}`, { status, remarks });
}

export async function getAttendanceHistory(attendanceId: string) {
  return api.get(`/attendance/${attendanceId}/history`);
}

export async function getStudentAttendance(studentId: string | number, from?: string, to?: string) {
  return api.get(`/attendance/student/${studentId}`, { params: { from, to } });
}

export async function getOverallAnalytics(from?: string, to?: string) {
  return api.get('/attendance/analytics/overall', { params: { from, to } });
}

export async function getDailyReport(date: string, classId?: string) {
  return api.get('/attendance/reports/daily', { params: { date, class_id: classId } });
}

export async function getMonthlyReport(month: string, classId?: string) {
  return api.get('/attendance/reports/monthly', { params: { month, class_id: classId } });
}

export async function getStudentWiseReport(classId?: string) {
  return api.get('/attendance/reports/student-wise', { params: { class_id: classId } });
}

export async function getClassWiseReport() {
  return api.get('/attendance/reports/class-wise');
}
