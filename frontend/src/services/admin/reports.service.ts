import { api } from "@/lib/axios";
import {
  AttendanceReport,
  ExamReportSummary,
  FeeReport,
  PaginatedResult,
  StudentReportRow,
  TeacherReportRow,
  TransportReport,
} from "@/types/reportsHub.types";

export interface AttendanceStat {
  percentage: number | null;
  total: number;
  from: string;
  to: string;
}

export interface AdminOverview {
  studentCount: number;
  teacherCount: number;
  classCount: number;
  attendance: AttendanceStat;
  performance: { averagePercentage: number | null; studentsWithMarks: number };
}

export async function fetchAdminOverview(): Promise<AdminOverview> {
  const { data } = await api.get("/reports/admin/overview");
  return data.data;
}

// ----------------------------------------------------------------------------
// Reports console — Attendance/Student/Teacher/Fee/Transport/Exam tabs.
// ----------------------------------------------------------------------------

export interface AttendanceReportParams {
  classId?: string;
  from?: string;
  to?: string;
}

export async function fetchAttendanceReport(params: AttendanceReportParams): Promise<AttendanceReport> {
  const { data } = await api.get("/reports/hub/attendance", { params });
  return data.data;
}

export interface StudentReportParams {
  classId?: string;
  search?: string;
  page: number;
  pageSize: number;
}

export async function fetchStudentReport(params: StudentReportParams): Promise<PaginatedResult<StudentReportRow>> {
  const { data } = await api.get("/reports/hub/students", { params });
  return data.data;
}

export interface TeacherReportParams {
  search?: string;
  page: number;
  pageSize: number;
}

export async function fetchTeacherReport(params: TeacherReportParams): Promise<PaginatedResult<TeacherReportRow>> {
  const { data } = await api.get("/reports/hub/teachers", { params });
  return data.data;
}

export async function fetchFeeReport(): Promise<FeeReport> {
  const { data } = await api.get("/reports/hub/fees");
  return data.data;
}

export interface TransportReportParams {
  vehicleId?: string;
  dateFrom?: string;
  dateTo?: string;
  page: number;
  pageSize: number;
}

export async function fetchTransportReport(params: TransportReportParams): Promise<TransportReport> {
  const { data } = await api.get("/reports/hub/transport", { params });
  return data.data;
}

export async function fetchExamReportSummary(): Promise<ExamReportSummary> {
  const { data } = await api.get("/reports/hub/exams");
  return data.data;
}
