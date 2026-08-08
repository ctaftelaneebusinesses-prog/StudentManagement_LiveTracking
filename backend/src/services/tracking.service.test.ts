import { beforeEach, describe, expect, it, vi } from "vitest";
import { chain } from "../test-support/supabaseChain";

vi.mock("../config/supabase", () => ({
  supabaseAdmin: { from: vi.fn() },
}));

vi.mock("./notification.service", () => ({
  notifyStudents: vi.fn(),
}));

import { supabaseAdmin } from "../config/supabase";
import { getTripEta, listTripHistory, recordMyLocation } from "./tracking.service";

const fromMock = (supabaseAdmin as unknown as { from: ReturnType<typeof vi.fn> }).from;

beforeEach(() => {
  fromMock.mockReset();
});

describe("getTripEta", () => {
  it("computes distance and a fallback-speed ETA to each stop with coordinates, skipping stops without them", async () => {
    const trip = { id: "trip-1", route_id: "route-1", last_latitude: 12.0, last_longitude: 77.0, last_location_at: "2026-01-01T00:00:00Z" };
    const stops = [
      { id: "stop-1", name: "Stop A", stop_order: 1, point_type: "pickup", latitude: 12.01, longitude: 77.0 },
      { id: "stop-2", name: "Stop B", stop_order: 2, point_type: "drop", latitude: null, longitude: null },
    ];

    fromMock.mockImplementation((table: string) => {
      if (table === "trips") return chain({ data: trip, error: null });
      if (table === "vehicle_locations") return chain({ data: [], error: null });
      if (table === "pickup_points") return chain({ data: stops, error: null });
      return chain({ data: null, error: null });
    });

    const result = await getTripEta("school-1", "trip-1");

    expect(result).toHaveLength(1);
    expect(result[0].pickupPointId).toBe("stop-1");
    expect(result[0].distanceKm).toBeCloseTo(1.11, 1);
    // Fewer than 2 recent location pings falls back to the assumed 25 km/h.
    expect(result[0].etaMinutes).toBe(Math.round((result[0].distanceKm / 25) * 60));
  });

  it("returns no stops when the trip has no route or no last known position yet", async () => {
    fromMock.mockImplementation(() =>
      chain({ data: { id: "trip-2", route_id: null, last_latitude: null, last_longitude: null }, error: null })
    );

    const result = await getTripEta("school-1", "trip-2");
    expect(result).toEqual([]);
  });

  it("throws not-found for a trip outside the caller's school", async () => {
    fromMock.mockImplementation(() => chain({ data: null, error: null }));
    await expect(getTripEta("school-1", "missing-trip")).rejects.toThrow("Trip not found");
  });
});

describe("recordMyLocation", () => {
  it("upserts onto student_live_locations keyed by student_id", async () => {
    const upsertBuilder = chain({ data: null, error: null });
    fromMock.mockImplementation((table: string) => (table === "student_live_locations" ? upsertBuilder : chain({ data: null, error: null })));

    const result = await recordMyLocation("school-1", "student-1", "user-1", { latitude: 12.0, longitude: 77.0, accuracy_meters: 15 });

    expect(fromMock).toHaveBeenCalledWith("student_live_locations");
    expect(upsertBuilder.upsert).toHaveBeenCalledWith(
      expect.objectContaining({ student_id: "student-1", school_id: "school-1", latitude: 12.0, longitude: 77.0, updated_by: "user-1" }),
      { onConflict: "student_id" }
    );
    expect(result.student_id).toBe("student-1");
  });
});

describe("listTripHistory", () => {
  it("computes trip duration from started/completed timestamps and distance from the trip's GPS pings", async () => {
    const trips = [
      {
        id: "trip-1",
        vehicle_id: "v1",
        driver_id: "d1",
        route_id: "r1",
        trip_date: "2026-01-01",
        direction: "pickup",
        status: "completed",
        started_at: "2026-01-01T08:00:00Z",
        completed_at: "2026-01-01T08:30:00Z",
      },
    ];
    const locations = [
      { latitude: 12.0, longitude: 77.0, recorded_at: "2026-01-01T08:00:00Z" },
      { latitude: 12.01, longitude: 77.0, recorded_at: "2026-01-01T08:10:00Z" },
    ];

    fromMock.mockImplementation((table: string) => {
      if (table === "trips") return chain({ data: trips, error: null, count: 1 });
      if (table === "vehicle_locations") return chain({ data: locations, error: null });
      return chain({ data: null, error: null });
    });

    const result = await listTripHistory("school-1", { page: 1, pageSize: 20 });

    expect(result.total).toBe(1);
    expect(result.items[0].durationMinutes).toBe(30);
    expect(result.items[0].distanceKm).toBeCloseTo(1.11, 1);
  });

  it("leaves distance null when a trip has fewer than two location pings", async () => {
    const trips = [
      {
        id: "trip-2",
        vehicle_id: "v1",
        driver_id: "d1",
        route_id: "r1",
        trip_date: "2026-01-02",
        direction: "drop",
        status: "completed",
        started_at: "2026-01-02T08:00:00Z",
        completed_at: "2026-01-02T08:05:00Z",
      },
    ];

    fromMock.mockImplementation((table: string) => {
      if (table === "trips") return chain({ data: trips, error: null, count: 1 });
      if (table === "vehicle_locations") return chain({ data: [], error: null });
      return chain({ data: null, error: null });
    });

    const result = await listTripHistory("school-1", { page: 1, pageSize: 20 });
    expect(result.items[0].distanceKm).toBeNull();
  });
});
