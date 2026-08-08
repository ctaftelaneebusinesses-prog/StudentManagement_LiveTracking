import { beforeEach, describe, expect, it, vi } from "vitest";
import { chain } from "../test-support/supabaseChain";

vi.mock("../config/supabase", () => ({
  supabaseAdmin: { from: vi.fn() },
}));

vi.mock("./notification.service", () => ({ notifyStudents: vi.fn().mockResolvedValue([]), notifyUsers: vi.fn().mockResolvedValue([]) }));
vi.mock("./push.service", () => ({ sendToUserIds: vi.fn().mockResolvedValue(undefined) }));

import { supabaseAdmin } from "../config/supabase";
import { getDashboardStats, getAnalytics, listStudentFeeDetails, deleteFeeStructure } from "./fees.service";

const fromMock = (supabaseAdmin as unknown as { from: ReturnType<typeof vi.fn> }).from;

const STUDENTS = [
  { id: "student-1", admission_no: "A001", class_id: "class-1", classes: { name: "Grade 6", section: "A" }, users: { full_name: "Asha Rao" } },
  { id: "student-2", admission_no: "A002", class_id: "class-2", classes: { name: "Grade 7", section: "B" }, users: { full_name: "Vikram Shah" } },
];

// class-1 is scoped to the current academic year; class-2's structure is
// year-agnostic (null academic_year_id) — both should count toward totals.
const FEE_STRUCTURES = [
  { id: "fs-1", class_id: "class-1", academic_year_id: "ay-1", amount: 1000 },
  { id: "fs-2", class_id: "class-2", academic_year_id: null, amount: 500 },
];

const TODAY = new Date().toISOString().slice(0, 10);

const FEE_PAYMENTS = [
  { id: "pay-1", student_id: "student-1", amount: 1000, payment_date: TODAY },
  { id: "pay-2", student_id: "student-2", amount: 200, payment_date: TODAY },
];

function mockTables() {
  fromMock.mockImplementation((table: string) => {
    switch (table) {
      case "academic_years":
        return chain({ data: { id: "ay-1" }, error: null });
      case "fee_structures":
        return chain({ data: FEE_STRUCTURES, error: null });
      case "fee_payments":
        return chain({ data: FEE_PAYMENTS, error: null });
      case "students":
        return chain({ data: STUDENTS, error: null });
      case "users":
        return chain({ data: [], error: null });
      default:
        return chain({ data: [], error: null });
    }
  });
}

beforeEach(() => {
  fromMock.mockReset();
});

describe("getDashboardStats", () => {
  it("computes totals, collections, and paid/pending headcounts", async () => {
    mockTables();

    const result = await getDashboardStats("school-1");

    expect(result.totalFees).toBe(1500);
    expect(result.collectedFees).toBe(1200);
    expect(result.pendingFees).toBe(300);
    expect(result.paidStudentsCount).toBe(1);
    expect(result.pendingStudentsCount).toBe(1);
    expect(result.todaysCollection).toBe(1200);
  });
});

describe("getAnalytics", () => {
  it("buckets students into paid/partial/unpaid for the status pie", async () => {
    mockTables();

    const result = await getAnalytics("school-1");

    expect(result.statusBreakdown).toEqual([
      { label: "Paid", value: 1 },
      { label: "Partially Paid", value: 1 },
      { label: "Unpaid", value: 0 },
    ]);
  });
});

describe("listStudentFeeDetails", () => {
  it("filters by status", async () => {
    mockTables();

    const result = await listStudentFeeDetails("school-1", { status: "partial", page: 1, pageSize: 20 });

    expect(result.total).toBe(1);
    expect(result.items).toEqual([
      expect.objectContaining({ id: "student-2", status: "partial", due: 500, paid: 200, balance: 300 }),
    ]);
  });

  it("paginates the full, unfiltered list", async () => {
    mockTables();

    const result = await listStudentFeeDetails("school-1", { page: 1, pageSize: 1 });

    expect(result.total).toBe(2);
    expect(result.items).toHaveLength(1);
  });

  it("nets discount and scholarship off the due amount", async () => {
    fromMock.mockImplementation((table: string) => {
      switch (table) {
        case "academic_years":
          return chain({ data: { id: "ay-1" }, error: null });
        case "fee_structures":
          return chain({
            data: [{ class_id: "class-1", academic_year_id: "ay-1", amount: 1000, discount_amount: 100, scholarship_amount: 50 }],
            error: null,
          });
        case "fee_payments":
          return chain({ data: [], error: null });
        case "students":
          return chain({ data: [STUDENTS[0]], error: null });
        default:
          return chain({ data: [], error: null });
      }
    });

    const result = await listStudentFeeDetails("school-1", { page: 1, pageSize: 20 });

    expect(result.items).toEqual([expect.objectContaining({ id: "student-1", due: 850, paid: 0, balance: 850 })]);
  });
});

describe("deleteFeeStructure", () => {
  it("rejects removal when payments already exist against the fee", async () => {
    fromMock.mockImplementation((table: string) => {
      if (table === "fee_payments") return chain({ data: null, error: null, count: 1 });
      return chain({ data: [], error: null });
    });

    await expect(deleteFeeStructure("school-1", "actor-1", "fee-1")).rejects.toMatchObject({ statusCode: 409 });
  });

  it("removes the fee and notifies when no payments exist", async () => {
    fromMock.mockImplementation((table: string) => {
      if (table === "fee_payments") return chain({ data: null, error: null, count: 0 });
      if (table === "fee_structures")
        return chain({ data: { id: "fee-1", class_id: "class-1", student_id: null, term: "Term 1", amount: 500 }, error: null });
      if (table === "students") return chain({ data: [], error: null });
      return chain({ data: [], error: null });
    });

    await expect(deleteFeeStructure("school-1", "actor-1", "fee-1")).resolves.toBeUndefined();
  });
});
