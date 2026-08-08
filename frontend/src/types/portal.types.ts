import { AttendanceStatus, StudentDashboard } from "./dashboard.types";

/** Raw per-day attendance rows for the calendar view — distinct from dashboard.types' AttendanceSummary, which reflects a different endpoint's (already-aggregated) shape. */
export interface AttendanceCalendarRecord {
  date: string;
  status: AttendanceStatus;
  remarks: string | null;
}

export interface AttendanceCalendarResponse {
  records: AttendanceCalendarRecord[];
  summary: {
    present_count: number;
    absent_count: number;
    late_count: number;
    half_day_count: number;
    leave_count: number;
    excused_count: number;
    total_marked: number;
    present_pct: number | null;
  };
}

export interface AttendancePeriodSummary {
  from: string | null;
  to: string | null;
  total: number;
  percentage: number | null;
  counts: Record<AttendanceStatus, number>;
}

export interface UpcomingExam {
  id: string;
  name: string;
  exam_date: string;
  class_id: string;
  subject_id: string | null;
  max_marks: number | null;
  instructions: string | null;
  classes: { name: string; section: string } | null;
  subjects: { name: string; code: string } | null;
}

export interface PortalExam {
  id: string;
  name: string;
  exam_date: string | null;
  class_id: string;
  academic_year_id: string | null;
  is_published: boolean;
  published_at: string | null;
  classes: { name: string; section: string } | null;
}

export interface ExamScheduleEntry {
  id: string;
  exam_id: string;
  subject_id: string;
  exam_date: string;
  start_time: string;
  end_time: string;
  room: string | null;
  max_marks: number | null;
  subjects: { name: string; code: string } | null;
}

export interface MarkRecord {
  id: string;
  marks_obtained: number;
  max_marks: number;
  grade: string | null;
  remarks: string | null;
  exam_id: string;
  subject_id: string;
  exams: { name: string; exam_date: string | null } | null;
  subjects: { name: string; code: string } | null;
}

export interface EvaluatedPaper {
  id: string;
  student_id: string;
  exam_id: string;
  subject_id: string;
  file_name: string;
  storage_path: string;
  notes: string | null;
  uploaded_by: string | null;
  uploaded_at: string;
  exams: { name: string; exam_date: string | null } | null;
  subjects: { name: string; code: string } | null;
  url: string | null;
}

export interface PaymentRecord {
  id: string;
  student_id: string;
  fee_structure_id: string | null;
  amount: number;
  payment_date: string;
  payment_method: "cash" | "card" | "bank_transfer" | "online" | "cheque" | "other";
  reference_no: string | null;
  notes: string | null;
  recorded_by: string | null;
  receipt_no: string;
  created_at: string;
}

export interface FeeSummary {
  totalDue: number;
  totalPaid: number;
  balance: number;
  structures: {
    id: string;
    term: string | null;
    amount: number;
    due_date: string | null;
    /** The class's own amount, before any per-student override — set alongside override_amount when this line has been adjusted for this one student. */
    original_amount?: number;
    override_amount?: number | null;
  }[];
  transportFee: { fee_amount: number; payment_status: "paid" | "unpaid" | "partial"; fee_due_date: string | null } | null;
  payments: { id: string; amount: number; payment_date: string }[];
}

export interface StudentTransportAssignment {
  pickup_point_id: string;
  is_active: boolean;
  transport_direction: "morning" | "evening" | "both";
  pickup_points: {
    id: string;
    name: string;
    address: string | null;
    stop_order: number;
    pickup_time: string | null;
    routes: {
      id: string;
      name: string;
      route_code: string | null;
      vehicle: { id: string; vehicle_number: string; make_model: string | null } | null;
      primary_driver: { users: { full_name: string; phone: string | null } } | null;
    } | null;
  } | null;
}

export interface ReportCard {
  generated_at: string;
  student: {
    id: string;
    admission_no: string;
    users: { full_name: string } | null;
    classes: { name: string; section: string } | null;
  };
  attendance: StudentDashboard["attendance"];
  marks: StudentDashboard["marks"];
}

export type ProfileChangeStatus = "pending" | "approved" | "rejected" | "cancelled";

export interface ProfileChangeFieldEdit {
  from: unknown;
  to: unknown;
}

export interface ProfileChangeRequest {
  id: string;
  student_id: string;
  requested_by: string;
  requester_role: "student";
  changes: Record<string, ProfileChangeFieldEdit>;
  reason: string | null;
  status: ProfileChangeStatus;
  reviewer_notes: string | null;
  reviewed_by: string | null;
  reviewed_at: string | null;
  created_at: string;
  student?: { id: string; admission_no: string; users: { full_name: string } | null; classes: { name: string; section: string } | null } | null;
}

export interface StudentProfile {
  id: string;
  admission_no: string;
  roll_no: string | null;
  date_of_birth: string | null;
  gender: string | null;
  address: string | null;
  admission_date: string | null;
  class_id: string | null;
  blood_group: string | null;
  allergies: string | null;
  medical_conditions: string | null;
  emergency_contact_name: string | null;
  emergency_contact_phone: string | null;
  doctor_name: string | null;
  doctor_phone: string | null;
  aadhaar_number: string | null;
  place_of_birth: string | null;
  nationality: string | null;
  religion: string | null;
  category: string | null;
  city: string | null;
  district: string | null;
  state: string | null;
  pin_code: string | null;
  father_name: string | null;
  father_phone: string | null;
  father_email: string | null;
  father_occupation: string | null;
  mother_name: string | null;
  mother_phone: string | null;
  mother_email: string | null;
  mother_occupation: string | null;
  classes: { name: string; section: string } | null;
  users: { full_name: string; email: string; phone: string | null; avatar_url: string | null; is_active: boolean } | null;
}
