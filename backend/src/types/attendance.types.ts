export type AttendanceStatus = 'present' | 'absent' | 'late' | 'half_day' | 'leave' | 'excused';

export interface AttendanceRecord {
  id: string;
  student_id: string;
  class_id: string;
  attendance_date: string; // YYYY-MM-DD
  status: AttendanceStatus;
  remarks: string | null;
  marked_by: string;
  updated_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface MarkAttendanceEntry {
  student_id: string;
  status: AttendanceStatus;
  remarks?: string;
}

export interface MarkAttendanceRequest {
  class_id: string;
  attendance_date: string; // YYYY-MM-DD
  entries: MarkAttendanceEntry[];
}

export interface EditAttendanceRequest {
  status: AttendanceStatus;
  remarks?: string;
  change_reason?: string;
}

export interface AttendanceSummaryRow {
  present_count: number;
  absent_count: number;
  late_count: number;
  half_day_count?: number;
  leave_count?: number;
  excused_count: number;
  total_marked: number;
  present_pct: number | null;
}
