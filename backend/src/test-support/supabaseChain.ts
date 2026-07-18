import { vi } from "vitest";

const CHAIN_METHODS = [
  "select",
  "eq",
  "neq",
  "order",
  "limit",
  "in",
  "gte",
  "lte",
  "or",
  "upsert",
  "insert",
  "update",
  "delete",
] as const;

export interface FakeResult<T = unknown> {
  data: T;
  error: unknown;
}

/**
 * A chainable Supabase query-builder stub for unit tests. Every chain method
 * (select/eq/order/...) returns itself; it also resolves like a promise
 * (via `.then`) so `await supabaseAdmin.from(...).select(...).eq(...)`
 * works even when the code never calls `.single()`/`.maybeSingle()`.
 */
export function chain<T = unknown>(result: FakeResult<T>) {
  const builder: Record<string, unknown> = {};
  for (const method of CHAIN_METHODS) {
    builder[method] = vi.fn(() => builder);
  }
  builder.maybeSingle = vi.fn(() => Promise.resolve(result));
  builder.single = vi.fn(() => Promise.resolve(result));
  builder.then = (onFulfilled: (value: FakeResult<T>) => unknown, onRejected?: (reason: unknown) => unknown) =>
    Promise.resolve(result).then(onFulfilled, onRejected);
  return builder;
}
