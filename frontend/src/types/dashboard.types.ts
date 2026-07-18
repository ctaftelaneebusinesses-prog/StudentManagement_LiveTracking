export type AttendanceStatus = "present" | "absent" | "late" | "half_day" | "leave";

export interface AttendanceRecord {
  id: string;
  date: string;
  status: AttendanceStatus;
  remarks: string | null;
}

export interface AttendanceSummary {
  from: string;
  to: string;
  total: number;
  counts: Record<AttendanceStatus, number>;
  percentage: number | null;
  records: AttendanceRecord[];
}

export interface SubjectMark {
  subjectId: string;
  subjectName: string;
  subjectCode: string;
  marksObtained: number;
  maxMarks: number;
  grade: string | null;
}

export interface ExamSummary {
  examId: string;
  examName: string;
  examDate: string | null;
  percentage: number | null;
  subjects: SubjectMark[];
}

export interface MarksSummary {
  latestExam: ExamSummary | null;
  exams: ExamSummary[];
}

export interface HomeworkItem {
  id: string;
  class_id: string;
  subject_id: string | null;
  teacher_id: string | null;
  title: string;
  description: string | null;
  due_date: string;
  attachment_url: string | null;
  created_at: string;
  classes: { name: string; section: string } | null;
  subjects: { name: string; code: string } | null;
  users: { full_name: string } | null;
}

export interface TimetablePeriod {
  id: string;
  class_id: string;
  day_of_week: number;
  period_no: number;
  subject_id: string | null;
  teacher_id: string | null;
  start_time: string;
  end_time: string;
  subjects: { name: string; code: string } | null;
  users: { full_name: string } | null;
}

export interface TimetableDay {
  dayOfWeek: number;
  periods: TimetablePeriod[];
}

export type NotificationAudienceScope = "school" | "class" | "student";

export interface StudentNotification {
  id: string;
  title: string;
  message: string;
  audience_scope: NotificationAudienceScope;
  audience_class_id: string | null;
  audience_user_id: string | null;
  created_by: string | null;
  created_at: string;
  classes: { name: string; section: string } | null;
  isRead: boolean;
}

export interface StudentDashboard {
  attendance: AttendanceSummary;
  marks: MarksSummary;
  homework: HomeworkItem[];
  timetable: TimetableDay[];
  notifications: StudentNotification[];
}

export const DAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"] as const;
