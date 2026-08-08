import { supabaseAdmin } from "../config/supabase";
import { ApiError } from "../utils/ApiError";
import * as attendanceService from "./attendance.service";
import * as feesService from "./fees.service";
import * as examService from "./exam.service";

export interface ActivityEntry {
  id: string;
  type: "activity_log" | "attendance" | "fee_payment" | "exam_mark";
  label: string;
  date: string;
}

const ATTENDANCE_STATUS_LABEL: Record<string, string> = {
  present: "Marked present",
  absent: "Marked absent",
  late: "Marked late",
  half_day: "Marked half-day",
  leave: "On leave",
  excused: "Excused",
};

/**
 * Aggregates a student's audit trail into one timeline: curated admin actions
 * (activity_logs, e.g. "student.created"/"student.updated" logged by
 * student.controller.ts), attendance history, fee payments, and exam marks.
 * Mirrors the Promise.all aggregation pattern in studentDashboard.service.ts.
 */
export async function getActivityTimeline(schoolId: string, studentId: string): Promise<ActivityEntry[]> {
  const [activityLogs, attendance, payments, marks] = await Promise.all([
    supabaseAdmin
      .from("activity_logs")
      .select("id, action, created_at")
      .eq("school_id", schoolId)
      .eq("target_type", "student")
      .eq("target_id", studentId)
      .order("created_at", { ascending: false })
      .limit(50)
      .then(({ data, error }) => {
        if (error) throw ApiError.internal(error.message);
        return data ?? [];
      }),
    attendanceService.getStudentAttendance(studentId).then((r) => r.records.slice(0, 50)),
    feesService.listPayments(schoolId, studentId),
    examService.listMarksForStudent(schoolId, studentId),
  ]);

  const entries: ActivityEntry[] = [
    ...activityLogs.map((row) => ({
      id: `log-${row.id}`,
      type: "activity_log" as const,
      label: row.action.replace(/[._]/g, " "),
      date: row.created_at,
    })),
    ...attendance.map((row: any, i: number) => ({
      id: `attendance-${row.date}-${i}`,
      type: "attendance" as const,
      label: ATTENDANCE_STATUS_LABEL[row.status] ?? `Attendance: ${row.status}`,
      date: row.date,
    })),
    ...(payments ?? []).map((row: any) => ({
      id: `fee-${row.id}`,
      type: "fee_payment" as const,
      label: `Fee payment recorded — ₹${Number(row.amount).toFixed(2)}`,
      date: row.payment_date,
    })),
    ...(marks ?? []).map((row: any) => ({
      id: `mark-${row.id}`,
      type: "exam_mark" as const,
      label: `${row.exams?.name ?? "Exam"} — ${row.subjects?.name ?? "Subject"}: ${row.marks_obtained}/${row.max_marks}`,
      date: row.exams?.exam_date ?? row.created_at ?? new Date(0).toISOString(),
    })),
  ];

  entries.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  return entries.slice(0, 50);
}
