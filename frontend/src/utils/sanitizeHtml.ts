import DOMPurify from "dompurify";

/**
 * SEC-11: sanitize stored rich-text (exam / question-paper content) before it
 * is passed to dangerouslySetInnerHTML. The backend also sanitizes on write,
 * but stored content is treated as untrusted at render time too (existing rows
 * predate the server fix, and defense in depth). DOMPurify is allowlist-based
 * and strips <script>, event handlers, javascript: URLs and SVG/MathML
 * execution vectors, rendering malicious payloads inert.
 */
export function sanitizeRichText(html: string | null | undefined): string {
  if (!html) return "";
  return DOMPurify.sanitize(html, { USE_PROFILES: { html: true } });
}
