import "@testing-library/jest-dom/vitest";

// jsdom has no ResizeObserver — recharts' <ResponsiveContainer> needs one to
// mount at all, regardless of which chart it wraps.
if (typeof globalThis.ResizeObserver === "undefined") {
  globalThis.ResizeObserver = class ResizeObserver {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
}
