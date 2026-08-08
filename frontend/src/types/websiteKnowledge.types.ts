export type QuizRole = "student" | "teacher" | "principal" | "school_admin" | "accountant" | "driver" | "extracurricular_staff";

export interface QuestionOption {
  key: string;
  text: string;
}

export interface SnapshotQuestion {
  question_id: string;
  question_text: string;
  options: QuestionOption[];
  /** All three are only present once the attempt is completed — hidden during the live quiz. `category` names the ERP section the question asks you to identify, so it would give the answer away. */
  category?: string | null;
  correct_option?: string;
  explanation?: string | null;
}

export type AttemptStatus = "in_progress" | "completed";

export interface Attempt {
  id: string;
  user_id: string;
  school_id: string | null;
  role_name: QuizRole;
  set_id: string | null;
  attempt_number: number;
  questions_snapshot: SnapshotQuestion[];
  total_questions: number;
  correct_answers: number;
  wrong_answers: number;
  percentage: number | null;
  passed: boolean | null;
  status: AttemptStatus;
  started_at: string;
  completed_at: string | null;
}

export interface AttemptSummary {
  id: string;
  attempt_number: number;
  total_questions: number;
  correct_answers: number;
  wrong_answers: number;
  percentage: number | null;
  passed: boolean | null;
  status: AttemptStatus;
  started_at: string;
  completed_at: string | null;
  set_id: string | null;
  website_knowledge_question_sets: { name: string; set_number: number } | null;
}

export interface Certificate {
  id: string;
  certificate_number: string;
  attempt_id: string | null;
  user_id: string;
  school_id: string | null;
  role_name: QuizRole;
  score: number;
  percentage: number;
  issued_at: string;
}

export interface AssessmentSettings {
  id: 1;
  question_count: 20 | 30 | 50;
  passing_percentage: 70 | 75 | 80 | 85 | 90;
  updated_by: string | null;
  updated_at: string;
}

export type AssessmentStatus = "not_attempted" | "in_progress" | "failed" | "passed" | "certified";

export interface ProgressRow {
  attempt_count: number;
  latest_attempt: { id: string; attempt_number: number; percentage: number | null; passed: boolean | null; completed_at: string | null } | null;
  certificate: { id: string; certificate_number: string; percentage: number; issued_at: string } | null;
  status: AssessmentStatus;
}

export interface StudentProgressRow extends ProgressRow {
  student_id: string;
  full_name: string;
  avatar_url: string | null;
  class_name: string | null;
  section: string | null;
}

export interface TeacherProgressRow extends ProgressRow {
  teacher_id: string;
  full_name: string;
  avatar_url: string | null;
}

export interface PrincipalProgressRow extends ProgressRow {
  principal_id: string;
  full_name: string;
  avatar_url: string | null;
  school_name: string | null;
}

export interface SchoolAdminProgressRow extends ProgressRow {
  school_admin_id: string;
  full_name: string;
  avatar_url: string | null;
  school_name: string | null;
}

export interface SummaryCounts {
  total: number;
  completed: number;
  not_attempted: number;
  in_progress: number;
  passed: number;
  failed: number;
  certified: number;
}

export interface GlobalStats {
  total_users: number;
  total_completed: number;
  total_not_attempted: number;
  total_passed: number;
  total_failed: number;
  total_certified: number;
  overall_pass_percentage: number;
  by_role: Record<string, SummaryCounts>;
  school_admins_overview: SchoolAdminProgressRow[];
}

export interface AttemptHistoryEntry {
  id: string;
  attempt_number: number;
  total_questions: number;
  correct_answers: number;
  wrong_answers: number;
  percentage: number | null;
  passed: boolean | null;
  status: AttemptStatus;
  started_at: string;
  completed_at: string | null;
  website_knowledge_question_sets: { name: string; set_number: number } | null;
}

export interface AttemptHistory {
  attempts: AttemptHistoryEntry[];
  certificate: Certificate | null;
}

export interface QuestionRow {
  id: string;
  role_name: QuizRole;
  question_text: string;
  options: QuestionOption[];
  correct_option: string;
  explanation: string | null;
  category: string | null;
  is_active: boolean;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface QuestionSetRow {
  id: string;
  role_name: QuizRole;
  set_number: number;
  name: string;
  is_active: boolean;
  created_at: string;
  question_count: number;
}
