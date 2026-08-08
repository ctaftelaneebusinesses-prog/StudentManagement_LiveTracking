import { beforeEach, describe, expect, it, vi } from "vitest";
import { chain } from "../test-support/supabaseChain";
import { ROLE_ID } from "../config/roles";

vi.mock("../config/supabase", () => ({
  supabaseAdmin: { from: vi.fn(), storage: { from: vi.fn() } },
}));

vi.mock("./notification.service", () => ({
  notifyUsers: vi.fn().mockResolvedValue([]),
}));

vi.mock("./teacher.service", () => ({
  setHomeroomTeacher: vi.fn().mockResolvedValue({}),
  bulkAssignSubjects: vi.fn().mockResolvedValue([]),
}));

import { supabaseAdmin } from "../config/supabase";
import { review } from "./registration.service";
import * as notificationService from "./notification.service";
import * as teacherService from "./teacher.service";

const fromMock = (supabaseAdmin as unknown as { from: ReturnType<typeof vi.fn> }).from;

beforeEach(() => {
  fromMock.mockReset();
  vi.clearAllMocks();
});

describe("review", () => {
  it("approves a pending request: flips the applicant's status and notifies them", async () => {
    let userUpdateCalls = 0;
    fromMock.mockImplementation((table: string) => {
      if (table === "registration_requests") {
        return {
          select: vi.fn(() => chain({ data: { id: "req-1", user_id: "user-1", role_id: ROLE_ID.ACCOUNTANT, status: "pending", payload: {} }, error: null })),
          update: vi.fn(() => chain({ data: { id: "req-1", user_id: "user-1", role_id: ROLE_ID.ACCOUNTANT, payload: {} }, error: null })),
        };
      }
      if (table === "users") {
        userUpdateCalls += 1;
        return chain({ data: null, error: null });
      }
      throw new Error(`unexpected table ${table}`);
    });

    const result = await review("school-1", "req-1", "principal-1", "approve", "Looks good");

    expect(result.alreadyReviewed).toBe(false);
    expect(userUpdateCalls).toBe(1); // only the applicant's own users row — no student_user_id in payload
    expect(notificationService.notifyUsers).toHaveBeenCalledWith(
      "school-1",
      "principal-1",
      ["user-1"],
      expect.objectContaining({ type: "registration_approved" })
    );
  });

  it("is race-safe: a second concurrent review on an already-resolved row is a no-op, not an error", async () => {
    fromMock.mockImplementation((table: string) => {
      if (table === "registration_requests") {
        return {
          select: vi.fn(() => chain({ data: { id: "req-1", user_id: "user-1", role_id: ROLE_ID.DRIVER, status: "approved", payload: {} }, error: null })),
          // The conditional .eq("status", "pending") update matches no row —
          // simulated here as a PGRST116 "no rows" error with null data.
          update: vi.fn(() => chain({ data: null, error: { code: "PGRST116", message: "no rows" } })),
        };
      }
      throw new Error(`unexpected table ${table}`);
    });

    const result = await review("school-1", "req-1", "principal-1", "approve");

    expect(result.alreadyReviewed).toBe(true);
    expect(notificationService.notifyUsers).not.toHaveBeenCalled();
  });

  it("a class teacher's approval of a student registration flips only the student's own account", async () => {
    const userUpdates: Record<string, unknown>[] = [];
    fromMock.mockImplementation((table: string) => {
      if (table === "registration_requests") {
        return {
          select: vi.fn(() =>
            chain({
              data: { id: "req-1", user_id: "student-1", role_id: ROLE_ID.STUDENT, status: "pending", payload: {} },
              error: null,
            })
          ),
          update: vi.fn(() =>
            chain({
              data: { id: "req-1", user_id: "student-1", role_id: ROLE_ID.STUDENT, payload: {} },
              error: null,
            })
          ),
        };
      }
      if (table === "users") {
        return {
          update: vi.fn((patch: Record<string, unknown>) => {
            userUpdates.push(patch);
            return chain({ data: null, error: null });
          }),
        };
      }
      throw new Error(`unexpected table ${table}`);
    });

    await review("school-1", "req-1", "teacher-1", "approve");

    expect(userUpdates).toHaveLength(1);
    expect(userUpdates[0].status).toBe("approved");
  });

  it("approving a teacher registration applies the deferred homeroom/subject payload", async () => {
    fromMock.mockImplementation((table: string) => {
      if (table === "registration_requests") {
        return {
          select: vi.fn(() =>
            chain({
              data: {
                id: "req-1",
                user_id: "teacher-1",
                role_id: ROLE_ID.TEACHER,
                status: "pending",
                payload: { is_class_teacher: true, homeroom_class_id: "class-1", assignments: [{ class_id: "class-1", subject_id: "subj-1" }] },
              },
              error: null,
            })
          ),
          update: vi.fn(() =>
            chain({
              data: {
                id: "req-1",
                user_id: "teacher-1",
                role_id: ROLE_ID.TEACHER,
                payload: { is_class_teacher: true, homeroom_class_id: "class-1", assignments: [{ class_id: "class-1", subject_id: "subj-1" }] },
              },
              error: null,
            })
          ),
        };
      }
      if (table === "users") return chain({ data: null, error: null });
      throw new Error(`unexpected table ${table}`);
    });

    await review("school-1", "req-1", "principal-1", "approve");

    expect(teacherService.setHomeroomTeacher).toHaveBeenCalledWith("school-1", "teacher-1", "class-1", false);
    expect(teacherService.bulkAssignSubjects).toHaveBeenCalledWith("school-1", "teacher-1", [{ class_id: "class-1", subject_id: "subj-1" }]);
  });

  it("rejecting a request never applies the deferred teacher payload", async () => {
    fromMock.mockImplementation((table: string) => {
      if (table === "registration_requests") {
        return {
          select: vi.fn(() =>
            chain({
              data: { id: "req-1", user_id: "teacher-1", role_id: ROLE_ID.TEACHER, status: "pending", payload: { is_class_teacher: true, homeroom_class_id: "class-1", assignments: [{ class_id: "class-1", subject_id: "subj-1" }] } },
              error: null,
            })
          ),
          update: vi.fn(() =>
            chain({
              data: { id: "req-1", user_id: "teacher-1", role_id: ROLE_ID.TEACHER, payload: { is_class_teacher: true, homeroom_class_id: "class-1", assignments: [{ class_id: "class-1", subject_id: "subj-1" }] } },
              error: null,
            })
          ),
        };
      }
      if (table === "users") return chain({ data: null, error: null });
      throw new Error(`unexpected table ${table}`);
    });

    await review("school-1", "req-1", "principal-1", "reject", "Missing documents");

    expect(teacherService.setHomeroomTeacher).not.toHaveBeenCalled();
    expect(teacherService.bulkAssignSubjects).not.toHaveBeenCalled();
    expect(notificationService.notifyUsers).toHaveBeenCalledWith(
      "school-1",
      "principal-1",
      ["teacher-1"],
      expect.objectContaining({ type: "registration_rejected" })
    );
  });
});
