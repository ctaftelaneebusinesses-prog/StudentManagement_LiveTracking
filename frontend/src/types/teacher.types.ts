import { AttendanceStatus, AttendanceSummary, HomeworkItem, MarksSummary, TimetablePeriod } from "./dashboard.types";

export interface TeacherClassSubject {
  id: string;
  name: string;
  code: string;
}

export interface TeacherClassSummary {
  id: string;
  name: string;
  section: string;
  isHomeroom: boolean;
  subjects: TeacherClassSubject[];
  studentCount: number;
}

export interface TeacherDashboard {
  classes: TeacherClassSummary[];
  totalClasses: number;
  totalSubjects: number;
  totalStudents: number;
  todayClassesCount: number;
  pendingHomeworkCount: number;
  upcomingAssessmentsCount: number;
  leaveBalance: number;
  pendingLeaveRequestsCount: number;
}

export interface TeacherClassTeacherOf {
  classId: string;
  className: string;
  section: string;
  academicYear: string;
  totalStudents: number;
}

export interface TeacherProfile {
  id: string;
  employee_id: string;
  qualification: string | null;
  experience_years: number | null;
  joining_date: string;
  address: string | null;
  users: { full_name: string; email: string; phone: string | null; avatar_url: string | null };
  schools: { name: string } | null;
  isClassTeacher: boolean;
  classTeacherOf: TeacherClassTeacherOf | null;
}

export interface TeacherProfileUpdateInput {
  full_name?: string;
  phone?: string | null;
  address?: string | null;
}

export interface TeacherStudentListItem {
  id: string;
  admission_no: string;
  roll_no: string | null;
  class_id: string;
  father_name: string | null;
  father_phone: string | null;
  mother_name: string | null;
  mother_phone: string | null;
  users: { full_name: string; email: string; phone: string | null; avatar_url: string | null };
  attendancePercentage: number | null;
  fee: { due: number; paid: number; balance: number; status: string } | null;
}

export interface TeacherStudentDetail {
  profile: {
    id: string;
    admission_no: string;
    roll_no: string | null;
    date_of_birth: string | null;
    gender: string | null;
    address: string | null;
    blood_group: string | null;
    father_name: string | null;
    father_phone: string | null;
    father_email: string | null;
    father_occupation: string | null;
    mother_name: string | null;
    mother_phone: string | null;
    mother_email: string | null;
    mother_occupation: string | null;
    classes: { name: string; section: string } | null;
    users: { full_name: string; email: string; phone: string | null; avatar_url: string | null; is_active: boolean };
  };
  attendance: AttendanceSummary;
  marks: MarksSummary;
  homework: HomeworkItem[];
  fees: { totalDue: number; totalPaid: number; balance: number; structures: unknown[]; payments: unknown[] } | null;
  documents: { id: string; doc_type: string; file_name: string; notes: string | null; uploaded_at: string; url: string | null }[];
}

export type { TimetablePeriod };

export interface TeacherTodayPeriod {
  id: string;
  class_id: string;
  period_no: number;
  start_time: string;
  end_time: string;
  room_number: string | null;
  classes: { name: string; section: string } | null;
  subjects: { name: string; code: string } | null;
}

export interface TeacherWeeklyPeriod extends TeacherTodayPeriod {
  day_of_week: number;
}

export interface TeacherTimetableDay {
  dayOfWeek: number;
  periods: TeacherWeeklyPeriod[];
}

export interface TeacherAssessment {
  id: string;
  name: string;
  exam_date: string | null;
  class_id: string;
  subject_id: string | null;
  max_marks: number | null;
  instructions: string | null;
  created_by: string | null;
  created_at: string;
  classes: { name: string; section: string } | null;
  subjects: { name: string; code: string } | null;
}

export type LeaveType = "casual" | "sick" | "other";
export type LeaveStatus = "pending" | "approved" | "rejected";
export type LeaveApplicantRole = "teacher" | "principal";

export interface LeaveSummary {
  policy: { casual: number; sick: number; other: number };
  used: { casual: number; sick: number; other: number };
  remaining: { casual: number; sick: number; other: number };
  totalEntitlement: number;
  totalUsed: number;
  totalRemaining: number;
  pendingCount: number;
  approvedCount: number;
  rejectedCount: number;
}

export interface LeaveRequestRecord {
  id: string;
  teacher_id: string;
  applicant_role: LeaveApplicantRole;
  leave_type: LeaveType;
  start_date: string;
  end_date: string;
  reason: string | null;
  status: LeaveStatus;
  reviewed_by: string | null;
  reviewed_by_role: string | null;
  reviewed_at: string | null;
  created_at: string;
  users: { full_name: string; email: string } | null;
  /** Only present on a review-endpoint response — true if this request had already been resolved by someone else before this call landed (race lost). */
  alreadyReviewed?: boolean;
}

export interface RosterStudent {
  id: string;
  admission_no: string;
  roll_no: string | null;
  date_of_birth: string | null;
  gender: "male" | "female" | "other" | null;
  users: { full_name: string; email: string; phone: string | null; avatar_url: string | null };
}

export interface ClassAttendanceRecord {
  id: string;
  student_id: string;
  status: AttendanceStatus;
  remarks: string | null;
  students: { admission_no: string; users: { full_name: string } } | null;
}

export interface AttendanceHistoryRow {
  id: string;
  student_id: string;
  date: string;
  status: AttendanceStatus;
  remarks: string | null;
  students: { admission_no: string; users: { full_name: string } } | null;
}

export interface TeacherExam {
  id: string;
  name: string;
  exam_date: string | null;
  class_id: string;
  academic_year_id: string | null;
  classes: { name: string; section: string } | null;
}

export interface ExamMarkRecord {
  id: string;
  student_id: string;
  subject_id: string;
  marks_obtained: number;
  max_marks: number;
  grade: string | null;
  remarks: string | null;
  students: { admission_no: string; users: { full_name: string } } | null;
  subjects: { name: string; code: string } | null;
}

export interface ClassSubjectMarksStatus {
  subjectId: string;
  subjectName: string;
  subjectCode: string;
  teacherId: string | null;
  teacherName: string;
  status: "completed" | "pending";
  markedCount: number;
  rosterCount: number;
  lastUpdated: string | null;
}

export interface QuestionPaperRecord {
  id: string;
  doc_type: string;
  file_name: string | null;
  storage_path: string | null;
  content: string | null;
  notes: string | null;
  is_published: boolean;
  published_at: string | null;
  uploaded_at: string;
  uploaded_by: string | null;
  url: string | null;
  exams: {
    id: string;
    name: string;
    exam_date: string | null;
    subject_id: string | null;
    class_id: string;
    subjects: { name: string; code: string } | null;
  } | null;
}

export type { HomeworkItem };
