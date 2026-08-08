import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Select } from "@/components/ui/Select";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { DataTable } from "@/components/ui/DataTable";
import { ExportButtons } from "@/components/ui/ExportButtons";
import { StatCard } from "@/pages/admin/dashboard/components/StatCard";
import { EmptyState } from "@/components/ui/EmptyState";
import { ErrorState } from "@/pages/admin/dashboard/components/states/ErrorState";
import { ReportsTabSkeleton } from "./ReportsSkeleton";
import * as reportsService from "@/services/admin/reports.service";
import * as transportService from "@/services/transport.service";
import { useSchool } from "@/hooks/useSchool";
import { StatCardData } from "@/types/adminDashboard.types";

const PAGE_SIZE = 20;

function flatTrend(): StatCardData["trend"] {
  return { direction: "flat", percent: 0, upIsGood: true };
}

export function TransportReportsTab() {
  const { selectedSchool } = useSchool();
  const [vehicleFilter, setVehicleFilter] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [page, setPage] = useState(1);

  const { data: vehicles = [] } = useQuery({ queryKey: ["transport", "vehicles"], queryFn: transportService.fetchVehicles });
  const vehicleOptions = vehicles.map((v) => ({ value: v.id, label: v.vehicle_number }));

  const query = useQuery({
    queryKey: ["admin", "reports", "transport", selectedSchool.id, vehicleFilter, dateFrom, dateTo, page],
    queryFn: () =>
      reportsService.fetchTransportReport({
        vehicleId: vehicleFilter || undefined,
        dateFrom: dateFrom || undefined,
        dateTo: dateTo || undefined,
        page,
        pageSize: PAGE_SIZE,
      }),
  });

  if (query.isLoading) return <ReportsTabSkeleton stats={4} charts={0} />;
  if (query.isError) {
    return <ErrorState message={query.error instanceof Error ? query.error.message : undefined} onRetry={() => query.refetch()} />;
  }

  const data = query.data;
  if (!data) return <EmptyState title="No transport data yet" description="Fleet and trip data will show up here once recorded." />;

  const total = data.tripHistory.total;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const rows = data.tripHistory.items;

  const statCards: StatCardData[] = [
    { id: "vehicles", label: "Vehicles", value: data.vehicleCount, description: "Total fleet size", trend: flatTrend(), spark: Array.from({ length: 12 }, () => data.vehicleCount), icon: "vehicle" },
    { id: "drivers", label: "Drivers", value: data.driverCount, description: "Active drivers", trend: flatTrend(), spark: Array.from({ length: 12 }, () => data.driverCount), icon: "drivers" },
    { id: "routes", label: "Routes", value: data.routeCount, description: "Configured routes", trend: flatTrend(), spark: Array.from({ length: 12 }, () => data.routeCount), icon: "vehicle" },
    { id: "trips", label: "Completed Trips", value: total, description: "Matching current filters", trend: flatTrend(), spark: Array.from({ length: 12 }, () => total), icon: "vehicle" },
  ];

  return (
    <div className="animate-fade-in space-y-6">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {statCards.map((s) => (
          <StatCard key={s.id} data={s} />
        ))}
      </div>

      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="flex flex-wrap items-end gap-4">
          <Select
            label="Vehicle"
            placeholder="All vehicles"
            options={vehicleOptions}
            value={vehicleFilter}
            onChange={(e) => {
              setVehicleFilter(e.target.value);
              setPage(1);
            }}
          />
          <Input label="From" type="date" value={dateFrom} onChange={(e) => { setDateFrom(e.target.value); setPage(1); }} />
          <Input label="To" type="date" value={dateTo} onChange={(e) => { setDateTo(e.target.value); setPage(1); }} />
        </div>
        <ExportButtons
          title="Transport Reports — Trip History"
          filename="transport-trip-history"
          rows={rows}
          columns={[
            { header: "Date", accessor: (r) => r.trip_date },
            { header: "Vehicle", accessor: (r) => r.vehicles?.vehicle_number ?? "—" },
            { header: "Driver", accessor: (r) => r.drivers?.users?.full_name ?? "—" },
            { header: "Route", accessor: (r) => r.routes?.name ?? "—" },
            { header: "Direction", accessor: (r) => r.direction },
            { header: "Duration (min)", accessor: (r) => r.durationMinutes ?? "—" },
            { header: "Distance (km)", accessor: (r) => r.distanceKm ?? "—" },
            { header: "Status", accessor: (r) => r.status },
          ]}
        />
      </div>

      <DataTable
        rows={rows}
        rowKey={(r) => r.id}
        emptyMessage="No completed trips match your filters."
        columns={[
          { header: "Date", cell: (r) => r.trip_date },
          { header: "Vehicle", cell: (r) => r.vehicles?.vehicle_number ?? "—" },
          { header: "Driver", cell: (r) => r.drivers?.users?.full_name ?? "—" },
          { header: "Route", cell: (r) => r.routes?.name ?? "—" },
          { header: "Direction", cell: (r) => <span className="capitalize">{r.direction}</span> },
          { header: "Duration", cell: (r) => (r.durationMinutes !== null ? `${r.durationMinutes} min` : "—") },
          { header: "Distance", cell: (r) => (r.distanceKm !== null ? `${r.distanceKm} km` : "—") },
          { header: "Status", cell: (r) => <span className="capitalize">{r.status}</span> },
        ]}
      />

      {total > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-2 text-sm text-[var(--ink-muted)]">
          <p>
            Showing {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, total)} of {total}
          </p>
          <div className="flex flex-wrap gap-2">
            <Button variant="secondary" className="!px-3 !py-1 text-xs" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
              Previous
            </Button>
            <span className="self-center">
              Page {page} of {totalPages}
            </span>
            <Button variant="secondary" className="!px-3 !py-1 text-xs" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>
              Next
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
