import { beforeEach, describe, expect, it, vi } from "vitest";
import { chain } from "../test-support/supabaseChain";

vi.mock("../config/supabase", () => ({
  supabaseAdmin: { from: vi.fn() },
}));

import { supabaseAdmin } from "../config/supabase";
import { listHistoryForClass } from "./attendance.service";

const fromMock = (supabaseAdmin as unknown as { from: ReturnType<typeof vi.fn> }).from;

beforeEach(() => {
  fromMock.mockReset();
});

describe("listHistoryForClass", () => {
  it("queries the attendance table scoped to school and class, applying an optional date range", async () => {
    const rows = [{ id: "a1", student_id: "s1", date: "2026-07-10", status: "present", remarks: null }];
    const builder = chain({ data: rows, error: null });
    fromMock.mockImplementation(() => builder);

    const result = await listHistoryForClass("school-1", "class-1", "2026-07-01", "2026-07-15");

    expect(result).toEqual(rows);
    expect(fromMock).toHaveBeenCalledWith("attendance");
    expect(builder.eq).toHaveBeenCalledWith("school_id", "school-1");
    expect(builder.eq).toHaveBeenCalledWith("class_id", "class-1");
    expect(builder.gte).toHaveBeenCalledWith("date", "2026-07-01");
    expect(builder.lte).toHaveBeenCalledWith("date", "2026-07-15");
  });

  it("omits the date-range filters when from/to are not given", async () => {
    const builder = chain({ data: [], error: null });
    fromMock.mockImplementation(() => builder);

    await listHistoryForClass("school-1", "class-1");

    expect(builder.gte).not.toHaveBeenCalled();
    expect(builder.lte).not.toHaveBeenCalled();
  });

  it("throws when the query errors", async () => {
    fromMock.mockImplementation(() => chain({ data: null, error: { message: "boom" } }));
    await expect(listHistoryForClass("school-1", "class-1")).rejects.toThrow("boom");
  });
});
