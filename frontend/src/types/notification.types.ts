export type NotificationType =
  | "attendance"
  | "homework"
  | "marks"
  | "van"
  | "announcement"
  | "emergency"
  | "student_leave_submitted"
  | "student_leave_approved"
  | "student_leave_rejected"
  | "teacher_leave_submitted"
  | "teacher_leave_approved"
  | "teacher_leave_rejected"
  | "principal_leave_submitted"
  | "principal_leave_approved"
  | "principal_leave_rejected"
  | "timetable_change_suggested"
  | "registration_submitted"
  | "registration_approved"
  | "registration_rejected"
  | "school_request_submitted"
  | "school_request_approved"
  | "school_request_rejected";
export type NotificationPriority = "normal" | "high" | "critical";
export type NotificationAudienceScope = "school" | "class" | "student" | "role" | "user";

export interface AppNotification {
  id: string;
  title: string;
  message: string;
  type: NotificationType;
  priority: NotificationPriority;
  metadata: Record<string, unknown>;
  audience_scope: NotificationAudienceScope;
  audience_class_id: string | null;
  audience_user_id: string | null;
  created_by: string | null;
  created_at: string;
  email_sent_at: string | null;
  classes: { name: string; section: string } | null;
  isRead: boolean;
}

export const NOTIFICATION_TYPE_LABEL: Record<NotificationType, string> = {
  attendance: "Attendance",
  homework: "Homework",
  marks: "Marks",
  van: "Van Update",
  announcement: "Announcement",
  emergency: "Emergency Alert",
  student_leave_submitted: "Student Leave",
  student_leave_approved: "Leave Approved",
  student_leave_rejected: "Leave Rejected",
  teacher_leave_submitted: "Teacher Leave",
  teacher_leave_approved: "Leave Approved",
  teacher_leave_rejected: "Leave Rejected",
  principal_leave_submitted: "Principal Leave",
  principal_leave_approved: "Leave Approved",
  principal_leave_rejected: "Leave Rejected",
  timetable_change_suggested: "Timetable Suggestion",
  registration_submitted: "Registration",
  registration_approved: "Registration Approved",
  registration_rejected: "Registration Rejected",
  school_request_submitted: "School Request",
  school_request_approved: "School Request Approved",
  school_request_rejected: "School Request Rejected",
};
