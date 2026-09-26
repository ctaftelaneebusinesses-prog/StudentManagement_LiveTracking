import { beforeEach, describe, expect, it, vi } from "vitest";
import { chain } from "../test-support/supabaseChain";

vi.mock("../config/supabase", () => ({ supabaseAdmin: { from: vi.fn() } }));

import { supabaseAdmin } from "../config/supabase";
import { assertUserInSchool } from "./scopeGuards";

const fromMock = (supabaseAdmin as unknown as { from: ReturnType<typeof vi.fn> }).from;

beforeEach(() => {
  fromMock.mockReset();
});

/**
 * SEC-03: the tenant guard used by the role-management endpoints
 * (assignRole / revokeRole / listUserRoles in user.controller.ts). It must
 * reject a target user who is not in the caller's school, and pass one who is.
 */
describe("assertUserInSchool — SEC-03 cross-school role management boundary", () => {
  it("throws 404 when the target user is not in the caller's school (cross-school assign/revoke/list denied)", async () => {
    // school-scoped lookup returns no row -> target not in this school
    fromMock.mockReturnValue({ select: vi.fn(() => chain({ data: null, error: null })) });
    await expect(assertUserInSchool("school-A", "user-in-school-B")).rejects.toMatchObject({ statusCode: 404 });
  });

  it("resolves when the target user belongs to the caller's school (same-school management allowed)", async () => {
    fromMock.mockReturnValue({ select: vi.fn(() => chain({ data: { id: "user-1" }, error: null })) });
    await expect(assertUserInSchool("school-A", "user-1")).resolves.toBeUndefined();
  });
});
