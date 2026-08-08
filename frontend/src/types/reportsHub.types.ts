import { SeriesPoint, CategorySlice } from "./adminDashboard.types";
import { PaginatedResult } from "./fees.types";

export interface AttendanceOverallSummary {
  present_count: number;
  absent_count: number;
  late_count: number;
  half_day_count: number;
  leave_count: number;
  excused_count: number;
  total_marked: number;
  present_pct: number | null;
}

export interface AttendanceTrendPoint {
  attendance_date: string;
  present_count: number;
  absent_count: number;
  late_count: number;
  total_marked: number;
  present_pct: number;
}

export interface AttendanceClassSummary {
  class_id: string;
  class_name: string;
  student_count: number;
  present_count: number;
  absent_count: number;
  late_count: number;
  total_marked: number;
  present_pct: number | null;
}

export interface AttendanceStudentSummary {
  student_id: string;
  class_id: string | null;
  student_name: string;
  present_count: number;
  absent_count: number;
  late_count: number;
  half_day_count: number;
  leave_count: number;
  total_marked: number;
  present_pct: number | null;
}

export interface AttendanceReport {
  trend: AttendanceTrendPoint[];
  byClass: AttendanceClassSummary[];
  overall: AttendanceOverallSummary;
  studentWise: AttendanceStudentSummary[];
}

export interface StudentReportRow {
  id: string;
  admission_no: string;
  roll_no: string | null;
  class_id: string | null;
  classes: { name: string; section: string } | null;
  users: { full_name: string; email: string; is_active: boolean } | null;
  attendancePercentage: number | null;
  examAveragePercentage: number | null;
}

export interface TeacherReportRow {
  id: string;
  employee_id: string;
  qualification: string | null;
  users: { full_name: string; email: string; is_active: boolean } | null;
  assignmentCount: number;
  attendancePercentageThisMonth: number | null;
  pendingLeaveCount: number;
}

export interface FeeReport {
  stats: {
    totalFees: number;
    collectedFees: number;
    pendingFees: number;
    todaysCollection: number;
    paidStudentsCount: number;
    pendingStudentsCount: number;
  };
  analytics: {
    monthlyCollection: SeriesPoint[];
    collectionTrend: SeriesPoint[];
    statusBreakdown: CategorySlice[];
  };
}

export interface TransportReportTrip {
  id: string;
  trip_date: string;
  direction: string;
  status: string;
  durationMinutes: number | null;
  distanceKm: number | null;
  vehicles: { vehicle_number: string } | null;
  drivers: { users: { full_name: string } | null } | null;
  routes: { name: string; route_code: string } | null;
}

export interface TransportReport {
  vehicleCount: number;
  driverCount: number;
  routeCount: number;
  tripHistory: PaginatedResult<TransportReportTrip>;
}

export interface ExamReportRow {
  examId: string;
  examName: string;
  examDate: string | null;
  className: string;
  studentCount: number;
  averagePercentage: number | null;
  passCount: number;
  failCount: number;
}

export interface ExamReportSummary {
  exams: ExamReportRow[];
  analytics: {
    totalExams: number;
    totalStudents: number;
    averagePercentage: number | null;
    byClass: { classId: string; className: string; examCount: number; studentCount: number; averagePercentage: number | null }[];
  };
}

export type { PaginatedResult };
