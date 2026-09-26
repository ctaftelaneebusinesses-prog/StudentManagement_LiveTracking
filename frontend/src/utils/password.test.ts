import { describe, it, expect } from "vitest";
import { generateDefaultPassword } from "./password";

/** SEC-13: the "Generate" button must produce an unpredictable password. */
describe("generateDefaultPassword (frontend) — SEC-13", () => {
  it("is not derivable from name + id (old first5+id scheme)", () => {
    const pw = generateDefaultPassword("Ctaft Elanee", "11");
    expect(pw).not.toBe("Ctaft11");
    expect(pw).not.toContain("Ctaft");
    expect(pw).not.toContain("11");
  });

  it("differs on every call", () => {
    const set = new Set(Array.from({ length: 20 }, () => generateDefaultPassword("Same Name", "1")));
    expect(set.size).toBe(20);
  });

  it("is strong: length >= 12 with all character classes", () => {
    const pw = generateDefaultPassword("A", "1");
    expect(pw.length).toBeGreaterThanOrEqual(12);
    expect(pw).toMatch(/[a-z]/);
    expect(pw).toMatch(/[A-Z]/);
    expect(pw).toMatch(/[0-9]/);
    expect(pw).toMatch(/[^A-Za-z0-9]/);
  });
});
