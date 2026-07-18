import { AttendanceStatus, HomeworkItem } from "./dashboard.types";

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

export type { HomeworkItem };
