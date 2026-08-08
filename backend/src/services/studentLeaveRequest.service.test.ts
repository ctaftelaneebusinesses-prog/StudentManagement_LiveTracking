import { beforeEach, describe, expect, it, vi } from "vitest";
import { chain } from "../test-support/supabaseChain";

vi.mock("../config/supabase", () => ({
  supabaseAdmin: { from: vi.fn() },
}));

vi.mock("./notification.service", () => ({
  notifyUsers: vi.fn().mockResolvedValue([]),
  createNotification: vi.fn().mockResolvedValue({}),
}));

import { supabaseAdmin } from "../config/supabase";
import { applyForLeave, review } from "./studentLeaveRequest.service";
import * as notificationService from "./notification.service";

const fromMock = (supabaseAdmin as unknown as { from: ReturnType<typeof vi.fn> }).from;

beforeEach(() => {
  fromMock.mockReset();
  vi.clearAllMocks();
});

/** Comfortably in the future regardless of when this test runs, so it never trips the past-date/6PM-cutoff validation. */
const FUTURE_START = new Date(Date.now() + 30 * 86_400_000).toISOString().slice(0, 10);
const FUTURE_END = new Date(Date.now() + 31 * 86_400_000).toISOString().slice(0, 10);

describe("applyForLeave", () => {
  it("files the request as the student themself and notifies their class teacher", async () => {
    let leaveRequestsCalls = 0;
    fromMock.mockImplementation((table: string) => {
      if (table === "student_leave_requests") {
        leaveRequestsCalls += 1;
        // 1st call: the duplicate-pending-request check — none exists.
        if (leaveRequestsCalls === 1) return chain({ data: null, error: null });
        // 2nd call: the actual insert.
        return chain({ data: { id: "req-1", student_id: "student-1" }, error: null });
      }
      if (table === "students") return chain({ data: { class_id: "class-1" }, error: null });
      if (table === "classes") return chain({ data: { class_teacher_id: "teacher-1" }, error: null });
      throw new Error(`unexpected table ${table}`);
    });

    await applyForLeave("school-1", "student-1", { start_date: FUTURE_START, end_date: FUTURE_END, reason: "Family event" });

    await vi.waitFor(() =>
      expect(notificationService.notifyUsers).toHaveBeenCalledWith(
        "school-1",
        "student-1",
        ["teacher-1"],
        expect.objectContaining({ type: "student_leave_submitted" })
      )
    );
  });

  it("rejects an end date before the start date", async () => {
    await expect(
      applyForLeave("school-1", "student-1", { start_date: FUTURE_END, end_date: FUTURE_START, reason: "Family event" })
    ).rejects.toThrow(/on or after/);
  });

  it("rejects a past start date", async () => {
    await expect(
      applyForLeave("school-1", "student-1", { start_date: "2020-01-01", end_date: "2020-01-02", reason: "Family event" })
    ).rejects.toThrow(/past date/);
  });

  it("rejects a duplicate pending request for the same dates", async () => {
    fromMock.mockImplementation((table: string) => {
      if (table === "student_leave_requests") return chain({ data: { id: "existing-request" }, error: null });
      throw new Error(`unexpected table ${table}`);
    });

    await expect(
      applyForLeave("school-1", "student-1", { start_date: FUTURE_START, end_date: FUTURE_END, reason: "Family event" })
    ).rejects.toThrow(/already have a pending leave request/);
  });
});

describe("review", () => {
  const PENDING_ROW = { id: "req-1", student_id: "student-1", status: "pending" };

  it("lets the student's own class teacher approve", async () => {
    let leaveCall = 0;
    fromMock.mockImplementation((table: string) => {
      if (table === "students") return chain({ data: { class_id: "class-1" }, error: null });
      if (table === "classes") return chain({ data: { class_teacher_id: "teacher-1" }, error: null });
      if (table === "student_leave_requests") {
        leaveCall += 1;
        if (leaveCall === 1) return chain({ data: PENDING_ROW, error: null });
        return chain({ data: { ...PENDING_ROW, status: "approved", reviewed_by: "teacher-1" }, error: null });
      }
      throw new Error(`unexpected table ${table}`);
    });

    const result = await review("school-1", "req-1", "teacher-1", "approved");
    expect(result.alreadyReviewed).toBe(false);
    expect(notificationService.createNotification).toHaveBeenCalledWith(
      "school-1",
      "teacher-1",
      expect.objectContaining({ type: "student_leave_approved", audience_user_id: "student-1" })
    );
  });

  it("forbids a teacher who isn't this student's class teacher", async () => {
    fromMock.mockImplementation((table: string) => {
      if (table === "students") return chain({ data: { class_id: "class-1" }, error: null });
      if (table === "classes") return chain({ data: { class_teacher_id: "teacher-1" }, error: null });
      if (table === "student_leave_requests") return chain({ data: PENDING_ROW, error: null });
      throw new Error(`unexpected table ${table}`);
    });

    await expect(review("school-1", "req-1", "some-other-teacher", "approved")).rejects.toThrow(/class teacher/);
  });
});
