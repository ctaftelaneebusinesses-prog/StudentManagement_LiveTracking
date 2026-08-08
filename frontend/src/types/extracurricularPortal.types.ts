import {
  Activity,
  ExtracurricularAchievement,
  ExtracurricularAttendanceStatus,
  ExtracurricularBatch,
  ExtracurricularEvent,
  ExtracurricularPracticeWork,
  ExtracurricularScheduleSlot,
} from "./extracurricularStaff.types";

export interface ExtracurricularPortalDashboard {
  activitiesCount: number;
  batchesCount: number;
  totalStudents: number;
  todaySessionCount: number;
}

export interface ExtracurricularPortalProfile {
  id: string;
  staff_code: string;
  full_name: string;
  email: string;
  phone: string | null;
  avatar_url: string | null;
  gender: string | null;
  date_of_birth: string | null;
  address: string | null;
  bio: string | null;
  qualification: string | null;
  experience_years: number | null;
  staff_type_activity_id: string;
  activities?: Activity;
}

/**
 * Corrected to match the actual row shape returned by
 * GET /extracurricular-portal/batches/:batchId/students (getBatchStudents) —
 * the backend returns raw `students` rows (`id`, not `student_id`; nested
 * `users` object, not a flat `full_name`) for both batch scopes. The
 * previously-documented `{student_id, full_name, admission_no, roll_no}`
 * shape did not match any field the API actually sends.
 */
export interface PortalBatchStudent {
  id: string;
  admission_no: string;
  roll_no: string | null;
  class_id?: string;
  users: { full_name: string; email: string; phone: string | null; avatar_url: string | null };
}

export interface MarkAttendanceInput {
  batch_id: string;
  session_date: string;
  records: { student_id: string; status: ExtracurricularAttendanceStatus; remarks?: string }[];
}

export interface AttendanceSummary {
  sessionsRun: number;
  /** @deprecated Not actually returned by GET /extracurricular-portal/attendance/summary — use presentRatePct. Kept optional so nothing that references it breaks. */
  presentRate?: number;
  /** Actual field names returned by getAttendanceSummary. */
  presentRatePct?: number | null;
  totalRecords?: number;
  presentCount?: number;
}

/** One period on this staff member's own weekly timetable (GET /extracurricular-portal/timetable) — always period_type 'extracurricular' since only those periods carry an extracurricular staff member as teacher_id. */
export interface ExtracurricularTimetablePeriod {
  id: string;
  class_id: string;
  period_no: number;
  start_time: string;
  end_time: string;
  room_number: string | null;
  activity_id: string | null;
  classes: { name: string; section: string } | null;
  activities: { name: string } | null;
}

export interface ExtracurricularTimetableDay {
  dayOfWeek: number;
  periods: ExtracurricularTimetablePeriod[];
}

export type {
  Activity,
  ExtracurricularAchievement,
  ExtracurricularBatch,
  ExtracurricularEvent,
  ExtracurricularPracticeWork,
  ExtracurricularScheduleSlot,
};
