import { ReactNode, useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Bus, MapPin } from "lucide-react";
import { Input } from "@/components/ui/Input";
import { Badge } from "@/components/ui/Badge";
import { EmptyState } from "@/components/ui/EmptyState";
import { Skeleton } from "@/components/ui/Skeleton";
import { ChartCard } from "@/pages/admin/dashboard/components/ChartCard";
import { LiveMap, RouteStop } from "@/components/tracking/LiveMap";
import { supabase } from "@/lib/supabaseClient";
import * as trackingService from "@/services/tracking.service";
import * as transportService from "@/services/transport.service";
import { LiveLocation, LiveTrip } from "@/types/tracking.types";

function tripLocation(trip: LiveTrip): LiveLocation | null {
  return trip.last_latitude !== null && trip.last_longitude !== null
    ? {
        vehicleId: trip.vehicle_id,
        latitude: Number(trip.last_latitude),
        longitude: Number(trip.last_longitude),
        label: trip.vehicles?.name || trip.vehicles?.vehicle_number || "Vehicle",
        updatedAt: trip.last_location_at,
      }
    : null;
}

/**
 * Live Vehicle Monitoring — used by admin/principal (as a Transport tab) and
 * by teacher (its own route). The grid always lists every route in the
 * fleet (scoped server-side by fetchRoutes/fetchActiveVehicles: staff see
 * everything, a teacher only routes carrying their own students) — a route
 * without a trip in progress right now still shows up, just without a live
 * pin, so admin/principal can pick any route and see whether its van is
 * currently out.
 */
export function TransportMonitoringPage() {
  const [search, setSearch] = useState("");
  const [selectedRouteId, setSelectedRouteId] = useState<string | null>(null);
  const [liveLocations, setLiveLocations] = useState<Record<string, LiveLocation>>({});

  const routesQuery = useQuery({ queryKey: ["transport", "routes"], queryFn: transportService.fetchRoutes });
  const activeQuery = useQuery({ queryKey: ["active-vehicles"], queryFn: trackingService.fetchActiveVehicles, refetchInterval: 20000 });

  useEffect(() => {
    const channel = supabase
      .channel("transport-monitoring-locations")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "vehicle_locations" }, (event) => {
        const row = event.new as { vehicle_id: string; latitude: number; longitude: number; recorded_at: string };
        setLiveLocations((current) => ({
          ...current,
          [row.vehicle_id]: { vehicleId: row.vehicle_id, latitude: Number(row.latitude), longitude: Number(row.longitude), label: "School van", updatedAt: row.recorded_at },
        }));
      })
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, []);

  const routes = routesQuery.data ?? [];

  const activeTripByRouteId = useMemo(() => {
    const map = new Map<string, LiveTrip>();
    for (const trip of activeQuery.data ?? []) {
      if (trip.route_id) map.set(trip.route_id, trip);
    }
    return map;
  }, [activeQuery.data]);

  const filteredRoutes = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return routes;
    return routes.filter((route) => route.name.toLowerCase().includes(term) || (route.route_code ?? "").toLowerCase().includes(term));
  }, [routes, search]);

  const selectedRoute = filteredRoutes.find((route) => route.id === selectedRouteId) ?? filteredRoutes[0] ?? null;
  const selectedTrip = selectedRoute ? activeTripByRouteId.get(selectedRoute.id) ?? null : null;
  const mapLocation = selectedTrip ? liveLocations[selectedTrip.vehicle_id] ?? tripLocation(selectedTrip) : null;
  const routeStops: RouteStop[] = (selectedRoute?.pickup_points ?? [])
    .filter((point): point is typeof point & { latitude: number; longitude: number } => point.latitude != null && point.longitude != null)
    .map((point) => ({ latitude: point.latitude, longitude: point.longitude, name: point.name }));

  if (routesQuery.isLoading) return <Skeleton className="h-96 w-full" />;

  return (
    <div className="animate-fade-in space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-[var(--ink-primary)]">Transport Monitoring</h1>
          <p className="mt-1 text-sm text-[var(--ink-muted)]">Every route in the fleet — select one to see where its van is right now.</p>
        </div>
        <Input label="Filter by route" placeholder="e.g. Kuppam" value={search} onChange={(e) => setSearch(e.target.value)} className="!w-64" />
      </div>

      <ChartCard title="Routes" subtitle={`${filteredRoutes.length} route${filteredRoutes.length === 1 ? "" : "s"}`}>
        {filteredRoutes.length === 0 ? (
          <p className="text-sm text-[var(--ink-muted)]">No routes match this filter.</p>
        ) : (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {filteredRoutes.map((route) => {
              const trip = activeTripByRouteId.get(route.id);
              const isSelected = selectedRoute?.id === route.id;
              return (
                <button
                  key={route.id}
                  type="button"
                  onClick={() => setSelectedRouteId(route.id)}
                  className={`rounded-xl border p-3 text-left text-sm transition-colors ${
                    isSelected ? "border-accent-500 bg-accent-500/5" : "border-black/[0.06] hover:bg-black/[0.03] dark:border-white/[0.08] dark:hover:bg-white/[0.04]"
                  }`}
                >
                  <div className="flex items-center gap-2">
                    {trip ? (
                      <span className="relative flex h-2 w-2 shrink-0">
                        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[var(--status-good)] opacity-75" />
                        <span className="relative inline-flex h-2 w-2 rounded-full bg-[var(--status-good)]" />
                      </span>
                    ) : (
                      <span className="h-2 w-2 shrink-0 rounded-full bg-slate-300 dark:bg-white/20" />
                    )}
                    <p className="truncate font-medium text-[var(--ink-primary)]">{route.name}</p>
                  </div>
                  <p className="mt-1 truncate text-xs text-[var(--ink-muted)]">
                    {route.vehicle ? route.vehicle.name || route.vehicle.vehicle_number : "No vehicle assigned"}
                  </p>
                  <Badge variant={trip ? "success" : "neutral"} className="mt-2">
                    {trip ? "Live" : "Not on a trip"}
                  </Badge>
                </button>
              );
            })}
          </div>
        )}
      </ChartCard>

      <ChartCard title="Live location" subtitle={selectedRoute?.name}>
        {mapLocation ? (
          <LiveMap locations={[mapLocation]} routeStops={routeStops} height="360px" />
        ) : (
          <EmptyState
            icon={MapPin}
            title={selectedRoute ? "Not currently on a trip" : "Select a route"}
            description={selectedRoute ? "This route's van isn't sharing GPS right now." : "Choose a route above to see its van's live location."}
          />
        )}
      </ChartCard>

      <ChartCard title="Trip details">
        {selectedRoute ? (
          <div className="space-y-4">
            <div>
              <h3 className="text-lg font-semibold text-[var(--ink-primary)]">
                {selectedRoute.vehicle?.name || selectedRoute.vehicle?.vehicle_number || "No vehicle assigned"}
              </h3>
              <p className="text-sm text-[var(--ink-muted)]">
                {selectedRoute.name} · Driver: {selectedRoute.primary_driver?.users.full_name ?? "—"}
              </p>
            </div>
            {selectedTrip ? (
              <>
                <dl className="grid grid-cols-2 gap-4 text-sm sm:grid-cols-4">
                  <Field label="Trip status" value={<Badge variant="info">{selectedTrip.direction === "pickup" ? "Morning" : "Evening"} · Running</Badge>} />
                  <Field label="Picked up" value={<span className="font-semibold text-[var(--status-good)]">{selectedTrip.studentCounts?.picked_up ?? 0}</span>} />
                  <Field label="Absent" value={<span className="font-semibold text-[var(--status-serious)]">{selectedTrip.studentCounts?.absent ?? 0}</span>} />
                  <Field label="Remaining" value={<span className="font-semibold text-[var(--ink-primary)]">{selectedTrip.studentCounts?.pending ?? 0}</span>} />
                </dl>
                <p className="text-xs text-[var(--ink-muted)]">
                  Started {new Date(selectedTrip.started_at).toLocaleTimeString()} · Last GPS{" "}
                  {selectedTrip.last_location_at ? new Date(selectedTrip.last_location_at).toLocaleTimeString() : "pending"}
                </p>
              </>
            ) : (
              <p className="text-sm text-[var(--ink-muted)]">No trip is currently in progress on this route.</p>
            )}
          </div>
        ) : (
          <EmptyState icon={Bus} title="Select a route" description="Choose a route above to see its trip details." />
        )}
      </ChartCard>
    </div>
  );
}

function Field({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div>
      <dt className="text-xs text-slate-500">{label}</dt>
      <dd className="mt-1">{value}</dd>
    </div>
  );
}
