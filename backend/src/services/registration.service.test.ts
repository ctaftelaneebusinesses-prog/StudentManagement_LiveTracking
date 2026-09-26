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

// Reviewer contexts (SEC-05). Mirrors the real permission model:
//   principal  -> registration.review (+ users.manage)
//   schoolAdmin-> users.manage (no registration.review)
//   teacher    -> no review permissions; only their own assigned class regs
//   student    -> nothing
const principalReviewer = { id: "principal-1", roles: ["principal"], permissions: ["registration.review", "users.manage"] };
const schoolAdminReviewer = { id: "admin-1", roles: ["school_admin"], permissions: ["users.manage"] };
const teacherReviewer = { id: "teacher-1", roles: ["teacher"], permissions: [] as string[] };
const studentReviewer = { id: "student-9", roles: ["student"], permissions: [] as string[] };

/** Builds a fromMock where registration_requests returns `row` on select. */
function mockRequestRow(row: Record<string, unknown>, opts?: { updateResult?: { data: unknown; error: unknown }; onUserUpdate?: (patch: Record<string, unknown>) => void }) {
  const updateResult = opts?.updateResult ?? { data: { ...row }, error: null };
  fromMock.mockImplementation((table: string) => {
    if (table === "registration_requests") {
      return {
        select: vi.fn(() => chain({ data: row, error: null })),
        update: vi.fn(() => chain(updateResult)),
      };
    }
    if (table === "users") {
      return {
        update: vi.fn((patch: Record<string, unknown>) => {
          opts?.onUserUpdate?.(patch);
          return chain({ data: null, error: null });
        }),
        // some code paths call .from("users") then chain without .update first
        select: vi.fn(() => chain({ data: null, error: null })),
      };
    }
    throw new Error(`unexpected table ${table}`);
  });
}

beforeEach(() => {
  fromMock.mockReset();
  vi.clearAllMocks();
});

describe("review — happy paths", () => {
  it("approves a pending request: flips the applicant's status and notifies them", async () => {
    let userUpdateCalls = 0;
    fromMock.mockImplementation((table: string) => {
      if (table === "registration_requests") {
        return {
          select: vi.fn(() => chain({ data: { id: "req-1", user_id: "user-1", role_id: ROLE_ID.ACCOUNTANT, status: "pending", payload: {}, reviewer_type: "principal", assigned_reviewer_id: null }, error: null })),
          update: vi.fn(() => chain({ data: { id: "req-1", user_id: "user-1", role_id: ROLE_ID.ACCOUNTANT, payload: {} }, error: null })),
        };
      }
      if (table === "users") {
        userUpdateCalls += 1;
        return chain({ data: null, error: null });
      }
      throw new Error(`unexpected table ${table}`);
    });

    const result = await review("school-1", "req-1", principalReviewer, "approve", "Looks good");

    expect(result.alreadyReviewed).toBe(false);
    expect(userUpdateCalls).toBe(1);
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
          select: vi.fn(() => chain({ data: { id: "req-1", user_id: "user-1", role_id: ROLE_ID.DRIVER, status: "approved", payload: {}, reviewer_type: "principal", assigned_reviewer_id: null }, error: null })),
          update: vi.fn(() => chain({ data: null, error: { code: "PGRST116", message: "no rows" } })),
        };
      }
      throw new Error(`unexpected table ${table}`);
    });

    const result = await review("school-1", "req-1", principalReviewer, "approve");

    expect(result.alreadyReviewed).toBe(true);
    expect(notificationService.notifyUsers).not.toHaveBeenCalled();
  });

  it("a class teacher's approval of their assigned student registration flips only the student's own account", async () => {
    const userUpdates: Record<string, unknown>[] = [];
    mockRequestRow(
      { id: "req-1", user_id: "student-1", role_id: ROLE_ID.STUDENT, status: "pending", payload: {}, reviewer_type: "class_teacher", assigned_reviewer_id: "teacher-1" },
      { updateResult: { data: { id: "req-1", user_id: "student-1", role_id: ROLE_ID.STUDENT, payload: {} }, error: null }, onUserUpdate: (p) => userUpdates.push(p) }
    );

    await review("school-1", "req-1", teacherReviewer, "approve");

    expect(userUpdates).toHaveLength(1);
    expect(userUpdates[0].status).toBe("approved");
  });

  it("approving a teacher registration applies the deferred homeroom/subject payload", async () => {
    const payload = { is_class_teacher: true, homeroom_class_id: "class-1", assignments: [{ class_id: "class-1", subject_id: "subj-1" }] };
    mockRequestRow(
      { id: "req-1", user_id: "teacher-1", role_id: ROLE_ID.TEACHER, status: "pending", payload, reviewer_type: "principal", assigned_reviewer_id: null },
      { updateResult: { data: { id: "req-1", user_id: "teacher-1", role_id: ROLE_ID.TEACHER, payload }, error: null } }
    );

    await review("school-1", "req-1", principalReviewer, "approve");

    expect(teacherService.setHomeroomTeacher).toHaveBeenCalledWith("school-1", "teacher-1", "class-1", false);
    expect(teacherService.bulkAssignSubjects).toHaveBeenCalledWith("school-1", "teacher-1", [{ class_id: "class-1", subject_id: "subj-1" }]);
  });

  it("rejecting a request never applies the deferred teacher payload", async () => {
    const payload = { is_class_teacher: true, homeroom_class_id: "class-1", assignments: [{ class_id: "class-1", subject_id: "subj-1" }] };
    mockRequestRow(
      { id: "req-1", user_id: "teacher-1", role_id: ROLE_ID.TEACHER, status: "pending", payload, reviewer_type: "principal", assigned_reviewer_id: null },
      { updateResult: { data: { id: "req-1", user_id: "teacher-1", role_id: ROLE_ID.TEACHER, payload }, error: null } }
    );

    await review("school-1", "req-1", principalReviewer, "reject", "Missing documents");

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

describe("review — authorization (SEC-05)", () => {
  it("denies a student and does not mutate or notify", async () => {
    let userUpdated = false;
    mockRequestRow(
      { id: "req-1", user_id: "user-1", role_id: ROLE_ID.PRINCIPAL, status: "pending", payload: {}, reviewer_type: "admin", assigned_reviewer_id: null },
      { onUserUpdate: () => { userUpdated = true; } }
    );

    await expect(review("school-1", "req-1", studentReviewer, "reject")).rejects.toMatchObject({ statusCode: 403 });
    expect(userUpdated).toBe(false);
    expect(notificationService.notifyUsers).not.toHaveBeenCalled();
  });

  it("denies a teacher who is NOT the assigned reviewer of a class_teacher-routed request", async () => {
    mockRequestRow({ id: "req-1", user_id: "student-1", role_id: ROLE_ID.STUDENT, status: "pending", payload: {}, reviewer_type: "class_teacher", assigned_reviewer_id: "some-other-teacher" });
    await expect(review("school-1", "req-1", teacherReviewer, "approve")).rejects.toMatchObject({ statusCode: 403 });
  });

  it("denies a principal (registration.review only) from reviewing an admin-routed request", async () => {
    const principalOnly = { id: "principal-2", roles: ["principal"], permissions: ["registration.review"] };
    mockRequestRow({ id: "req-1", user_id: "user-1", role_id: ROLE_ID.PRINCIPAL, status: "pending", payload: {}, reviewer_type: "admin", assigned_reviewer_id: null });
    await expect(review("school-1", "req-1", principalOnly, "approve")).rejects.toMatchObject({ statusCode: 403 });
  });

  it("allows a school admin (users.manage) to review an admin-routed request", async () => {
    mockRequestRow(
      { id: "req-1", user_id: "user-1", role_id: ROLE_ID.PRINCIPAL, status: "pending", payload: {}, reviewer_type: "admin", assigned_reviewer_id: null },
      { updateResult: { data: { id: "req-1", user_id: "user-1", role_id: ROLE_ID.PRINCIPAL, payload: {} }, error: null } }
    );
    const result = await review("school-1", "req-1", schoolAdminReviewer, "approve");
    expect(result.alreadyReviewed).toBe(false);
  });

  it("denies an unauthorized non-review role (e.g. accountant/driver with no review permissions)", async () => {
    const accountantReviewer = { id: "acct-1", roles: ["accountant"], permissions: ["fees.view", "fees.manage"] };
    mockRequestRow({ id: "req-1", user_id: "user-1", role_id: ROLE_ID.TEACHER, status: "pending", payload: {}, reviewer_type: "principal", assigned_reviewer_id: null });
    await expect(review("school-1", "req-1", accountantReviewer, "approve")).rejects.toMatchObject({ statusCode: 403 });
  });

  it("rejects a cross-school registration review (request not visible in the caller's school)", async () => {
    // The service filters registration_requests by the caller's school_id; a
    // request that belongs to another school is simply not found.
    fromMock.mockImplementation((table: string) => {
      if (table === "registration_requests") return { select: vi.fn(() => chain({ data: null, error: null })) };
      throw new Error(`unexpected table ${table}`);
    });
    await expect(review("school-A", "req-in-school-B", schoolAdminReviewer, "approve")).rejects.toMatchObject({ statusCode: 404 });
  });
});
