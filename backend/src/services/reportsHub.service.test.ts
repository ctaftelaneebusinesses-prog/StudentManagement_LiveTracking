import { beforeEach, describe, expect, it, vi } from "vitest";
import { chain } from "../test-support/supabaseChain";

vi.mock("../config/supabase", () => ({
  supabaseAdmin: { from: vi.fn() },
}));

vi.mock("./student.service", () => ({
  listStudents: vi.fn(),
}));

vi.mock("./teacher.service", () => ({
  listTeachers: vi.fn(),
}));

vi.mock("./attendance.service", () => ({
  getOverallAnalytics: vi.fn(),
  getStudentWiseReport: vi.fn(),
}));

import { supabaseAdmin } from "../config/supabase";
import * as studentService from "./student.service";
import * as teacherService from "./teacher.service";
import * as attendanceService from "./attendance.service";
import { getAttendanceReport, getExamReportSummary, getStudentReport, getTeacherReport } from "./reportsHub.service";

const fromMock = (supabaseAdmin as unknown as { from: ReturnType<typeof vi.fn> }).from;

beforeEach(() => {
  fromMock.mockReset();
  vi.mocked(studentService.listStudents).mockReset();
  vi.mocked(teacherService.listTeachers).mockReset();
  vi.mocked(attendanceService.getOverallAnalytics).mockReset();
  vi.mocked(attendanceService.getStudentWiseReport).mockReset();
});

describe("getAttendanceReport", () => {
  it("merges the school-wide analytics with the student-wise drill-down table", async () => {
    vi.mocked(attendanceService.getOverallAnalytics).mockResolvedValue({
      trend: [],
      byClass: [],
      overall: { present_count: 0, absent_count: 0, late_count: 0, half_day_count: 0, leave_count: 0, excused_count: 0, total_marked: 0, present_pct: null },
    });
    vi.mocked(attendanceService.getStudentWiseReport).mockResolvedValue([{ student_id: "s1", present_pct: 90 }] as never);

    const result = await getAttendanceReport("school-1", { classId: "class-1", from: "2026-01-01", to: "2026-01-31" });

    expect(attendanceService.getOverallAnalytics).toHaveBeenCalledWith("school-1", "2026-01-01", "2026-01-31");
    expect(attendanceService.getStudentWiseReport).toHaveBeenCalledWith("school-1", "class-1");
    expect(result.studentWise).toEqual([{ student_id: "s1", present_pct: 90 }]);
  });
});

describe("getStudentReport", () => {
  it("enriches each roster row with attendance % and exam average %", async () => {
    vi.mocked(studentService.listStudents).mockResolvedValue({
      items: [{ id: "s1", admission_no: "A1" }, { id: "s2", admission_no: "A2" }],
      total: 2,
      page: 1,
      pageSize: 20,
    } as never);

    fromMock.mockImplementation((table: string) => {
      if (table === "vw_attendance_student_summary") {
        return chain({ data: [{ student_id: "s1", present_pct: 88 }], error: null });
      }
      if (table === "exam_marks") {
        return chain({
          data: [
            { student_id: "s1", marks_obtained: 45, max_marks: 50 },
            { student_id: "s1", marks_obtained: 40, max_marks: 50 },
          ],
          error: null,
        });
      }
      return chain({ data: null, error: null });
    });

    const result = await getStudentReport("school-1", { page: 1, pageSize: 20 });

    expect(result.items[0]).toMatchObject({ id: "s1", attendancePercentage: 88, examAveragePercentage: 85 });
    // No attendance/marks rows resolved for s2 — enrichment falls back to null rather than throwing.
    expect(result.items[1]).toMatchObject({ id: "s2", attendancePercentage: null, examAveragePercentage: null });
  });

  it("skips the enrichment queries entirely when the roster page is empty", async () => {
    vi.mocked(studentService.listStudents).mockResolvedValue({ items: [], total: 0, page: 1, pageSize: 20 } as never);

    const result = await getStudentReport("school-1", { page: 1, pageSize: 20 });

    expect(result.items).toEqual([]);
    expect(fromMock).not.toHaveBeenCalled();
  });
});

describe("getTeacherReport", () => {
  it("enriches each roster row with assignment count, this-month attendance %, and pending leave count", async () => {
    vi.mocked(teacherService.listTeachers).mockResolvedValue({
      items: [{ id: "t1", employee_id: "E1" }],
      total: 1,
      page: 1,
      pageSize: 20,
    } as never);

    fromMock.mockImplementation((table: string) => {
      if (table === "class_subjects") return chain({ data: [{ teacher_id: "t1" }, { teacher_id: "t1" }], error: null });
      if (table === "teacher_attendance") {
        return chain({
          data: [
            { teacher_id: "t1", status: "present" },
            { teacher_id: "t1", status: "present" },
            { teacher_id: "t1", status: "absent" },
          ],
          error: null,
        });
      }
      if (table === "leave_requests") return chain({ data: [{ teacher_id: "t1" }], error: null });
      return chain({ data: null, error: null });
    });

    const result = await getTeacherReport("school-1", { page: 1, pageSize: 20 });

    expect(result.items[0]).toMatchObject({
      id: "t1",
      assignmentCount: 2,
      attendancePercentageThisMonth: 66.7,
      pendingLeaveCount: 1,
    });
  });
});

describe("getExamReportSummary", () => {
  it("groups marks by exam and classifies pass/fail using the shared 40%-pass grade threshold", async () => {
    fromMock.mockImplementation((table: string) => {
      if (table === "exam_marks") {
        return chain({
          data: [
            { exam_id: "e1", student_id: "s1", marks_obtained: 45, max_marks: 50, exams: { name: "Midterm", exam_date: "2026-02-01", classes: { name: "10", section: "A" } } },
            { exam_id: "e1", student_id: "s2", marks_obtained: 10, max_marks: 50, exams: { name: "Midterm", exam_date: "2026-02-01", classes: { name: "10", section: "A" } } },
          ],
          error: null,
        });
      }
      return chain({ data: null, error: null });
    });

    const result = await getExamReportSummary("school-1");

    expect(result.exams).toHaveLength(1);
    expect(result.exams[0]).toMatchObject({
      examId: "e1",
      examName: "Midterm",
      className: "10 A",
      studentCount: 2,
      passCount: 1,
      failCount: 1,
    });
  });
});
