import { useCallback, useEffect, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Spinner } from "@/components/ui/Spinner";
import { Badge } from "@/components/ui/Badge";
import { LiveMap } from "@/components/tracking/LiveMap";
import * as transport from "@/services/transport.service";
import * as tracking from "@/services/tracking.service";
import { LiveTrip, PickupStatus } from "@/types/tracking.types";
import { useWakeLock } from "@/hooks/useWakeLock";

type LocationPayload = Parameters<typeof tracking.sendLocation>[1];
/** Bound the retry queue so a long offline stretch can't grow it unboundedly — oldest points are dropped first since only the trail, not each point, matters once the driver is back within range. */
const MAX_QUEUED_POINTS = 100;

/** Present/Absent on the morning leg, Dropped/Not Dropped on the evening leg — same underlying picked_up/absent status values, direction-aware labels only. */
function statusLabels(direction: string | undefined): Record<PickupStatus, string> {
  return direction === "drop"
    ? { pending: "Pending", picked_up: "Dropped", absent: "Not dropped" }
    : { pending: "Pending", picked_up: "Boarded", absent: "Absent" };
}

export function DriverDashboardPage() {
  const cache = useQueryClient();
  const dashboard = useQuery({ queryKey: ["driver-transport"], queryFn: transport.fetchDriverDashboard });
  const [activeTrip, setActiveTrip] = useState<LiveTrip | null>(null);
  const [position, setPosition] = useState<{ latitude: number; longitude: number; updatedAt: string } | null>(null);
  const [gpsError, setGpsError] = useState("");
  const lastSent = useRef(0);
  const lastPoint = useRef<LocationPayload | null>(null);
  const pendingQueue = useRef<LocationPayload[]>([]);
  const flushingQueue = useRef(false);

  // Recover the in-progress trip from today's trip list on page load/refresh
  // — local state alone would otherwise "forget" an active trip and block
  // present/absent marking until the driver hits Start again.
  const todaysActiveTrip = (dashboard.data?.trips ?? []).find((t) => t.status === "in_progress") ?? null;
  const trip = activeTrip ?? (todaysActiveTrip as unknown as LiveTrip | null);

  const start = useMutation({
    mutationFn: (direction: "pickup" | "drop") => tracking.startTrip(direction),
    onSuccess: (newTrip) => {
      setActiveTrip(newTrip);
      setGpsError("");
      void cache.invalidateQueries({ queryKey: ["driver-transport"] });
    },
  });
  const end = useMutation({
    mutationFn: () => tracking.endTrip(trip!.id),
    onSuccess: () => {
      setActiveTrip(null);
      void cache.invalidateQueries({ queryKey: ["driver-transport"] });
    },
  });

  const statusQuery = useQuery({
    queryKey: ["trip-student-status", trip?.id],
    queryFn: () => tracking.fetchTripStudentStatus(trip!.id),
    enabled: !!trip,
  });

  const markMutation = useMutation({
    mutationFn: ({ studentId, status }: { studentId: string; status: Extract<PickupStatus, "picked_up" | "absent"> }) =>
      tracking.markStudentStatus(trip!.id, studentId, status),
    onSuccess: () => void cache.invalidateQueries({ queryKey: ["trip-student-status", trip?.id] }),
  });

  // Keeps the screen from sleeping while a trip is active — a locked/dimmed
  // screen is the single biggest real-world reason tracking silently stops
  // without the driver ever touching "End trip".
  useWakeLock(!!trip);

  // Best-effort nudge against the driver closing the tab mid-trip. Browsers
  // ignore any custom message and show their own generic prompt, and this
  // cannot stop an actual force-quit — but it catches the common accidental
  // "swipe the tab away" case.
  useEffect(() => {
    if (!trip) return;
    const handler = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [trip]);

  const flushQueue = useCallback(async () => {
    if (!trip || flushingQueue.current || pendingQueue.current.length === 0) return;
    flushingQueue.current = true;
    try {
      while (pendingQueue.current.length) {
        await tracking.sendLocation(trip.id, pendingQueue.current[0]);
        pendingQueue.current.shift();
      }
      setGpsError("");
    } catch {
      // Connection is still down — leave the remaining points queued and try again on the next tick/reconnect.
    } finally {
      flushingQueue.current = false;
    }
  }, [trip]);

  // A watcher established while backgrounded/offline keeps firing once the
  // browser is foregrounded again — flushing periodically and on `online`
  // means a dropped connection delays delivery instead of losing points.
  useEffect(() => {
    if (!trip) return;
    const onOnline = () => void flushQueue();
    const interval = setInterval(onOnline, 5000);
    window.addEventListener("online", onOnline);
    return () => {
      clearInterval(interval);
      window.removeEventListener("online", onOnline);
    };
  }, [trip, flushQueue]);

  useEffect(() => {
    if (!trip) return;
    if (!navigator.geolocation) {
      setGpsError("This browser does not support location sharing.");
      return;
    }

    const send = (payload: LocationPayload) => {
      lastSent.current = Date.now();
      void tracking.sendLocation(trip.id, payload).catch(() => {
        pendingQueue.current.push(payload);
        if (pendingQueue.current.length > MAX_QUEUED_POINTS) pendingQueue.current.shift();
        setGpsError("Connection lost — location updates are queued and will send automatically once it's back.");
      });
    };

    const onPosition = (point: GeolocationPosition) => {
      const next = { latitude: point.coords.latitude, longitude: point.coords.longitude, updatedAt: new Date(point.timestamp).toISOString() };
      setPosition(next);
      const payload: LocationPayload = {
        latitude: next.latitude,
        longitude: next.longitude,
        accuracy_meters: point.coords.accuracy,
        speed_mps: point.coords.speed ?? undefined,
        heading: point.coords.heading ?? undefined,
        recorded_at: next.updatedAt,
      };
      lastPoint.current = payload;
      if (Date.now() - lastSent.current >= 10000 || point.coords.accuracy <= 25) send(payload);
    };

    const onError = (error: GeolocationPositionError) =>
      setGpsError(error.code === error.PERMISSION_DENIED ? "Location permission is required while a trip is active." : "Unable to determine your location.");

    const geoOptions: PositionOptions = { enableHighAccuracy: true, maximumAge: 5000, timeout: 20000 };
    let watcher = navigator.geolocation.watchPosition(onPosition, onError, geoOptions);

    // Guarantees a fresh point reaches the backend on a fixed cadence even if
    // `watchPosition` stops delivering callbacks mid-trip — a documented
    // real-world failure mode on some mobile browsers (screen dim, OS power
    // saving, backgrounded tab) where GPS updates silently stall until the
    // page is reloaded. Without this, the student's map only ever advanced
    // when the driver manually refreshed.
    const heartbeat = setInterval(() => {
      if (lastPoint.current && Date.now() - lastSent.current >= 10000) {
        send({ ...lastPoint.current, recorded_at: new Date().toISOString() });
      }
    }, 10000);

    // Second line of defense against the same stalling behavior: periodically
    // tear down and recreate the watcher, since some browsers resume firing
    // callbacks on a fresh `watchPosition` call even after the old one has
    // gone silent.
    const rearm = setInterval(() => {
      navigator.geolocation.clearWatch(watcher);
      watcher = navigator.geolocation.watchPosition(onPosition, onError, geoOptions);
    }, 60000);

    return () => {
      navigator.geolocation.clearWatch(watcher);
      clearInterval(heartbeat);
      clearInterval(rearm);
    };
  }, [trip]);

  if (dashboard.isLoading) return <Spinner label="Loading transport assignment..." />;
  if (!dashboard.data?.vehicle)
    return (
      <Card>
        <h1 className="text-xl font-semibold">Driver dashboard</h1>
        <p className="mt-2 text-sm text-slate-500">No active vehicle is assigned to you.</p>
      </Card>
    );
  const { vehicle, pickup_points, students } = dashboard.data;
  const statusByStudent = new Map((statusQuery.data ?? []).map((s) => [s.student_id, s]));

  const pickedUpCount = (statusQuery.data ?? []).filter((s) => s.status === "picked_up").length;
  const absentCount = (statusQuery.data ?? []).filter((s) => s.status === "absent").length;
  const pendingStopIds = new Set(
    students.filter((entry) => (statusByStudent.get(entry.students.id)?.status ?? "pending") === "pending").map((entry) => entry.pickup_point_id)
  );
  const remainingStops = [...pickup_points].filter((p) => pendingStopIds.has(p.id)).sort((a, b) => a.stop_order - b.stop_order);
  const nextStop = remainingStops[0] ?? null;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="border-l-4 border-slate-400 pl-4">
          <h1 className="text-2xl font-semibold">Driver dashboard</h1>
          <p className="text-sm text-slate-500">Use a secure HTTPS mobile browser and keep this page open during the trip.</p>
        </div>
        {trip ? (
          <div className="flex items-center gap-3">
            <Badge variant={trip.direction === "drop" ? "info" : "success"}>
              {trip.direction === "drop" ? "Evening · Drop" : "Morning · Pickup"} trip in progress
            </Badge>
            <Button variant="danger" onClick={() => end.mutate()} isLoading={end.isPending}>
              End trip
            </Button>
          </div>
        ) : (
          <div className="flex flex-wrap gap-2">
            <Button
              onClick={() => start.mutate("pickup")}
              isLoading={start.isPending && start.variables === "pickup"}
              disabled={start.isPending}
            >
              Morning · Pick up from home, drop at school
            </Button>
            <Button
              variant="secondary"
              onClick={() => start.mutate("drop")}
              isLoading={start.isPending && start.variables === "drop"}
              disabled={start.isPending}
            >
              Evening · Pick up from school, drop at home
            </Button>
          </div>
        )}
      </div>

      {trip && (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5">
          <Card className="!p-3">
            <p className="text-xs text-slate-500">Next stop</p>
            <p className="mt-1 truncate text-sm font-semibold">{nextStop?.name ?? "—"}</p>
          </Card>
          <Card className="!p-3">
            <p className="text-xs text-slate-500">Remaining stops</p>
            <p className="mt-1 text-xl font-bold">{remainingStops.length}</p>
          </Card>
          <Card className="!p-3">
            <p className="text-xs text-slate-500">Total students</p>
            <p className="mt-1 text-xl font-bold">{students.length}</p>
          </Card>
          <Card className="!p-3">
            <p className="text-xs text-slate-500">Picked up</p>
            <p className="mt-1 text-xl font-bold text-[var(--status-good)]">{pickedUpCount}</p>
          </Card>
          <Card className="!p-3">
            <p className="text-xs text-slate-500">Absent</p>
            <p className="mt-1 text-xl font-bold text-red-600">{absentCount}</p>
          </Card>
        </div>
      )}

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <h2 className="text-lg font-semibold">Assigned vehicle</h2>
          <p className="mt-2 text-xl font-bold">{vehicle.name || vehicle.vehicle_number}</p>
          <p className="text-sm text-slate-500">{vehicle.make_model ?? "Vehicle"} · Capacity {vehicle.capacity}</p>
        </Card>
        <Card>
          <h2 className="text-lg font-semibold">Route</h2>
          <p className="mt-2 font-medium">{vehicle.routes?.name ?? "No route assigned"}</p>
          <p className="text-sm text-slate-500">{vehicle.routes?.route_code}</p>
        </Card>
      </div>

      {trip && (
        <Card>
          <h2 className="text-lg font-semibold">Live location</h2>
          <p className="mt-1 text-sm text-slate-500">GPS is shared every 10 seconds while the trip is active.</p>
          {gpsError && <p className="mt-2 text-sm text-red-600">{gpsError}</p>}
          <div className="mt-3">
            {position ? (
              <LiveMap locations={[{ vehicleId: vehicle.id, latitude: position.latitude, longitude: position.longitude, label: vehicle.vehicle_number, updatedAt: position.updatedAt }]} height="300px" />
            ) : (
              <p className="text-sm text-slate-500">Waiting for GPS permission and first location…</p>
            )}
          </div>
        </Card>
      )}

      <Card>
        <h2 className="text-lg font-semibold">Student {trip?.direction === "drop" ? "drop-off" : "pickup"} list</h2>
        {students.length ? (
          <ul className="mt-3 space-y-2">
            {students.map((entry) => {
              const status = statusByStudent.get(entry.students.id)?.status ?? "pending";
              const isMarking = markMutation.isPending && markMutation.variables?.studentId === entry.students.id;
              const labels = statusLabels(trip?.direction);
              return (
                <li key={entry.students.id} className="flex flex-wrap items-center justify-between gap-2 rounded border p-3 text-sm">
                  <div>
                    <span className="font-medium">{entry.students.users.full_name}</span>
                    <span className="ml-2 text-slate-500">{pickup_points.find((point) => point.id === entry.pickup_point_id)?.name ?? "Pickup point"}</span>
                  </div>
                  {trip ? (
                    <div className="flex items-center gap-2">
                      <Badge variant={status === "picked_up" ? "success" : status === "absent" ? "danger" : "neutral"}>{labels[status]}</Badge>
                      <Button
                        className="!px-2.5 !py-1 text-xs"
                        variant="secondary"
                        isLoading={isMarking && markMutation.variables?.status === "picked_up"}
                        onClick={() => markMutation.mutate({ studentId: entry.students.id, status: "picked_up" })}
                      >
                        {trip.direction === "drop" ? "Dropped" : "Present"}
                      </Button>
                      <Button
                        className="!px-2.5 !py-1 text-xs"
                        variant="ghost"
                        isLoading={isMarking && markMutation.variables?.status === "absent"}
                        onClick={() => markMutation.mutate({ studentId: entry.students.id, status: "absent" })}
                      >
                        {trip.direction === "drop" ? "Not Dropped" : "Absent"}
                      </Button>
                    </div>
                  ) : (
                    <span className="text-xs text-slate-400">Start the trip to mark pickup status</span>
                  )}
                </li>
              );
            })}
          </ul>
        ) : (
          <p className="mt-2 text-sm text-slate-500">No students assigned.</p>
        )}
      </Card>
    </div>
  );
}
