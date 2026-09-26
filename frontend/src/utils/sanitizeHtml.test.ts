import { describe, it, expect } from "vitest";
import { sanitizeRichText } from "./sanitizeHtml";

/** SEC-11: content rendered via dangerouslySetInnerHTML must be inert. */
describe("sanitizeRichText (frontend render) — SEC-11", () => {
  it("neutralizes an <img onerror> payload", () => {
    const out = sanitizeRichText('<img src=x onerror="alert(document.cookie)">');
    expect(out.toLowerCase()).not.toContain("onerror");
    expect(out.toLowerCase()).not.toContain("alert");
  });

  it("removes <script> payloads", () => {
    const out = sanitizeRichText('<p>ok</p><script>fetch("//evil")</script>');
    expect(out).not.toContain("<script");
    expect(out).not.toContain("evil");
    expect(out).toContain("ok");
  });

  it("strips javascript: URLs", () => {
    expect(sanitizeRichText('<a href="javascript:alert(1)">x</a>').toLowerCase()).not.toContain("javascript:");
  });

  it("keeps legitimate formatting", () => {
    const out = sanitizeRichText("<h2>Section</h2><strong>Q1</strong><ul><li>a</li></ul>");
    expect(out).toContain("<h2>Section</h2>");
    expect(out).toContain("<strong>Q1</strong>");
    expect(out).toContain("<li>a</li>");
  });

  it("returns empty string for null/empty", () => {
    expect(sanitizeRichText(null)).toBe("");
    expect(sanitizeRichText("")).toBe("");
  });
});
