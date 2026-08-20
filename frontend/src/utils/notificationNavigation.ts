import { AppNotification } from "@/types/notification.types";
import { RoleName } from "@/types/auth.types";

/** Where clicking a "van" notification should take the viewer, based on their role. */
function vanNotificationRoute(roleNames: RoleName[]): string {
  if (roleNames.includes("driver")) return "/dashboard/driver";
  if (roleNames.includes("student")) return "/dashboard/portal/transport";
  return "/dashboard/admin/transport?tab=monitoring";
}

function isAdminTier(roleNames: RoleName[]): boolean {
  return roleNames.some((r) => r === "school_admin" || r === "super_admin" || r === "principal");
}

/**
 * Resolves the page a notification click should land on, based on its `type`
 * (and, for a couple of types, `metadata`) plus the viewer's own role — the
 * same notification type is reviewed from a different page depending on who
 * received it (e.g. a class teacher vs. a school admin). Falls back to any
 * server-set `metadata.url` (still used by a few flows, e.g. leave requests),
 * then to null if there's nowhere to send this notification type.
 */
export function resolveNotificationRoute(notification: AppNotification, roleNames: RoleName[]): string | null {
  const metadata = notification.metadata ?? {};
  const isTeacher = roleNames.includes("teacher");

  switch (notification.type) {
    case "van":
      return vanNotificationRoute(roleNames);

    case "registration_submitted":
      return isTeacher ? "/dashboard/teacher/registration-approvals" : "/dashboard/admin/registration-approvals";
    case "registration_approved":
    case "registration_rejected":
      return "/registration-status";

    case "teacher_leave_submitted":
    case "principal_leave_submitted":
    case "student_leave_submitted":
      return "/dashboard/admin/leave-requests";
    case "teacher_leave_approved":
    case "teacher_leave_rejected":
      return "/dashboard/teacher/leave";
    case "principal_leave_approved":
    case "principal_leave_rejected":
      return "/dashboard/admin/my-leave";
    case "student_leave_approved":
    case "student_leave_rejected":
      return "/dashboard/student/leave";

    case "homework":
      return isTeacher ? "/dashboard/teacher/homework" : "/dashboard/portal/homework";

    case "marks": {
      const examId = metadata.exam_id;
      const examQuery = typeof examId === "string" ? `?examId=${examId}` : "";
      if (isAdminTier(roleNames)) return `/dashboard/admin/exams${examQuery}`;
      if (isTeacher) return "/dashboard/teacher/marks";
      return `/dashboard/portal/exams${examQuery}`;
    }

    case "profile_change_submitted":
      return "/dashboard/teacher/profile-approval";
    case "profile_change_approved":
    case "profile_change_rejected":
      return "/dashboard/portal/profile";

    case "timetable_change_suggested":
      return "/dashboard/admin/timetable";

    case "announcement":
      return roleNames.includes("student") ? "/dashboard/portal/events" : null;

    default: {
      const url = metadata.url;
      return typeof url === "string" && url ? url : null;
    }
  }
}
