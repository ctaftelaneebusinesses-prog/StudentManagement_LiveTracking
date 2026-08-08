import { Link, useParams } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { Card } from "@/components/ui/Card";
import { DataTable } from "@/components/ui/DataTable";
import { Avatar } from "@/components/ui/Avatar";
import { Spinner } from "@/components/ui/Spinner";
import * as transportService from "@/services/transport.service";
import * as trackingService from "@/services/tracking.service";
import { RouteStudentAssignment } from "@/types/transport.types";
import { TripHistoryItem } from "@/types/tracking.types";

const DIRECTION_LABEL: Record<string, string> = { both: "Morning & Evening", morning: "Morning only", evening: "Evening only" };

export function DriverDetailPage() {
  const { id } = useParams<{ id: string }>();

  const driverQuery = useQuery({ queryKey: ["transport", "driver", id], queryFn: () => transportService.fetchDriver(id!), enabled: !!id });
  const tripsQuery = useQuery({
    queryKey: ["tracking", "trips", { driverId: id }],
    queryFn: () => trackingService.fetchTripHistory({ driverId: id, page: 1, pageSize: 10 }),
    enabled: !!id,
  });
  const studentsQuery = useQuery({
    queryKey: ["transport", "driver-students", id],
    queryFn: () => transportService.fetchDriverStudents(id!),
    enabled: !!id,
  });

  if (driverQuery.isLoading) return <Spinner label="Loading driver..." />;
  const driver = driverQuery.data;
  if (!driver) return <Card><p className="text-sm text-slate-500 dark:text-slate-400">Driver not found.</p></Card>;

  return (
    <div className="animate-fade-in space-y-6">
      <Link to="/dashboard/admin/transport" className="inline-flex items-center gap-1.5 text-sm text-[var(--ink-muted)] hover:text-[var(--ink-primary)]">
        <ArrowLeft size={15} /> Back to Transport
      </Link>

      <div className="flex items-center gap-4">
        <Avatar src={driver.users.avatar_url} name={driver.users.full_name} size="md" className="h-16 w-16 text-xl" />
        <div>
          <h1 className="text-2xl font-semibold text-slate-900 dark:text-white">{driver.users.full_name}</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">{driver.users.email}</p>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Driver Details</h2>
          <dl className="mt-3 space-y-1.5 text-sm">
            <div className="flex justify-between"><dt className="text-slate-500 dark:text-slate-400">Phone</dt><dd>{driver.users.phone ?? "—"}</dd></div>
            <div className="flex justify-between"><dt className="text-slate-500 dark:text-slate-400">License No.</dt><dd>{driver.license_number}</dd></div>
            <div className="flex justify-between"><dt className="text-slate-500 dark:text-slate-400">License expiry</dt><dd>{driver.license_expiry ?? "—"}</dd></div>
            <div className="flex justify-between"><dt className="text-slate-500 dark:text-slate-400">Address</dt><dd>{driver.address ?? "—"}</dd></div>
            <div className="flex justify-between"><dt className="text-slate-500 dark:text-slate-400">Emergency contact</dt><dd>{driver.emergency_contact_phone ?? "—"}</dd></div>
            <div className="flex justify-between"><dt className="text-slate-500 dark:text-slate-400">Status</dt><dd>{driver.users.is_active ? "Active" : "Deactivated"}</dd></div>
          </dl>
        </Card>
        <Card>
          <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Assigned Route</h2>
          {driver.route ? (
            <Link to={`/dashboard/admin/transport/routes/${driver.route.id}`} className="mt-3 block text-lg font-medium text-brand-600 hover:underline">
              {driver.route.name}
            </Link>
          ) : (
            <p className="mt-3 text-sm text-slate-500 dark:text-slate-400">No route currently assigned</p>
          )}
        </Card>
        <Card className="md:col-span-2">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Assigned Vehicle</h2>
          {driver.vehicle ? (
            <>
              <p className="mt-3 text-lg font-medium text-slate-900 dark:text-white">{driver.vehicle.vehicle_number}</p>
              <p className="text-sm text-slate-500 dark:text-slate-400">{driver.vehicle.make_model ?? "Vehicle"}</p>
            </>
          ) : (
            <p className="mt-3 text-sm text-slate-500 dark:text-slate-400">No vehicle currently assigned</p>
          )}
        </Card>
      </div>

      <Card className="space-y-4">
        <h2 className="text-lg font-semibold text-slate-900 dark:text-white">Assigned students ({studentsQuery.data?.length ?? 0})</h2>
        <DataTable<RouteStudentAssignment>
          isLoading={studentsQuery.isLoading}
          rows={studentsQuery.data ?? []}
          rowKey={(r) => r.student_id}
          emptyMessage="No students are assigned to this driver's route yet."
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
            { header: "Pickup stop", cell: (r) => r.pickup_points?.name ?? "—" },
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
        <h2 className="text-lg font-semibold text-slate-900 dark:text-white">Recent trips</h2>
        <DataTable<TripHistoryItem>
          isLoading={tripsQuery.isLoading}
          rows={tripsQuery.data?.items ?? []}
          rowKey={(t) => t.id}
          emptyMessage="No completed trips yet."
          columns={[
            { header: "Date", cell: (t) => t.trip_date },
            { header: "Vehicle", cell: (t) => t.vehicles?.vehicle_number ?? "—" },
            { header: "Direction", cell: (t) => <span className="capitalize">{t.direction}</span> },
            { header: "Duration", cell: (t) => (t.durationMinutes != null ? `${t.durationMinutes} min` : "—") },
            { header: "Distance", cell: (t) => (t.distanceKm != null ? `${t.distanceKm} km` : "—") },
            { header: "Status", cell: (t) => <span className="capitalize">{t.status}</span> },
          ]}
        />
      </Card>
    </div>
  );
}
