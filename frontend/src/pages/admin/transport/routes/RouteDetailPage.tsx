import { useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { ArrowLeft, ArrowRight, MapPin, Search } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { Card } from "@/components/ui/Card";
import { DataTable } from "@/components/ui/DataTable";
import { Badge } from "@/components/ui/Badge";
import { Avatar } from "@/components/ui/Avatar";
import { Spinner } from "@/components/ui/Spinner";
import * as transportService from "@/services/transport.service";
import { RouteStudentAssignment } from "@/types/transport.types";

const DIRECTION_LABEL: Record<string, string> = { both: "Morning & Evening", morning: "Morning only", evening: "Evening only" };

function StopTimeline({ stops, fromLabel, toLabel, reversed }: { stops: { id: string; name: string; pickup_time: string | null }[]; fromLabel: string; toLabel: string; reversed?: boolean }) {
  const ordered = reversed ? [...stops].reverse() : stops;
  const points = [{ id: "origin", name: fromLabel }, ...ordered, { id: "destination", name: toLabel }];

  return (
    <ol className="space-y-0">
      {points.map((point, index) => (
        <li key={point.id} className="relative flex gap-3 pb-5 last:pb-0">
          {index < points.length - 1 && <span className="absolute left-[7px] top-4 h-full w-px bg-black/[0.08] dark:bg-white/[0.12]" />}
          <span
            className={`relative z-10 mt-1 h-3.5 w-3.5 shrink-0 rounded-full border-2 ${
              index === 0 || index === points.length - 1
                ? "border-accent-600 bg-white dark:bg-[#17171a]"
                : "border-accent-500/40 bg-accent-500"
            }`}
          />
          <div className="text-sm">
            <p className="font-medium text-[var(--ink-primary)]">{point.name}</p>
            {"pickup_time" in point && point.pickup_time && <p className="text-xs text-[var(--ink-muted)]">{point.pickup_time}</p>}
          </div>
        </li>
      ))}
    </ol>
  );
}

export function RouteDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [search, setSearch] = useState("");

  const routeQuery = useQuery({ queryKey: ["transport", "route", id], queryFn: () => transportService.fetchRoute(id!), enabled: !!id });
  const studentsQuery = useQuery({ queryKey: ["transport", "route-students", id], queryFn: () => transportService.fetchRouteStudents(id!), enabled: !!id });

  const filteredStudents = useMemo(() => {
    const rows = studentsQuery.data ?? [];
    const term = search.trim().toLowerCase();
    if (!term) return rows;
    return rows.filter(
      (r) => r.students.users.full_name.toLowerCase().includes(term) || r.students.admission_no.toLowerCase().includes(term)
    );
  }, [studentsQuery.data, search]);

  if (routeQuery.isLoading) return <Spinner label="Loading route..." />;
  const route = routeQuery.data;
  if (!route) return <Card><p className="text-sm text-slate-500 dark:text-slate-400">Route not found.</p></Card>;

  const schoolLabel = "School";
  const sortedStops = [...route.pickup_points].sort((a, b) => a.stop_order - b.stop_order);

  return (
    <div className="animate-fade-in space-y-6">
      <Link to="/dashboard/admin/transport?tab=routes" className="inline-flex items-center gap-1.5 text-sm text-[var(--ink-muted)] hover:text-[var(--ink-primary)]">
        <ArrowLeft size={15} /> Back to Transport
      </Link>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900 dark:text-white">{route.name}</h1>
          <p className="flex items-center gap-1.5 text-sm text-slate-500 dark:text-slate-400">
            {schoolLabel} <ArrowRight size={13} /> {route.to_location ?? "—"}
          </p>
        </div>
        <Badge variant={route.is_active ? "success" : "neutral"}>{route.is_active ? "Active" : "Inactive"}</Badge>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Vehicle</h2>
          {route.vehicle ? (
            <Link to={`/dashboard/admin/transport/vehicles/${route.vehicle.id}`} className="mt-3 block text-lg font-medium text-brand-600 hover:underline">
              {route.vehicle.name || route.vehicle.vehicle_number}
            </Link>
          ) : (
            <p className="mt-3 text-sm text-slate-500 dark:text-slate-400">Not yet assigned</p>
          )}
        </Card>
        <Card>
          <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Primary driver</h2>
          <p className="mt-3 text-lg font-medium text-slate-900 dark:text-white">{route.primary_driver?.users.full_name ?? "Not yet assigned"}</p>
        </Card>
        <Card>
          <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Secondary driver</h2>
          <p className="mt-3 text-lg font-medium text-slate-900 dark:text-white">{route.secondary_driver?.users.full_name ?? "—"}</p>
        </Card>
        <Card>
          <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Stops / Students</h2>
          <p className="mt-3 text-lg font-medium text-slate-900 dark:text-white">
            {sortedStops.length} / {studentsQuery.data?.length ?? 0}
          </p>
        </Card>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <h2 className="mb-4 flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
            <MapPin size={14} /> Morning route
          </h2>
          <StopTimeline stops={sortedStops} fromLabel={schoolLabel} toLabel={route.to_location ?? "Destination"} />
        </Card>
        <Card>
          <h2 className="mb-4 flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
            <MapPin size={14} /> Evening route <span className="text-[10px] font-normal normal-case text-[var(--ink-muted)]">(auto-reversed)</span>
          </h2>
          <StopTimeline stops={sortedStops} fromLabel={route.to_location ?? "Destination"} toLabel={schoolLabel} reversed />
        </Card>
      </div>

      <Card className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-lg font-semibold text-slate-900 dark:text-white">Assigned students</h2>
          <div className="relative max-w-sm">
            <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[var(--ink-muted)]" />
            <input
              placeholder="Search students..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full rounded-lg border border-slate-300 bg-white py-2 pl-9 pr-3 text-sm text-slate-900 outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500 dark:border-white/15 dark:bg-white/5 dark:text-white"
            />
          </div>
        </div>
        <DataTable<RouteStudentAssignment>
          isLoading={studentsQuery.isLoading}
          rows={filteredStudents}
          rowKey={(r) => r.student_id}
          emptyMessage="No students assigned to this route yet."
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
    </div>
  );
}
