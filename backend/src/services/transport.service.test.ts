import { beforeEach, describe, expect, it, vi } from "vitest";
import { chain } from "../test-support/supabaseChain";

vi.mock("../config/supabase", () => ({
  supabaseAdmin: { from: vi.fn() },
}));

import { supabaseAdmin } from "../config/supabase";
import { deleteVehicle, getVehicle, searchStudentsForAssignment } from "./transport.service";

const fromMock = (supabaseAdmin as unknown as { from: ReturnType<typeof vi.fn> }).from;

beforeEach(() => {
  fromMock.mockReset();
});

describe("deleteVehicle", () => {
  it("blocks deleting a vehicle with a trip in progress", async () => {
    fromMock.mockImplementation((table: string) => {
      if (table === "trips") return chain({ data: { id: "trip-1" }, error: null });
      return chain({ data: null, error: null });
    });

    await expect(deleteVehicle("school-1", "vehicle-1")).rejects.toThrow("Cannot delete a vehicle with a trip in progress");
  });

  it("deletes the vehicle when no trip is in progress", async () => {
    const deleteBuilder = chain({ data: null, error: null });
    fromMock.mockImplementation((table: string) => {
      if (table === "trips") return chain({ data: null, error: null });
      if (table === "vehicles") return deleteBuilder;
      return chain({ data: null, error: null });
    });

    await expect(deleteVehicle("school-1", "vehicle-1")).resolves.toBeUndefined();
    expect(deleteBuilder.delete).toHaveBeenCalled();
  });
});

describe("getVehicle", () => {
  it("throws not-found when the vehicle doesn't belong to the school", async () => {
    fromMock.mockImplementation(() => chain({ data: null, error: null }));
    await expect(getVehicle("school-1", "missing-vehicle")).rejects.toThrow("Vehicle not found");
  });
});

describe("searchStudentsForAssignment", () => {
  it("resolves matching users first, then ORs their ids into the students query", async () => {
    const usersBuilder = chain({ data: [{ id: "user-1" }], error: null });
    const studentsBuilder = chain({ data: [{ id: "user-1", admission_no: "A001" }], error: null });
    fromMock.mockImplementation((table: string) => (table === "users" ? usersBuilder : studentsBuilder));

    const result = await searchStudentsForAssignment("school-1", "Asha");

    expect(result).toEqual([{ id: "user-1", admission_no: "A001" }]);
    expect(studentsBuilder.or).toHaveBeenCalledWith(expect.stringContaining("id.in.(user-1)"));
  });
});
