export interface Exam {
  id: string;
  name: string;
  exam_date: string | null;
  class_id: string;
  academic_year_id: string | null;
  is_published?: boolean;
  published_at?: string | null;
  classes: { name: string; section: string } | null;
}

export interface ClassPerformance {
  classId: string;
  className: string;
  examCount: number;
  studentCount: number;
  averagePercentage: number | null;
}

export interface PerformanceAnalytics {
  totalExams: number;
  totalStudents: number;
  averagePercentage: number | null;
  byClass: ClassPerformance[];
}

export interface ExamScheduleEntry {
  id: string;
  exam_id: string;
  subject_id: string;
  exam_date: string;
  start_time: string;
  end_time: string;
  room: string | null;
  max_marks: number;
  subjects: { name: string; code: string } | null;
}

export type ExamDocumentType = "question_paper" | "answer_key" | "hall_ticket" | "result_sheet" | "circular" | "other";

export interface ExamDocument {
  id: string;
  doc_type: ExamDocumentType;
  file_name: string | null;
  storage_path: string | null;
  /** HTML from the write-in-browser composer — set instead of storage_path/url for a composed (not uploaded) paper. */
  content: string | null;
  notes: string | null;
  is_published: boolean;
  published_at: string | null;
  published_by?: string | null;
  uploaded_at: string;
  uploaded_by: string | null;
  url: string | null;
}

export interface ExamReportSubjectMark {
  subjectName: string;
  subjectCode: string;
  marksObtained: number;
  maxMarks: number;
  grade: string;
}

export interface ExamReportStudent {
  studentId: string;
  studentName: string;
  admissionNo: string;
  subjects: ExamReportSubjectMark[];
  obtained: number;
  max: number;
  percentage: number | null;
  grade: string;
}

export interface ExamReport {
  exam: {
    id: string;
    name: string;
    exam_date: string | null;
    is_published: boolean;
    class_id: string;
    classes: { name: string; section: string } | null;
  };
  students: ExamReportStudent[];
  stats: {
    totalStudents: number;
    averagePercentage: number | null;
    highestPercentage: number | null;
    lowestPercentage: number | null;
    passCount: number;
    failCount: number;
    passPercentage: number | null;
  };
}

export interface ExamMark {
  id: string;
  student_id: string;
  subject_id: string;
  marks_obtained: number;
  max_marks: number;
  grade: string | null;
  remarks: string | null;
  students: { admission_no: string; users: { full_name: string } | null } | null;
  subjects: { name: string; code: string } | null;
}
