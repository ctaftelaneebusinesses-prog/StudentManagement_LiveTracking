import { describe, expect, it } from "vitest";
import { getMinLeaveDate, assertNotPastLeaveDate, LEAVE_CUTOFF_HOUR } from "./leaveDate";
import { ApiError } from "./ApiError";

function at(hour: number, minute = 0): Date {
  return new Date(2026, 5, 15, hour, minute); // June 15, 2026 — arbitrary fixed weekday
}

describe("getMinLeaveDate", () => {
  it("returns today when called before the 6 PM cutoff", () => {
    expect(getMinLeaveDate(at(LEAVE_CUTOFF_HOUR - 1))).toBe("2026-06-15");
  });

  it("returns tomorrow once the 6 PM cutoff has passed", () => {
    expect(getMinLeaveDate(at(LEAVE_CUTOFF_HOUR, 15))).toBe("2026-06-16");
  });

  it("treats exactly 6:00 PM as past the cutoff", () => {
    expect(getMinLeaveDate(at(LEAVE_CUTOFF_HOUR, 0))).toBe("2026-06-16");
  });
});

describe("assertNotPastLeaveDate", () => {
  const now = at(10); // well before the cutoff

  it("allows today", () => {
    expect(() => assertNotPastLeaveDate("2026-06-15", now)).not.toThrow();
  });

  it("allows a future date", () => {
    expect(() => assertNotPastLeaveDate("2026-07-01", now)).not.toThrow();
  });

  it("rejects yesterday with a past-date message", () => {
    expect(() => assertNotPastLeaveDate("2026-06-14", now)).toThrow(/past date/);
  });

  it("rejects today once the 6 PM cutoff has passed, with a cutoff-specific message", () => {
    const afterCutoff = at(LEAVE_CUTOFF_HOUR, 30);
    expect(() => assertNotPastLeaveDate("2026-06-15", afterCutoff)).toThrow(/past 6:00 PM/);
  });

  it("still allows tomorrow after the cutoff", () => {
    const afterCutoff = at(LEAVE_CUTOFF_HOUR, 30);
    expect(() => assertNotPastLeaveDate("2026-06-16", afterCutoff)).not.toThrow();
  });

  it("throws an ApiError with a 400 status", () => {
    try {
      assertNotPastLeaveDate("2020-01-01", now);
      throw new Error("expected assertNotPastLeaveDate to throw");
    } catch (err) {
      expect(err).toBeInstanceOf(ApiError);
      expect((err as ApiError).statusCode).toBe(400);
    }
  });
});
