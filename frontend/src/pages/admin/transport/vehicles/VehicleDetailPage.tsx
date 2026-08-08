import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import { ArrowLeft, Plus } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { DataTable } from "@/components/ui/DataTable";
import { Avatar } from "@/components/ui/Avatar";
import { Spinner } from "@/components/ui/Spinner";
import * as transportService from "@/services/transport.service";
import * as trackingService from "@/services/tracking.service";
import { MaintenanceFormModal } from "../components/MaintenanceFormModal";
import { MaintenanceDueBadge } from "../components/MaintenanceDueBadge";
import { MaintenanceRecord, RouteStudentAssignment } from "@/types/transport.types";
import { TripHistoryItem } from "@/types/tracking.types";

const DIRECTION_LABEL: Record<string, string> = { both: "Morning & Evening", morning: "Morning only", evening: "Evening only" };

export function VehicleDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [isMaintenanceFormOpen, setMaintenanceFormOpen] = useState(false);

  const vehicleQuery = useQuery({ queryKey: ["transport", "vehicle", id], queryFn: () => transportService.fetchVehicle(id!), enabled: !!id });
  const maintenanceQuery = useQuery({
    queryKey: ["transport", "maintenance", id],
    queryFn: () => transportService.fetchMaintenanceRecords(id),
    enabled: !!id,
  });
  const tripsQuery = useQuery({
    queryKey: ["tracking", "trips", { vehicleId: id }],
    queryFn: () => trackingService.fetchTripHistory({ vehicleId: id, page: 1, pageSize: 10 }),
    enabled: !!id,
  });
  const studentsQuery = useQuery({
    queryKey: ["transport", "vehicle-students", id],
    queryFn: () => transportService.fetchVehicleStudents(id!),
    enabled: !!id,
  });

  if (vehicleQuery.isLoading) return <Spinner label="Loading vehicle..." />;
  const vehicle = vehicleQuery.data;
  if (!vehicle) return <Card><p className="text-sm text-slate-500 dark:text-slate-400">Vehicle not found.</p></Card>;

  return (
    <div className="animate-fade-in space-y-6">
      <Link to="/dashboard/admin/transport" className="inline-flex items-center gap-1.5 text-sm text-[var(--ink-muted)] hover:text-[var(--ink-primary)]">
        <ArrowLeft size={15} /> Back to Transport
      </Link>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900 dark:text-white">{vehicle.name || vehicle.vehicle_number}</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            {vehicle.name ? `${vehicle.vehicle_number} · ` : ""}
            {vehicle.make_model ?? "Vehicle"} · Capacity {vehicle.capacity}
          </p>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Vehicle Details</h2>
          <dl className="mt-3 space-y-1.5 text-sm">
            <div className="flex justify-between"><dt className="text-slate-500 dark:text-slate-400">Registration</dt><dd>{vehicle.registration_number ?? "—"}</dd></div>
            <div className="flex justify-between"><dt className="text-slate-500 dark:text-slate-400">GPS device</dt><dd>{vehicle.gps_device_id ?? "—"}</dd></div>
            <div className="flex justify-between"><dt className="text-slate-500 dark:text-slate-400">Fuel type</dt><dd className="capitalize">{vehicle.fuel_type ?? "—"}</dd></div>
            <div className="flex justify-between"><dt className="text-slate-500 dark:text-slate-400">Insurance expiry</dt><dd>{vehicle.insurance_expiry ?? "—"}</dd></div>
            <div className="flex justify-between"><dt className="text-slate-500 dark:text-slate-400">Status</dt><dd>{vehicle.is_active ? "Active" : "Inactive"}</dd></div>
          </dl>
        </Card>
        <Card>
          <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Assigned Driver(s)</h2>
          {vehicle.drivers ? (
            <div className="mt-3 space-y-1">
              <p className="text-lg font-medium text-slate-900 dark:text-white">{vehicle.drivers.users.full_name}</p>
              {vehicle.secondary_driver && <p className="text-sm text-slate-500 dark:text-slate-400">+ {vehicle.secondary_driver.users.full_name}</p>}
            </div>
          ) : (
            <p className="mt-3 text-sm text-slate-500 dark:text-slate-400">No driver assigned</p>
          )}
        </Card>
        <Card>
          <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Route</h2>
          {vehicle.routes ? (
            <Link to={`/dashboard/admin/transport/routes/${vehicle.routes.id}`} className="mt-3 block text-lg font-medium text-brand-600 hover:underline">
              {vehicle.routes.name}
            </Link>
          ) : (
            <p className="mt-3 text-sm text-slate-500 dark:text-slate-400">No route assigned</p>
          )}
        </Card>
      </div>

      <Card className="space-y-4">
        <h2 className="text-lg font-semibold text-slate-900 dark:text-white">Students assigned ({studentsQuery.data?.length ?? 0})</h2>
        <DataTable<RouteStudentAssignment>
          isLoading={studentsQuery.isLoading}
          rows={studentsQuery.data ?? []}
          rowKey={(r) => r.student_id}
          emptyMessage="No students are assigned to this vehicle's route yet."
          columns={[
            {
              header: "Student",
              cell: (r) => (
                <div className="flex items-center gap-2.5">
                  <Avatar src={r.students.users.avatar_url} name={r.students.users.full_name} />
                  <div>
                    <p className="font-medium text-slate-800 dark:text-slate-100">{r.students.users.full_name}</p>
                    <p className="text-xs text-slate-500 dark:text-slate-400">{r.students.admission_no}</p>
                  </div>
                </div>
              ),
            },
            { header: "Class", cell: (r) => (r.students.classes ? `${r.students.classes.name} - ${r.students.classes.section}` : "—") },
            { header: "Stop", cell: (r) => r.pickup_points?.name ?? "—" },
            { header: "When", cell: (r) => DIRECTION_LABEL[r.transport_direction] ?? "—" },
            {
              header: "Parent contact",
              cell: (r) => {
                const name = r.students.father_name ?? r.students.mother_name;
                const phone = r.students.father_phone ?? r.students.mother_phone;
                return name ? `${name}${phone ? ` · ${phone}` : ""}` : "—";
              },
            },
          ]}
        />
      </Card>

      <Card className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-slate-900 dark:text-white">Maintenance history</h2>
          <Button className="!px-3 !py-1.5 text-xs" onClick={() => setMaintenanceFormOpen(true)}>
            <Plus size={14} /> Add record
          </Button>
        </div>
        <DataTable<MaintenanceRecord>
          isLoading={maintenanceQuery.isLoading}
          rows={maintenanceQuery.data ?? []}
          rowKey={(m) => m.id}
          emptyMessage="No maintenance records yet."
          columns={[
            { header: "Type", cell: (m) => <span className="capitalize">{m.maintenance_type.replace("_", " ")}</span> },
            { header: "Performed", cell: (m) => m.performed_at },
            { header: "Cost", cell: (m) => (m.cost != null ? `₹${Number(m.cost).toFixed(2)}` : "—") },
            { header: "Odometer", cell: (m) => (m.odometer_reading != null ? m.odometer_reading : "—") },
            { header: "Next due", cell: (m) => <MaintenanceDueBadge nextDueDate={m.next_due_date} /> },
            { header: "Notes", cell: (m) => m.description ?? "—" },
          ]}
        />
      </Card>

      <Card className="space-y-4">
        <h2 className="text-lg font-semibold text-slate-900 dark:text-white">Recent trips</h2>
        <DataTable<TripHistoryItem>
          isLoading={tripsQuery.isLoading}
          rows={tripsQuery.data?.items ?? []}
          rowKey={(t) => t.id}
          emptyMessage="No completed trips yet."
          columns={[
            { header: "Date", cell: (t) => t.trip_date },
            { header: "Direction", cell: (t) => <span className="capitalize">{t.direction}</span> },
            { header: "Driver", cell: (t) => t.drivers?.users?.full_name ?? "—" },
            { header: "Duration", cell: (t) => (t.durationMinutes != null ? `${t.durationMinutes} min` : "—") },
            { header: "Distance", cell: (t) => (t.distanceKm != null ? `${t.distanceKm} km` : "—") },
            { header: "Status", cell: (t) => <span className="capitalize">{t.status}</span> },
          ]}
        />
      </Card>

      <MaintenanceFormModal isOpen={isMaintenanceFormOpen} vehicleId={id ?? null} onClose={() => setMaintenanceFormOpen(false)} onSaved={() => setMaintenanceFormOpen(false)} />
    </div>
  );
}
