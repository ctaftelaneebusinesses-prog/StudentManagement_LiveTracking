import { RoleName } from "./auth.types";

export interface School {
  id: string;
  name: string;
  code: string;
  branch_name: string | null;
  principal_name: string | null;
  address: string | null;
  phone: string | null;
  alternate_phone: string | null;
  email: string | null;
  city: string | null;
  district: string | null;
  state: string | null;
  pin_code: string | null;
  country: string | null;
  logo_url: string | null;
  settings: Record<string, unknown>;
  is_active: boolean;
  created_at?: string;
}

export interface PlatformSchoolStats {
  totalSchools: number;
  activeSchools: number;
  inactiveSchools: number;
  totalStudents: number;
  totalTeachers: number;
}

export interface SchoolProfileStats {
  totalStudents: number;
  totalTeachers: number;
  totalDrivers: number;
  totalClasses: number;
  totalSections: number;
}

export interface AcademicYear {
  id: string;
  school_id: string;
  name: string;
  start_date: string;
  end_date: string;
  is_current: boolean;
}

export interface Branch {
  id: string;
  school_id: string;
  name: string;
  address: string | null;
  is_main: boolean;
  is_active: boolean;
}

export interface Department {
  id: string;
  name: string;
  description: string | null;
  head_teacher_id: string | null;
  teachers: { users: { full_name: string } } | null;
  created_at: string;
}

export interface Holiday {
  id: string;
  name: string;
  date: string;
  is_recurring_yearly: boolean;
  academic_year_id: string | null;
  academic_years: { name: string } | null;
}

export interface EmailSettings {
  host: string;
  port?: number;
  user: string;
  password: string;
  from?: string;
  secure?: boolean;
}

export interface NotificationSettings {
  emailEnabled: boolean;
}

export interface BackupSettings {
  frequency: "daily" | "weekly" | "monthly";
  retentionDays: number;
  lastExportAt?: string;
}

export interface LoginHistoryEntry {
  id: string;
  email: string;
  success: boolean;
  ip_address: string | null;
  user_agent: string | null;
  created_at: string;
  users: { full_name: string } | null;
}

export interface ActivityLogEntry {
  id: string;
  action: string;
  target_type: string | null;
  target_id: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
  users: { full_name: string } | null;
}

export interface AdminUser {
  id: string;
  full_name: string;
  email: string;
  phone: string | null;
  is_active: boolean;
  avatar_url: string | null;
  role_id: number;
  designation: string | null;
  roles: { name: RoleName };
  created_at: string;
}

export interface PaginatedResult<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
}

export type ActiveStatus = "active" | "inactive";

export interface ClassRoom {
  id: string;
  school_id: string;
  name: string;
  section: string;
  academic_year_id: string;
  branch_id: string | null;
  class_teacher_id: string | null;
  capacity: number | null;
  status: ActiveStatus;
  academic_years?: { name: string };
  branches?: { name: string } | null;
  class_teacher?: { full_name: string } | null;
  student_count?: number;
}

export interface Subject {
  id: string;
  school_id: string;
  name: string;
  code: string;
  description: string | null;
  status: ActiveStatus;
}

export interface ClassSubject {
  id: string;
  subject_id: string;
  teacher_id: string | null;
  subjects: { name: string; code: string; description?: string | null; status?: ActiveStatus };
  users: { full_name: string } | null;
}

export interface Student {
  id: string;
  admission_no: string;
  roll_no: string | null;
  date_of_birth: string | null;
  gender: "male" | "female" | "other" | null;
  address: string | null;
  admission_date: string;
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
  users: { full_name: string; email: string; phone: string | null; avatar_url: string | null; is_active: boolean };
}

export interface Sibling {
  id: string;
  admission_no: string;
  roll_no: string | null;
  classes: { name: string; section: string } | null;
  users: { full_name: string; avatar_url: string | null };
}

export type ActivityEntryType = "activity_log" | "attendance" | "fee_payment" | "exam_mark";

export interface ActivityEntry {
  id: string;
  type: ActivityEntryType;
  label: string;
  date: string;
}

export interface StudentMarkEntry {
  id: string;
  marks_obtained: number;
  max_marks: number;
  grade: string | null;
  remarks: string | null;
  exam_id: string;
  exams: { name: string; exam_date: string | null } | null;
  subject_id: string;
  subjects: { name: string; code: string } | null;
}

export interface FeeStructure {
  id: string;
  class_id: string | null;
  student_id: string | null;
  academic_year_id: string | null;
  term: string;
  amount: number;
  discount_amount: number;
  scholarship_amount: number;
  due_date: string | null;
  classes?: { name: string; section: string };
  /** Only present on a fee summary's structures list — the class's own amount, before any per-student override. */
  original_amount?: number;
  /** Only present on a fee summary's structures list — set when this class-level line has been overridden for this one student. */
  override_amount?: number | null;
  override_reason?: string | null;
}

export interface FeePayment {
  id: string;
  student_id: string;
  fee_structure_id: string | null;
  amount: number;
  payment_date: string;
  payment_method: "cash" | "card" | "bank_transfer" | "online" | "cheque" | "other";
  reference_no: string | null;
  notes: string | null;
  receipt_no: string;
  created_at: string;
}

export interface TransportFeeSummary {
  fee_amount: number;
  payment_status: "paid" | "unpaid" | "partial";
  fee_due_date: string | null;
  fee_paid_date: string | null;
}

export interface StudentFeeProfileHeader {
  id: string;
  admissionNo: string;
  rollNo: string | null;
  name: string;
  avatarUrl: string | null;
  contactNumber: string | null;
  className: string;
  classId: string | null;
  parentName: string | null;
  parentContact: string | null;
}

export interface FeeSummary {
  student: StudentFeeProfileHeader;
  totalGross: number;
  totalDue: number;
  totalPaid: number;
  totalDiscount: number;
  totalScholarship: number;
  balance: number;
  dueDate: string | null;
  structures: FeeStructure[];
  transportFee: TransportFeeSummary | null;
  payments: FeePayment[];
}

export interface PickupPointInfo {
  id: string;
  name: string;
  address: string | null;
  stop_order: number;
  pickup_time: string | null;
  routes: {
    id: string;
    name: string;
    route_code: string;
    vehicle: { id: string; vehicle_number: string; name: string | null; make_model: string | null } | null;
    primary_driver: { users: { full_name: string; phone: string | null } } | null;
  } | null;
}

export interface StudentTransport {
  pickup_point_id: string;
  is_active: boolean;
  transport_direction: "morning" | "evening" | "both";
  pickup_points: PickupPointInfo;
}

export interface TeacherHomeroom {
  id: string;
  name: string;
  section: string;
  academic_year_id: string;
  academic_years: { name: string } | null;
}

export interface TeacherTeachingSummary {
  subjectCount: number;
  classes: string[];
}

export interface Teacher {
  id: string;
  employee_id: string;
  qualification: string | null;
  joining_date: string;
  experience_years: number | null;
  users: { full_name: string; email: string; phone: string | null; avatar_url: string | null; is_active: boolean };
  homeroom?: TeacherHomeroom | null;
  teaching?: TeacherTeachingSummary;
}

export type StudentProfile = Student;

export type DocumentType = "birth_certificate" | "id_proof" | "transfer_certificate" | "photo" | "medical" | "other";

export interface StudentDocument {
  id: string;
  doc_type: DocumentType;
  file_name: string;
  storage_path: string;
  notes: string | null;
  uploaded_at: string;
  uploaded_by: string | null;
  url: string | null;
}

export interface BulkCreateStudentsResult {
  created: Student[];
  failed: { index: number; admission_no?: string; email?: string; message: string }[];
  totalRequested: number;
}

export interface ClassAttendanceToday {
  student_id: string;
  student_name: string;
  attendance_id: string | null;
  status: "present" | "absent" | "late" | "half_day" | "leave" | "excused" | null;
  remarks: string | null;
  updated_at: string | null;
}

export interface TeacherAssignment {
  id: string;
  class_id: string;
  subject_id: string;
  classes: { name: string; section: string; academic_years: { name: string } | null };
  subjects: { name: string; code: string };
}

export type TeacherDocumentType =
  | "resume"
  | "id_proof"
  | "degree_certificate"
  | "experience_letter"
  | "photo"
  | "other";

export interface TeacherDocument {
  id: string;
  doc_type: TeacherDocumentType;
  file_name: string;
  storage_path: string;
  notes: string | null;
  uploaded_at: string;
  uploaded_by: string | null;
  url: string | null;
}

export type TeacherAttendanceStatus = "present" | "absent" | "half_day" | "leave";

export interface TeacherAttendanceRecord {
  id: string;
  date: string;
  status: TeacherAttendanceStatus;
  remarks: string | null;
  check_in_at: string | null;
  check_out_at: string | null;
}

export interface TeacherDailyAttendance {
  teacher_id: string;
  teacher_name: string;
  employee_id: string;
  attendance_id: string | null;
  status: TeacherAttendanceStatus | null;
  remarks: string | null;
  check_in_at: string | null;
  check_out_at: string | null;
  updated_at: string | null;
}

export interface TeacherAttendanceSummary {
  present: number;
  absent: number;
  half_day: number;
  leave: number;
  total: number;
  from: string;
}

export interface TeacherMonthlyAttendanceRow {
  teacher_id: string;
  teacher_name: string;
  employee_id: string;
  present: number;
  absent: number;
  half_day: number;
  leave: number;
  total: number;
}

export type LeaveRequestStatus = "pending" | "approved" | "rejected";
export type LeaveRequestApplicantRole = "teacher" | "principal";

export interface LeaveRequest {
  id: string;
  teacher_id: string;
  applicant_role: LeaveRequestApplicantRole;
  start_date: string;
  end_date: string;
  reason: string | null;
  status: LeaveRequestStatus;
  reviewed_by: string | null;
  reviewed_by_role: string | null;
  reviewed_at: string | null;
  created_at: string;
  users?: { full_name: string; email: string };
  /** Only present on a review-endpoint response — true if this request had already been resolved by someone else before this call landed. */
  alreadyReviewed?: boolean;
}
