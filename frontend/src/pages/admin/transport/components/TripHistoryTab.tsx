import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Button } from "@/components/ui/Button";
import { DataTable } from "@/components/ui/DataTable";
import * as transportService from "@/services/transport.service";
import * as trackingService from "@/services/tracking.service";
import { TripHistoryItem } from "@/types/tracking.types";

const PAGE_SIZE = 20;

export function TripHistoryTab() {
  const [vehicleId, setVehicleId] = useState("");
  const [driverId, setDriverId] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [page, setPage] = useState(1);

  const { data: vehicles = [] } = useQuery({ queryKey: ["transport", "vehicles"], queryFn: transportService.fetchVehicles });
  const { data: drivers = [] } = useQuery({ queryKey: ["transport", "drivers"], queryFn: transportService.fetchDrivers });

  const { data, isLoading } = useQuery({
    queryKey: ["tracking", "trips", { vehicleId, driverId, dateFrom, dateTo, page }],
    queryFn: () =>
      trackingService.fetchTripHistory({
        vehicleId: vehicleId || undefined,
        driverId: driverId || undefined,
        dateFrom: dateFrom || undefined,
        dateTo: dateTo || undefined,
        page,
        pageSize: PAGE_SIZE,
      }),
  });

  const total = data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const rows = data?.items ?? [];

  return (
    <div className="animate-fade-in space-y-4">
      <div className="flex flex-wrap items-end gap-4">
        <Select
          label="Vehicle"
          placeholder="All vehicles"
          options={vehicles.map((v) => ({ value: v.id, label: v.vehicle_number }))}
          value={vehicleId}
          onChange={(e) => {
            setVehicleId(e.target.value);
            setPage(1);
          }}
        />
        <Select
          label="Driver"
          placeholder="All drivers"
          options={drivers.map((d) => ({ value: d.id, label: d.users.full_name }))}
          value={driverId}
          onChange={(e) => {
            setDriverId(e.target.value);
            setPage(1);
          }}
        />
        <Input
          label="From"
          type="date"
          value={dateFrom}
          onChange={(e) => {
            setDateFrom(e.target.value);
            setPage(1);
          }}
        />
        <Input
          label="To"
          type="date"
          value={dateTo}
          onChange={(e) => {
            setDateTo(e.target.value);
            setPage(1);
          }}
        />
      </div>

      <DataTable<TripHistoryItem>
        isLoading={isLoading}
        rows={rows}
        rowKey={(t) => t.id}
        emptyMessage="No trips match your filters."
        columns={[
          { header: "Date", cell: (t) => t.trip_date },
          { header: "Route", cell: (t) => (t.routes ? `${t.routes.route_code} — ${t.routes.name}` : "—") },
          { header: "Vehicle", cell: (t) => t.vehicles?.vehicle_number ?? "—" },
          { header: "Driver", cell: (t) => t.drivers?.users?.full_name ?? "—" },
          { header: "Direction", cell: (t) => <span className="capitalize">{t.direction}</span> },
          { header: "Duration", cell: (t) => (t.durationMinutes != null ? `${t.durationMinutes} min` : "—") },
          { header: "Distance", cell: (t) => (t.distanceKm != null ? `${t.distanceKm} km` : "—") },
          { header: "Status", cell: (t) => <span className="capitalize">{t.status}</span> },
        ]}
      />

      {total > 0 && (
        <div className="flex items-center justify-between text-sm text-slate-500 dark:text-slate-400">
          <p>
            Showing {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, total)} of {total}
          </p>
          <div className="flex gap-2">
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
