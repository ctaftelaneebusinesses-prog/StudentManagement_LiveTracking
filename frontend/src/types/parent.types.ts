import { StudentDashboard } from "./dashboard.types";

export interface ParentChild {
  id: string;
  admission_no: string;
  users: { full_name: string } | null;
  classes: { name: string; section: string } | null;
}

export interface ParentDashboardChild {
  child: ParentChild;
  overview: StudentDashboard;
}

export interface ParentDashboard {
  children: ParentDashboardChild[];
}

export interface LeaveRequest {
  id: string;
  student_id: string;
  start_date: string;
  end_date: string;
  reason: string;
  status: "pending" | "approved" | "rejected" | "cancelled";
  reviewer_notes: string | null;
  created_at: string;
  students?: { users: { full_name: string } | null } | null;
}

export interface ReportCard {
  generated_at: string;
  student: ParentChild;
  attendance: StudentDashboard["attendance"];
  marks: StudentDashboard["marks"];
}
