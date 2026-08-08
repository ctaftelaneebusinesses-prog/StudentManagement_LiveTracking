/**
 * PostgREST's `.or()` takes a raw filter-DSL string (commas separate
 * conditions, parens nest) — a search term containing `,` or `)` would
 * otherwise let a user forge extra filter clauses. Wrapping the value in
 * double quotes (PostgREST's own escaping mechanism) neutralizes that.
 */
export function escapeOrFilterValue(value: string): string {
  return `"${value.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`;
}
