import { beforeEach, describe, expect, it, vi } from "vitest";
import { chain } from "../test-support/supabaseChain";

vi.mock("../config/supabase", () => ({
  supabaseAdmin: { from: vi.fn() },
}));

vi.mock("../config/logger", () => ({
  logger: { error: vi.fn(), warn: vi.fn(), info: vi.fn() },
}));

import { supabaseAdmin } from "../config/supabase";
import { logActivity, logLoginAttempt } from "./auditLog.service";

const fromMock = (supabaseAdmin as unknown as { from: ReturnType<typeof vi.fn> }).from;

beforeEach(() => {
  fromMock.mockReset();
});

describe("logLoginAttempt", () => {
  it("inserts directly with the given userId/schoolId without looking up the user", async () => {
    const builder = chain({ data: null, error: null });
    fromMock.mockImplementation(() => builder);

    await logLoginAttempt("admin@school.test", true, { userId: "user-1", schoolId: "school-1", ip: "1.2.3.4" });

    expect(fromMock).toHaveBeenCalledWith("login_history");
    expect(builder.insert).toHaveBeenCalledWith(
      expect.objectContaining({ email: "admin@school.test", success: true, user_id: "user-1", school_id: "school-1", ip_address: "1.2.3.4" })
    );
  });

  it("resolves userId/schoolId from the users table when not given", async () => {
    fromMock.mockImplementation((table: string) => {
      if (table === "users") return chain({ data: { id: "user-2", school_id: "school-2" }, error: null });
      return chain({ data: null, error: null });
    });

    await logLoginAttempt("teacher@school.test", false, {});

    const usersCall = fromMock.mock.calls.find(([table]) => table === "users");
    expect(usersCall).toBeTruthy();
  });

  it("never throws even when the insert errors", async () => {
    fromMock.mockImplementation(() => chain({ data: null, error: { message: "boom" } }));
    await expect(logLoginAttempt("admin@school.test", true, { userId: "u1", schoolId: "s1" })).resolves.toBeUndefined();
  });

  it("never throws even when the lookup itself throws", async () => {
    fromMock.mockImplementation(() => {
      throw new Error("connection lost");
    });
    await expect(logLoginAttempt("admin@school.test", true, {})).resolves.toBeUndefined();
  });
});

describe("logActivity", () => {
  it("inserts a row with the given action and metadata", async () => {
    const builder = chain({ data: null, error: null });
    fromMock.mockImplementation(() => builder);

    await logActivity("school-1", "actor-1", "user.created", { targetType: "user", targetId: "target-1", metadata: { foo: "bar" } });

    expect(fromMock).toHaveBeenCalledWith("activity_logs");
    expect(builder.insert).toHaveBeenCalledWith({
      school_id: "school-1",
      actor_user_id: "actor-1",
      action: "user.created",
      target_type: "user",
      target_id: "target-1",
      metadata: { foo: "bar" },
    });
  });

  it("never throws even when the insert errors", async () => {
    fromMock.mockImplementation(() => chain({ data: null, error: { message: "boom" } }));
    await expect(logActivity("school-1", "actor-1", "user.created")).resolves.toBeUndefined();
  });
});
