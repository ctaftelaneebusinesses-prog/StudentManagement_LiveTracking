import * as attendanceService from "./attendance.service";
import * as examService from "./exam.service";
import * as homeworkService from "./homework.service";
import * as timetableService from "./timetable.service";
import * as notificationService from "./notification.service";

/** Aggregates every Student Dashboard widget into a single payload. */
export async function getDashboard(schoolId: string, studentId: string, requestingUserId: string) {
  const [attendance, marks, homework, timetable, notifications] = await Promise.all([
    attendanceService.getSummaryForStudent(schoolId, studentId),
    examService.getMarksSummaryForStudent(schoolId, studentId),
    homeworkService.listUpcomingForStudent(schoolId, studentId, 5),
    timetableService.getWeeklyForStudent(schoolId, studentId),
    notificationService.listForStudent(schoolId, studentId, requestingUserId, 10),
  ]);

  return { attendance, marks, homework, timetable, notifications };
}
