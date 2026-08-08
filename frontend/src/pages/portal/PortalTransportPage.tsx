import { useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Bus, MapPin, Navigation, Phone, Clock, Route as RouteIcon } from "lucide-react";
import { Badge, BadgeVariant } from "@/components/ui/Badge";
import { LiveMap } from "@/components/tracking/LiveMap";
import { usePortalStudentId } from "@/context/PortalStudentContext";
import { supabase } from "@/lib/supabaseClient";
import * as transportService from "@/services/transport.service";
import * as trackingService from "@/services/tracking.service";
import { LiveLocation, StudentTripStatusValue } from "@/types/tracking.types";
import { PortalGlassCard } from "./components/ui/PortalGlassCard";
import { PortalSkeleton } from "./components/ui/PortalSkeleton";
import { PortalEmptyState } from "./components/ui/PortalEmptyState";
import { PortalStatCard } from "./components/ui/PortalStatCard";

const STATUS_LABEL: Record<StudentTripStatusValue, string> = {
  waiting_for_pickup: "Waiting for pickup",
  vehicle_approaching: "Vehicle approaching",
  picked_up: "Picked up",
  reached_school: "Reached school",
  return_trip_started: "Return trip started",
  returning_home: "Returning home",
  dropped_at_home: "Dropped at home",
  absent: "Marked absent",
};

const STATUS_VARIANT: Record<StudentTripStatusValue, BadgeVariant> = {
  waiting_for_pickup: "neutral",
  vehicle_approaching: "info",
  picked_up: "success",
  reached_school: "success",
  return_trip_started: "info",
  returning_home: "info",
  dropped_at_home: "success",
  absent: "danger",
};

const DIRECTION_LABEL: Record<string, string> = { both: "Morning & Evening", morning: "Morning only", evening: "Evening only" };

export function PortalTransportPage() {
  const studentId = usePortalStudentId();
  const [live, setLive] = useState<LiveLocation | null>(null);
  const [viewerPosition, setViewerPosition] = useState<{ latitude: number; longitude: number; updatedAt: string } | null>(null);
  const [locationError, setLocationError] = useState("");
  const lastSentRef = useRef(0);

  const transportQuery = useQuery({
    queryKey: ["portal", "transport", studentId],
    queryFn: () => transportService.fetchStudentTransport(studentId),
    enabled: !!studentId,
  });

  const statusQuery = useQuery({
    queryKey: ["portal", "transport-status", studentId],
    queryFn: () => trackingService.fetchStudentTripStatus(studentId),
    enabled: !!studentId,
    refetchInterval: 15000,
  });

  const historyQuery = useQuery({
    queryKey: ["portal", "transport-history", studentId],
    queryFn: () => trackingService.fetchStudentTransportHistory(studentId),
    enabled: !!studentId,
  });

  const vehicle = transportQuery.data?.pickup_points?.routes?.vehicle ?? null;
  const activeTrip = vehicle?.trips.find((t) => t.status === "in_progress") ?? null;

  // Seeds the map with the trip's last known position as soon as it loads —
  // without this, a trip already in progress before this page opened showed
  // "No live location yet" until the *next* GPS ping arrived over Realtime,
  // even though the backend already had a last-known fix for it (see
  // getStudentTransport's comment in transport.service.ts).
  useEffect(() => {
    if (!vehicle || !activeTrip || activeTrip.last_latitude === null || activeTrip.last_longitude === null) return;
    setLive({
      vehicleId: vehicle.id,
      latitude: Number(activeTrip.last_latitude),
      longitude: Number(activeTrip.last_longitude),
      label: vehicle.name || vehicle.vehicle_number,
      updatedAt: activeTrip.last_location_at ?? activeTrip.started_at ?? new Date().toISOString(),
    });
    // Only re-seed when the trip identity changes (a new trip started) — once
    // live GPS pings start arriving below, they should keep winning even if
    // this effect re-runs for an unrelated reason.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTrip?.id]);

  // Realtime GPS subscription — untouched from the pre-redesign version, do not restyle away from postgres_changes.
  useEffect(() => {
    if (!vehicle) return;
    const channel = supabase
      .channel(`portal-van-${vehicle.id}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "vehicle_locations", filter: `vehicle_id=eq.${vehicle.id}` }, (event) => {
        const row = event.new as { latitude: number; longitude: number; recorded_at: string };
        setLive({ vehicleId: vehicle.id, latitude: Number(row.latitude), longitude: Number(row.longitude), label: vehicle.name || vehicle.vehicle_number, updatedAt: row.recorded_at });
      })
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [vehicle]);

  // Requests location permission as soon as the Transport page is open (not
  // gated on a trip being active yet) so distance/ETA and the 10-min/5-min/
  // arrived notifications can personalize to where the viewer actually is,
  // falling back to the student's registered stop when this isn't shared.
  useEffect(() => {
    if (!studentId) return;
    if (!navigator.geolocation) {
      setLocationError("This browser does not support location sharing.");
      return;
    }
    const watcher = navigator.geolocation.watchPosition(
      (point) => {
        const now = Date.now();
        const next = { latitude: point.coords.latitude, longitude: point.coords.longitude, updatedAt: new Date(point.timestamp).toISOString() };
        setViewerPosition(next);
        setLocationError("");
        if (now - lastSentRef.current >= 12000) {
          lastSentRef.current = now;
          void trackingService
            .sendMyLocation(studentId, { latitude: next.latitude, longitude: next.longitude, accuracy_meters: point.coords.accuracy, recorded_at: next.updatedAt })
            .catch(() => setLocationError("Your location could not be shared. Check your connection."));
        }
      },
      (error) =>
        setLocationError(
          error.code === error.PERMISSION_DENIED
            ? "Location permission is needed to show live distance/ETA from you."
            : "Unable to determine your location."
        ),
      { enableHighAccuracy: true, maximumAge: 10000, timeout: 20000 }
    );
    return () => navigator.geolocation.clearWatch(watcher);
  }, [studentId]);

  if (transportQuery.isLoading) {
    return (
      <div className="space-y-6">
        <PortalSkeleton className="h-9 w-48" />
        <PortalSkeleton className="h-24 w-full" />
        <div className="grid gap-4 sm:grid-cols-3">
          <PortalSkeleton className="h-28 w-full" />
          <PortalSkeleton className="h-28 w-full" />
          <PortalSkeleton className="h-28 w-full" />
        </div>
      </div>
    );
  }

  const assignment = transportQuery.data;
  if (!assignment) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-semibold text-[var(--ink-primary)]">My transport</h1>
          <p className="mt-1 text-sm text-[var(--ink-muted)]">Your school van, route, and driver details will appear here.</p>
        </div>
        <PortalGlassCard noHover>
          <PortalEmptyState icon={Bus} title="No transport assigned yet" description="Contact the school office if you use the school van." />
        </PortalGlassCard>
      </div>
    );
  }

  const pickupPoint = assignment.pickup_points;
  const route = pickupPoint?.routes;
  const driver = route?.primary_driver?.users;
  const status = statusQuery.data;
  const directionLabel = DIRECTION_LABEL[assignment.transport_direction];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-[var(--ink-primary)]">My transport</h1>
        <p className="mt-1 text-sm text-[var(--ink-muted)]">Live updates appear automatically while your van is on a trip.</p>
      </div>

      {status && (
        <div className="flex flex-wrap items-center gap-3 rounded-2xl border p-5" style={{ background: "var(--portal-accent-soft)", borderColor: "var(--portal-glass-border)" }}>
          <span
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-white shadow-sm"
            style={{ background: "linear-gradient(135deg, var(--portal-grad-from), var(--portal-grad-to))" }}
          >
            <Bus size={20} strokeWidth={1.75} />
          </span>
          <div>
            <Badge variant={STATUS_VARIANT[status.status]}>{STATUS_LABEL[status.status]}</Badge>
            {status.etaMinutes !== null && (
              <p className="mt-1 text-sm text-[var(--ink-secondary)]">
                Estimated arrival: ~{status.etaMinutes} min{status.distanceKm !== null ? ` · ${status.distanceKm} km away` : ""}
              </p>
            )}
          </div>
        </div>
      )}

      {locationError && (
        <p className="flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-700 dark:border-amber-900/50 dark:bg-amber-900/20 dark:text-amber-300">
          <Navigation size={14} /> {locationError}
        </p>
      )}

      {live || viewerPosition ? (
        <LiveMap
          locations={live ? [live] : []}
          viewerLocation={viewerPosition ? { latitude: viewerPosition.latitude, longitude: viewerPosition.longitude, label: "You" } : null}
        />
      ) : (
        <PortalGlassCard noHover>
          <PortalEmptyState icon={MapPin} title="No live location yet" description="The van isn't currently sharing GPS." />
        </PortalGlassCard>
      )}

      <div className="grid gap-4 sm:grid-cols-3">
        <PortalStatCard icon={RouteIcon} label="Route" value={route ? route.name : "—"} sublabel={directionLabel} />
        <PortalStatCard icon={MapPin} label="Stop" value={pickupPoint?.name ?? "—"} sublabel={pickupPoint?.pickup_time ? `Scheduled ${pickupPoint.pickup_time.slice(0, 5)}` : "Time not set"} />
        <PortalStatCard icon={Bus} label="Vehicle" value={vehicle ? vehicle.name || vehicle.vehicle_number : "Not yet assigned"} />
      </div>

      <PortalGlassCard noHover className="flex flex-wrap items-center gap-4">
        <span
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-white shadow-sm"
          style={{ background: "linear-gradient(135deg, var(--portal-grad-from), var(--portal-grad-to))" }}
        >
          <Phone size={18} strokeWidth={1.75} />
        </span>
        <div>
          <p className="text-sm font-medium text-[var(--ink-primary)]">{driver?.full_name ?? "Driver not yet assigned"}</p>
          <p className="text-xs text-[var(--ink-muted)]">{driver?.phone ?? "No phone on file"}</p>
        </div>
      </PortalGlassCard>

      <PortalGlassCard noHover>
        <h2 className="flex items-center gap-2 text-lg font-semibold text-[var(--ink-primary)]">
          <Clock size={18} strokeWidth={1.75} className="text-[var(--ink-muted)]" /> Transport history
        </h2>
        {historyQuery.data && historyQuery.data.length > 0 ? (
          <ul className="mt-3 divide-y text-sm" style={{ borderColor: "var(--portal-glass-border)" }}>
            {historyQuery.data.map((entry) => (
              <li key={entry.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
                <div>
                  <span className="font-medium text-[var(--ink-primary)]">{new Date(entry.trips.trip_date).toLocaleDateString()}</span>
                  <span className="ml-2 text-[var(--ink-muted)]">
                    {entry.trips.routes?.name} · {entry.trips.direction === "pickup" ? "Pickup" : "Drop"} · {entry.trips.vehicles?.name || entry.trips.vehicles?.vehicle_number} ·{" "}
                    {entry.trips.drivers?.users?.full_name ?? "—"}
                  </span>
                </div>
                <Badge variant={entry.status === "picked_up" ? "success" : entry.status === "absent" ? "danger" : "neutral"}>
                  {entry.status === "picked_up" ? "Picked up" : entry.status === "absent" ? "Absent" : "Pending"}
                </Badge>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-2 text-sm text-[var(--ink-muted)]">No transport history yet.</p>
        )}
      </PortalGlassCard>
    </div>
  );
}
