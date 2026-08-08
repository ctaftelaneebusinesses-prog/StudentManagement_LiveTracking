import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { StatCard } from "@/pages/admin/dashboard/components/StatCard";
import { ChartCard } from "@/pages/admin/dashboard/components/ChartCard";
import { EmptyState } from "@/components/ui/EmptyState";
import { ErrorState } from "@/pages/admin/dashboard/components/states/ErrorState";
import { LiveMap, RouteStop } from "@/components/tracking/LiveMap";
import { supabase } from "@/lib/supabaseClient";
import * as transportService from "@/services/transport.service";
import * as trackingService from "@/services/tracking.service";
import { LiveLocation, LiveTrip } from "@/types/tracking.types";
import { StatCardData } from "@/types/adminDashboard.types";
import { Bus } from "lucide-react";

function tripLocation(trip: LiveTrip): LiveLocation | null {
  return trip.last_latitude !== null && trip.last_longitude !== null
    ? {
        vehicleId: trip.vehicle_id,
        latitude: Number(trip.last_latitude),
        longitude: Number(trip.last_longitude),
        label: trip.vehicles?.vehicle_number ?? "Vehicle",
        updatedAt: trip.last_location_at,
      }
    : null;
}

function TripEtaBadge({ tripId }: { tripId: string }) {
  const { data: etas } = useQuery({
    queryKey: ["transport", "trip-eta", tripId],
    queryFn: () => trackingService.fetchTripEta(tripId),
    refetchInterval: 30000,
  });

  const nextStop = etas?.[0];
  if (!nextStop) return null;

  return (
    <span className="rounded-full bg-[var(--status-good)]/10 px-2 py-0.5 text-[11px] font-semibold text-[var(--status-good)]">
      ETA {nextStop.name}: {nextStop.etaMinutes} min
    </span>
  );
}

export function OverviewTab() {
  const vehiclesQuery = useQuery({ queryKey: ["transport", "vehicles"], queryFn: transportService.fetchVehicles });
  const driversQuery = useQuery({ queryKey: ["transport", "drivers"], queryFn: transportService.fetchDrivers });
  const routesQuery = useQuery({ queryKey: ["transport", "routes"], queryFn: transportService.fetchRoutes });
  const activeQuery = useQuery({
    queryKey: ["active-vehicles"],
    queryFn: trackingService.fetchActiveVehicles,
    refetchInterval: 60000,
  });

  const [liveLocations, setLiveLocations] = useState<Record<string, LiveLocation>>({});

  useEffect(() => {
    const channel = supabase
      .channel("admin-vehicle-locations")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "vehicle_locations" }, (event) => {
        const row = event.new as { vehicle_id: string; latitude: number; longitude: number; recorded_at: string };
        setLiveLocations((current) => ({
          ...current,
          [row.vehicle_id]: {
            vehicleId: row.vehicle_id,
            latitude: Number(row.latitude),
            longitude: Number(row.longitude),
            label: "School van",
            updatedAt: row.recorded_at,
          },
        }));
      })
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, []);

  const isLoading = vehiclesQuery.isLoading || driversQuery.isLoading || routesQuery.isLoading || activeQuery.isLoading;
  const isError = vehiclesQuery.isError || driversQuery.isError || routesQuery.isError || activeQuery.isError;

  if (isLoading) {
    return (
      <div className="animate-fade-in space-y-6">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-32 animate-pulse rounded-2xl border border-black/[0.06] bg-white dark:border-white/[0.08] dark:bg-[#17171a]" />
          ))}
        </div>
        <div className="h-96 animate-pulse rounded-2xl border border-black/[0.06] bg-white dark:border-white/[0.08] dark:bg-[#17171a]" />
      </div>
    );
  }

  if (isError) {
    return <ErrorState message="Failed to load the transport overview." onRetry={() => { void vehiclesQuery.refetch(); void driversQuery.refetch(); void routesQuery.refetch(); void activeQuery.refetch(); }} />;
  }

  const trips = activeQuery.data ?? [];
  const mapLocations = trips.map((trip) => liveLocations[trip.vehicle_id] ?? tripLocation(trip)).filter((v): v is LiveLocation => !!v);
  const routeStops: RouteStop[] = (routesQuery.data ?? [])
    .flatMap((route) => route.pickup_points)
    .filter((point): point is typeof point & { latitude: number; longitude: number } => point.latitude != null && point.longitude != null)
    .map((point) => ({ latitude: point.latitude, longitude: point.longitude, name: point.name }));

  const statCards: StatCardData[] = [
    {
      id: "vehicles",
      label: "Total Vehicles",
      value: vehiclesQuery.data?.length ?? 0,
      description: "In the fleet",
      trend: { direction: "flat", percent: 0, upIsGood: true },
      spark: Array.from({ length: 12 }, () => vehiclesQuery.data?.length ?? 0),
      icon: "vehicle",
    },
    {
      id: "drivers",
      label: "Total Drivers",
      value: driversQuery.data?.length ?? 0,
      description: "Active + inactive",
      trend: { direction: "flat", percent: 0, upIsGood: true },
      spark: Array.from({ length: 12 }, () => driversQuery.data?.length ?? 0),
      icon: "drivers",
    },
    {
      id: "routes",
      label: "Total Routes",
      value: routesQuery.data?.length ?? 0,
      description: "Configured routes",
      trend: { direction: "flat", percent: 0, upIsGood: true },
      spark: Array.from({ length: 12 }, () => routesQuery.data?.length ?? 0),
      icon: "classes",
    },
    {
      id: "active-trips",
      label: "Active Trips Now",
      value: trips.length,
      description: "Vehicles currently on the road",
      trend: { direction: "flat", percent: 0, upIsGood: true },
      spark: Array.from({ length: 12 }, () => trips.length),
      icon: "vehicle",
    },
  ];

  return (
    <div className="animate-fade-in space-y-6">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {statCards.map((s) => (
          <StatCard key={s.id} data={s} />
        ))}
      </div>

      <ChartCard title="Live Fleet Map" subtitle="Every vehicle currently on an active trip">
        {mapLocations.length ? <LiveMap locations={mapLocations} routeStops={routeStops} height="420px" /> : <EmptyState icon={Bus} title="No active vehicles" description="Live locations will appear here once a driver starts a trip." />}
      </ChartCard>

      <ChartCard title="Active Trips" subtitle="Live status of vehicles on the road">
        {trips.length === 0 ? (
          <EmptyState icon={Bus} title="No trips in progress" description="Start a trip from the driver dashboard to see it here." />
        ) : (
          <ul className="space-y-2">
            {trips.map((trip) => (
              <li key={trip.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-black/[0.06] p-3 text-sm dark:border-white/[0.08]">
                <div>
                  <p className="font-medium text-[var(--ink-primary)]">
                    {trip.vehicles?.vehicle_number ?? "Vehicle"} · {trip.routes?.name ?? "No route"}
                  </p>
                  <p className="text-xs text-[var(--ink-muted)]">
                    {trip.drivers?.users?.full_name ?? "Driver"} · Started {new Date(trip.started_at).toLocaleTimeString()} · Last GPS{" "}
                    {trip.last_location_at ? new Date(trip.last_location_at).toLocaleTimeString() : "pending"}
                  </p>
                </div>
                <TripEtaBadge tripId={trip.id} />
              </li>
            ))}
          </ul>
        )}
      </ChartCard>
    </div>
  );
}
