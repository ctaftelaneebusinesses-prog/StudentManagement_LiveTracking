import sanitizeHtml from "sanitize-html";

/**
 * SEC-11: allowlist-based sanitizer for stored rich-text (exam / question-paper
 * content) that the frontend renders via dangerouslySetInnerHTML. Stored
 * content is untrusted (any marks.manage holder can write it directly through
 * the API, bypassing the editor), so it is sanitized on write here and again
 * on render in the client (defense in depth).
 *
 * Keeps the formatting a question paper needs (headings, lists, tables, basic
 * marks, links) and drops everything that can execute: <script>, event
 * handlers (onerror/onload/...), javascript: URLs, <iframe>/<object>/<embed>,
 * <svg>/<math>, style attributes, and any tag/attribute not on the allowlist.
 */
const OPTIONS: sanitizeHtml.IOptions = {
  allowedTags: [
    "p", "br", "hr", "span", "div",
    "h1", "h2", "h3", "h4", "h5", "h6",
    "strong", "b", "em", "i", "u", "s", "sub", "sup", "mark",
    "ul", "ol", "li", "blockquote", "code", "pre",
    "table", "thead", "tbody", "tfoot", "tr", "td", "th", "caption",
    "a",
  ],
  allowedAttributes: {
    a: ["href", "title", "target", "rel"],
    td: ["colspan", "rowspan"],
    th: ["colspan", "rowspan", "scope"],
    "*": ["align"],
  },
  // Only safe link schemes; javascript:/data: are dropped.
  allowedSchemes: ["http", "https", "mailto"],
  allowProtocolRelative: false,
  // Drop the contents of these entirely rather than just unwrapping the tag.
  nonTextTags: ["style", "script", "textarea", "noscript", "iframe", "object", "embed"],
  disallowedTagsMode: "discard",
};

/** Returns sanitized HTML, or the input unchanged when it is null/undefined. */
export function sanitizeRichText<T extends string | null | undefined>(html: T): T {
  if (html === null || html === undefined) return html;
  return sanitizeHtml(html, OPTIONS) as T;
}
