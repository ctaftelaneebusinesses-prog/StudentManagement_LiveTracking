import { describe, it, expect } from "vitest";
import { sanitizeRichText } from "./sanitizeHtml";

/** SEC-11: stored exam/question-paper HTML must be stripped of execution vectors. */
describe("sanitizeRichText — SEC-11", () => {
  it("removes <script> and its contents", () => {
    const out = sanitizeRichText('<p>Q1</p><script>fetch("//evil")</script>');
    expect(out).not.toContain("<script");
    expect(out).not.toContain("evil");
    expect(out).toContain("<p>Q1</p>");
  });

  it("strips event-handler attributes (onerror/onload/onclick)", () => {
    const out = sanitizeRichText('<img src=x onerror="alert(document.cookie)">');
    expect(out.toLowerCase()).not.toContain("onerror");
    expect(out.toLowerCase()).not.toContain("alert");
  });

  it("strips javascript: URLs from links", () => {
    const out = sanitizeRichText('<a href="javascript:alert(1)">x</a>');
    expect(out.toLowerCase()).not.toContain("javascript:");
  });

  it("removes iframe/object/svg execution vectors", () => {
    expect(sanitizeRichText('<iframe src="//evil"></iframe>')).not.toContain("<iframe");
    expect(sanitizeRichText('<svg><script>alert(1)</script></svg>')).not.toContain("<script");
  });

  it("preserves legitimate exam formatting", () => {
    const html = "<h2>Section A</h2><p><strong>Q1.</strong> Solve <em>x</em></p><ul><li>a</li><li>b</li></ul>";
    const out = sanitizeRichText(html);
    expect(out).toContain("<h2>Section A</h2>");
    expect(out).toContain("<strong>Q1.</strong>");
    expect(out).toContain("<li>a</li>");
  });

  it("passes null/undefined through unchanged", () => {
    expect(sanitizeRichText(null)).toBeNull();
    expect(sanitizeRichText(undefined)).toBeUndefined();
  });
});
