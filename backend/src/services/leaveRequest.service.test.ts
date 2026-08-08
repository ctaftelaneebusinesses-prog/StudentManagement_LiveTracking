import { beforeEach, describe, expect, it, vi } from "vitest";
import { chain } from "../test-support/supabaseChain";

vi.mock("../config/supabase", () => ({
  supabaseAdmin: { from: vi.fn() },
}));

vi.mock("./notification.service", () => ({
  notifyUsers: vi.fn().mockResolvedValue([]),
}));

vi.mock("./push.service", () => ({
  sendToUserIds: vi.fn().mockResolvedValue(undefined),
}));

import { supabaseAdmin } from "../config/supabase";
import { reviewLeaveRequest, applyForLeave } from "./leaveRequest.service";
import * as notificationService from "./notification.service";

const fromMock = (supabaseAdmin as unknown as { from: ReturnType<typeof vi.fn> }).from;

beforeEach(() => {
  fromMock.mockReset();
  vi.clearAllMocks();
});

const PENDING_ROW = {
  id: "leave-1",
  teacher_id: "teacher-1",
  applicant_role: "teacher",
  status: "pending",
  reviewed_by: null,
  reviewed_by_role: null,
};

const USERS_LOOKUP = chain({ data: [{ id: "teacher-1", full_name: "Jane Teacher", email: "jane@example.com" }], error: null });

/** A date comfortably in the future regardless of when this test runs, so it never trips the past-date/6PM-cutoff validation. */
const FUTURE_START = new Date(Date.now() + 30 * 86_400_000).toISOString().slice(0, 10);
const FUTURE_END = new Date(Date.now() + 31 * 86_400_000).toISOString().slice(0, 10);

describe("reviewLeaveRequest", () => {
  it("approves a still-pending request and reports it as freshly reviewed", async () => {
    fromMock.mockImplementation((table: string) => {
      if (table === "users") return USERS_LOOKUP;
      return chain({ data: PENDING_ROW, error: null });
    });

    const result = await reviewLeaveRequest("school-1", "leave-1", "admin-1", "school_admin", "approved");

    expect(result.alreadyReviewed).toBe(false);
    expect(notificationService.notifyUsers).toHaveBeenCalledWith(
      "school-1",
      "admin-1",
      ["teacher-1"],
      expect.objectContaining({ type: "teacher_leave_approved" })
    );
  });

  it("reports alreadyReviewed instead of erroring when the update loses the pending race", async () => {
    let call = 0;
    fromMock.mockImplementation((table: string) => {
      if (table === "users") return USERS_LOOKUP;
      call += 1;
      // 1st from("leave_requests"): the initial existing-row select.
      if (call === 1) return chain({ data: { ...PENDING_ROW, status: "approved", reviewed_by: "principal-1", reviewed_by_role: "principal" }, error: null });
      // 2nd from("leave_requests"): the conditional update — no row matched status='pending', PostgREST reports 0-rows on .single() as PGRST116.
      return chain({ data: null, error: { code: "PGRST116", message: "no rows" } });
    });

    const result = await reviewLeaveRequest("school-1", "leave-1", "admin-1", "school_admin", "approved");

    expect(result.alreadyReviewed).toBe(true);
    expect((result as { reviewed_by_role?: string }).reviewed_by_role).toBe("principal");
    expect(notificationService.notifyUsers).not.toHaveBeenCalled();
  });

  it("forbids a principal from reviewing another principal's leave request", async () => {
    fromMock.mockImplementation((table: string) => {
      if (table === "users") return USERS_LOOKUP;
      return chain({ data: { ...PENDING_ROW, applicant_role: "principal" }, error: null });
    });

    await expect(reviewLeaveRequest("school-1", "leave-1", "principal-2", "principal", "approved")).rejects.toThrow(
      /Only an admin/
    );
    expect(notificationService.notifyUsers).not.toHaveBeenCalled();
  });

  it("allows a true admin to review a principal's leave request", async () => {
    fromMock.mockImplementation((table: string) => {
      if (table === "users") return USERS_LOOKUP;
      return chain({ data: { ...PENDING_ROW, applicant_role: "principal" }, error: null });
    });

    const result = await reviewLeaveRequest("school-1", "leave-1", "admin-1", "school_admin", "rejected");
    expect(result.alreadyReviewed).toBe(false);
  });
});

describe("applyForLeave", () => {
  it("stores the caller's role as applicant_role and notifies the principal only for a teacher applicant", async () => {
    let leaveRequestsCalls = 0;
    fromMock.mockImplementation((table: string) => {
      if (table === "leave_requests") {
        leaveRequestsCalls += 1;
        // 1st call: the duplicate-pending-request check — none exists.
        if (leaveRequestsCalls === 1) return chain({ data: null, error: null });
        // 2nd call: the actual insert.
        return chain({ data: { ...PENDING_ROW }, error: null });
      }
      if (table === "user_roles") return chain({ data: [{ user_id: "principal-1" }], error: null });
      if (table === "users") return USERS_LOOKUP;
      throw new Error(`unexpected table ${table}`);
    });

    await applyForLeave("school-1", "teacher-1", "teacher", {
      start_date: FUTURE_START,
      end_date: FUTURE_END,
      leave_type: "casual",
    });

    // notifyOnApply is fire-and-forget (not awaited by applyForLeave), so give
    // its microtasks a chance to run before asserting.
    await vi.waitFor(() =>
      expect(notificationService.notifyUsers).toHaveBeenCalledWith(
        "school-1",
        "teacher-1",
        ["principal-1"],
        expect.objectContaining({ type: "teacher_leave_submitted" })
      )
    );
  });

  it("notifies only admins (never the applying principal) for a principal applicant", async () => {
    let leaveRequestsCalls = 0;
    fromMock.mockImplementation((table: string) => {
      if (table === "leave_requests") {
        leaveRequestsCalls += 1;
        if (leaveRequestsCalls === 1) return chain({ data: null, error: null });
        return chain({ data: { ...PENDING_ROW, applicant_role: "principal" }, error: null });
      }
      // A principal applicant's recipients now come from
      // resolveSchoolAdminRecipientIds (utils/notificationRecipients.ts):
      // school_admin_schools for assigned school_admins, plus user_roles for
      // every super_admin platform-wide (none in this fixture).
      if (table === "school_admin_schools") return chain({ data: [{ user_id: "admin-1" }], error: null });
      if (table === "user_roles") return chain({ data: [], error: null });
      if (table === "users") return USERS_LOOKUP;
      throw new Error(`unexpected table ${table}`);
    });

    await applyForLeave("school-1", "principal-1", "principal", {
      start_date: FUTURE_START,
      end_date: FUTURE_END,
      leave_type: "other",
    });

    await vi.waitFor(() =>
      expect(notificationService.notifyUsers).toHaveBeenCalledWith(
        "school-1",
        "principal-1",
        expect.arrayContaining(["admin-1"]),
        expect.objectContaining({ type: "principal_leave_submitted" })
      )
    );
  });

  it("rejects an end date before the start date", async () => {
    await expect(
      applyForLeave("school-1", "teacher-1", "teacher", { start_date: FUTURE_END, end_date: FUTURE_START, leave_type: "casual" })
    ).rejects.toThrow(/on or after/);
  });

  it("rejects a past start date", async () => {
    await expect(
      applyForLeave("school-1", "teacher-1", "teacher", { start_date: "2020-01-01", end_date: "2020-01-02", leave_type: "casual" })
    ).rejects.toThrow(/past date/);
  });

  it("rejects a duplicate pending request for the same dates", async () => {
    fromMock.mockImplementation((table: string) => {
      if (table === "leave_requests") return chain({ data: { id: "existing-leave" }, error: null });
      throw new Error(`unexpected table ${table}`);
    });

    await expect(
      applyForLeave("school-1", "teacher-1", "teacher", { start_date: FUTURE_START, end_date: FUTURE_END, leave_type: "casual" })
    ).rejects.toThrow(/already have a pending leave request/);
  });
});
