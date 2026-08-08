// Shared across the teacher (review queue), student (apply/history), and
// admin (oversight) surfaces for the student_leave_requests table — kept
// separate from teacher.types.ts's LeaveRequestRecord/LeaveApplicantRole
// (the `leave_requests` table) since the two are intentionally distinct
// entities (see database/migrations/008_parent_module.sql).
export type StudentLeaveStatus = "pending" | "approved" | "rejected" | "cancelled";
export type StudentLeaveRequesterRole = "student";

export interface StudentLeaveRequestRecord {
  id: string;
  student_id: string;
  requester_role: StudentLeaveRequesterRole;
  start_date: string;
  end_date: string;
  reason: string;
  status: StudentLeaveStatus;
  reviewer_notes: string | null;
  reviewed_by: string | null;
  reviewed_at: string | null;
  created_at: string;
  alreadyReviewed?: boolean;
}

export interface StudentLeaveQueueRecord extends StudentLeaveRequestRecord {
  student: {
    id: string;
    admission_no: string;
    users: { full_name: string } | null;
    classes: { name: string; section: string } | null;
  } | null;
}
