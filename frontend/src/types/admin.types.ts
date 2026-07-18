import { RoleName } from "./auth.types";

export interface School {
  id: string;
  name: string;
  code: string;
  address: string | null;
  phone: string | null;
  email: string | null;
  logo_url: string | null;
  settings: Record<string, unknown>;
  is_active: boolean;
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

export interface AdminUser {
  id: string;
  full_name: string;
  email: string;
  phone: string | null;
  is_active: boolean;
  avatar_url: string | null;
  role_id: number;
  roles: { name: RoleName };
  created_at: string;
}

export interface PaginatedResult<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
}

export interface ClassRoom {
  id: string;
  school_id: string;
  name: string;
  section: string;
  academic_year_id: string;
  branch_id: string | null;
  class_teacher_id: string | null;
  academic_years?: { name: string };
  branches?: { name: string } | null;
}

export interface Subject {
  id: string;
  school_id: string;
  name: string;
  code: string;
}

export interface ClassSubject {
  id: string;
  subject_id: string;
  teacher_id: string | null;
  subjects: { name: string; code: string };
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
  classes: { name: string; section: string } | null;
  users: { full_name: string; email: string; phone: string | null; avatar_url: string | null; is_active: boolean };
}

export interface Teacher {
  id: string;
  employee_id: string;
  qualification: string | null;
  joining_date: string;
  users: { full_name: string; email: string; phone: string | null; avatar_url: string | null; is_active: boolean };
}

export type ParentRelation = "father" | "mother" | "guardian";

export interface Parent {
  id: string;
  occupation: string | null;
  address: string | null;
  users: { full_name: string; email: string; phone: string | null; avatar_url: string | null; is_active: boolean };
}

export interface LinkedParent {
  relation: ParentRelation;
  parents: Parent;
}

export interface StudentProfile extends Student {
  student_parents: LinkedParent[];
}

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

export interface TeacherAssignment {
  id: string;
  class_id: string;
  subject_id: string;
  classes: { name: string; section: string };
  subjects: { name: string; code: string };
}
