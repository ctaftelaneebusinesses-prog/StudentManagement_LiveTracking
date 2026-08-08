import { beforeEach, describe, expect, it, vi } from "vitest";
import { chain } from "../test-support/supabaseChain";

vi.mock("../config/supabase", () => ({
  supabaseAdmin: { from: vi.fn() },
}));

vi.mock("./notification.service", () => ({
  notifyUsers: vi.fn().mockResolvedValue([]),
  notifyStudents: vi.fn().mockResolvedValue([]),
}));

import { supabaseAdmin } from "../config/supabase";
import * as notificationService from "./notification.service";
import { calculateGrade, getPerformanceAnalytics, getClassSubjectMarksStatus, sendMarksReminder } from "./exam.service";

const fromMock = (supabaseAdmin as unknown as { from: ReturnType<typeof vi.fn> }).from;

beforeEach(() => {
  fromMock.mockReset();
});

describe("calculateGrade", () => {
  it("maps percentage bands to letter grades", () => {
    expect(calculateGrade(95, 100)).toBe("A+");
    expect(calculateGrade(72, 100)).toBe("B+");
    expect(calculateGrade(45, 100)).toBe("D");
    expect(calculateGrade(25, 100)).toBe("E");
  });
});

describe("getPerformanceAnalytics", () => {
  it("aggregates class-level performance from exam marks", async () => {
    fromMock.mockImplementation(() =>
      chain({
        data: [
          {
            exam_id: "exam-1",
            marks_obtained: 80,
            max_marks: 100,
            exams: { id: "exam-1", name: "Mid Term", class_id: "class-1", exam_date: "2026-01-10", classes: { name: "Grade 6", section: "A" } },
            subjects: { name: "Math", code: "MTH" },
          },
        ],
        error: null,
      })
    );

    const result = await getPerformanceAnalytics("school-1");

    expect(result.totalExams).toBe(1);
    expect(result.totalStudents).toBe(1);
    expect(result.averagePercentage).toBe(80);
    expect(result.byClass).toEqual([
      expect.objectContaining({ classId: "class-1", className: "Grade 6 A", averagePercentage: 80 }),
    ]);
  });
});

describe("getClassSubjectMarksStatus", () => {
  it("marks a subject completed only once every roster student has marks, and reports the latest update", async () => {
    fromMock.mockImplementation((table: string) => {
      if (table === "exams") return chain({ data: { id: "exam-1" }, error: null });
      if (table === "class_subjects") {
        return chain({
          data: [
            { subject_id: "subj-math", teacher_id: "teacher-1", subjects: { name: "Math", code: "MTH" }, users: { full_name: "Ms. Rao" } },
            { subject_id: "subj-eng", teacher_id: "teacher-2", subjects: { name: "English", code: "ENG" }, users: { full_name: "Mr. Iyer" } },
          ],
          error: null,
        });
      }
      if (table === "students") return chain({ data: null, error: null, count: 2 });
      if (table === "exam_marks") {
        return chain({
          data: [
            { subject_id: "subj-math", student_id: "s1", updated_at: "2026-01-01T00:00:00.000Z" },
            { subject_id: "subj-math", student_id: "s2", updated_at: "2026-01-02T00:00:00.000Z" },
            { subject_id: "subj-eng", student_id: "s1", updated_at: "2026-01-01T00:00:00.000Z" },
          ],
          error: null,
        });
      }
      throw new Error(`unexpected table ${table}`);
    });

    const result = await getClassSubjectMarksStatus("school-1", "class-1", "exam-1");

    expect(result).toEqual([
      expect.objectContaining({ subjectId: "subj-math", status: "completed", markedCount: 2, rosterCount: 2, lastUpdated: "2026-01-02T00:00:00.000Z" }),
      expect.objectContaining({ subjectId: "subj-eng", status: "pending", markedCount: 1, rosterCount: 2 }),
    ]);
  });
});

describe("sendMarksReminder", () => {
  it("notifies the subject's assigned teacher", async () => {
    fromMock.mockImplementation((table: string) => {
      if (table === "class_subjects") return chain({ data: { teacher_id: "teacher-2" }, error: null });
      if (table === "classes") return chain({ data: { name: "Grade 6", section: "A" }, error: null });
      if (table === "subjects") return chain({ data: { name: "English" }, error: null });
      throw new Error(`unexpected table ${table}`);
    });

    await sendMarksReminder("school-1", "class-teacher-1", "class-1", "subj-eng", "exam-1");

    expect(notificationService.notifyUsers).toHaveBeenCalledWith(
      "school-1",
      "class-teacher-1",
      ["teacher-2"],
      expect.objectContaining({ title: "Marks upload reminder" })
    );
  });

  it("throws not-found when nobody is assigned to teach the subject", async () => {
    fromMock.mockImplementation((table: string) => {
      if (table === "class_subjects") return chain({ data: null, error: null });
      if (table === "classes") return chain({ data: { name: "Grade 6", section: "A" }, error: null });
      if (table === "subjects") return chain({ data: { name: "English" }, error: null });
      throw new Error(`unexpected table ${table}`);
    });

    await expect(sendMarksReminder("school-1", "class-teacher-1", "class-1", "subj-eng", "exam-1")).rejects.toMatchObject({
      statusCode: 404,
    });
  });
});
