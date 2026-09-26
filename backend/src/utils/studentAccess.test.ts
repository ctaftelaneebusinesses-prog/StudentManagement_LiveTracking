import { beforeEach, describe, expect, it, vi } from "vitest";
import { chain } from "../test-support/supabaseChain";
import type { Request } from "express";

vi.mock("../config/supabase", () => ({ supabaseAdmin: { from: vi.fn() } }));

import { supabaseAdmin } from "../config/supabase";
import { assertStudentFeeAccess } from "./studentAccess";

const fromMock = (supabaseAdmin as unknown as { from: ReturnType<typeof vi.fn> }).from;

/** Every students/class_subjects lookup resolves to `studentRow` / empty. */
function mockStudent(studentRow: { school_id: string; class_id: string | null } | null) {
  fromMock.mockImplementation((table: string) => {
    if (table === "students") return chain({ data: studentRow, error: null });
    if (table === "class_subjects") return chain({ data: null, error: null });
    throw new Error(`unexpected table ${table}`);
  });
}
// Mirror what auth.middleware attaches: canTargetSchool reads accessibleSchoolIds
// + isSuperAdmin. Default a non-super caller's reach to their own school unless
// the test overrides it.
const asReq = (user: Record<string, unknown>) =>
  ({ user: { isSuperAdmin: false, accessibleSchoolIds: user.schoolId ? [user.schoolId] : [], ...user } } as unknown as Request);

beforeEach(() => {
  fromMock.mockReset();
});

/**
 * SEC-04 / SEC-06: a student must not reach another student's fee record via
 * the shared fee-access guard. After the fix the student role no longer holds
 * fees.view, so the staff shortcut no longer applies to them.
 */
describe("assertStudentFeeAccess — SEC-04 student fee-data boundary", () => {
  it("allows a student to read their OWN permitted fee summary", async () => {
    const req = asReq({ id: "stu-1", roles: ["student"], permissions: [], schoolId: "school-A" });
    await expect(assertStudentFeeAccess(req, "stu-1")).resolves.toBeUndefined();
    expect(fromMock).not.toHaveBeenCalled(); // self short-circuit, no lookup
  });

  it("denies a student reading ANOTHER student's fee record (no fees.view, not staff/teacher)", async () => {
    mockStudent({ school_id: "school-A", class_id: "class-1" });
    const req = asReq({ id: "stu-1", roles: ["student"], permissions: [], schoolId: "school-A" });
    await expect(assertStudentFeeAccess(req, "stu-2")).rejects.toMatchObject({ statusCode: 403 });
  });

  it("denies a student reaching guardian/financial info cross-school", async () => {
    mockStudent({ school_id: "school-B", class_id: "class-9" });
    const req = asReq({ id: "stu-1", roles: ["student"], permissions: [], schoolId: "school-A" });
    await expect(assertStudentFeeAccess(req, "stu-in-B")).rejects.toMatchObject({ statusCode: 403 });
  });

  it("allows an accountant (fees.view, same school) to read a student's fee record", async () => {
    mockStudent({ school_id: "school-A", class_id: "class-1" });
    const req = asReq({ id: "acct-1", roles: ["accountant"], permissions: ["fees.view"], schoolId: "school-A" });
    await expect(assertStudentFeeAccess(req, "stu-2")).resolves.toBeUndefined();
  });
});
