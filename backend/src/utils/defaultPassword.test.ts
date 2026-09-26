import { describe, it, expect } from "vitest";
import { generateDefaultPassword } from "./defaultPassword";

/** SEC-13: generated initial passwords must not be predictable from user data. */
describe("generateDefaultPassword — SEC-13", () => {
  it("is NOT derivable from the name + id (the old Pwtes<phone> scheme)", () => {
    const pw = generateDefaultPassword("Pwtest User", "9000000031");
    expect(pw).not.toBe("Pwtes9000000031");
    expect(pw).not.toContain("9000000031");
    expect(pw.toLowerCase()).not.toContain("pwtest");
  });

  it("produces a different value on every call (random, not deterministic)", () => {
    const a = generateDefaultPassword("Same Name", "111");
    const b = generateDefaultPassword("Same Name", "111");
    expect(a).not.toBe(b);
  });

  it("is long and contains mixed character classes (satisfies strength policies)", () => {
    const pw = generateDefaultPassword("A", "1");
    expect(pw.length).toBeGreaterThanOrEqual(16);
    expect(pw).toMatch(/[a-z]/);
    expect(pw).toMatch(/[A-Z]/);
    expect(pw).toMatch(/[0-9]/);
    expect(pw).toMatch(/[^A-Za-z0-9]/);
  });
});
