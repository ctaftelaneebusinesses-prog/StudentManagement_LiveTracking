import { useState } from "react";
import { Link } from "react-router-dom";
import { Plus } from "lucide-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { DataTable } from "@/components/ui/DataTable";
import { Badge } from "@/components/ui/Badge";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import * as transportService from "@/services/transport.service";
import { RouteFormModal } from "./RouteFormModal";
import { StopsManagerModal } from "./StopsManagerModal";
import { AssignStudentsModal } from "./AssignStudentsModal";
import { PickupPoint, Route } from "@/types/transport.types";

interface StopRow extends PickupPoint {
  key: string;
  routeName: string;
}

/** Every stop across every route, flattened for an at-a-glance view — no per-route "Manage Stops" clicking needed to see what's already been added. */
function AllStopsSection({ routes }: { routes: Route[] }) {
  const rows: StopRow[] = routes.flatMap((r) => r.pickup_points.map((p) => ({ ...p, key: `${r.id}-${p.id}`, routeName: r.name })));
  const sorted = [...rows].sort((a, b) => a.routeName.localeCompare(b.routeName) || a.stop_order - b.stop_order);

  return (
    <Card>
      <h3 className="mb-3 text-sm font-semibold text-slate-700 dark:text-slate-300">All stops ({sorted.length})</h3>
      <DataTable<StopRow>
        rows={sorted}
        rowKey={(s) => s.key}
        emptyMessage="No stops added yet — use 'Manage Stops' on a route below to add one."
        columns={[
          { header: "Route", cell: (s) => s.routeName },
          { header: "Stop", cell: (s) => `${s.stop_order}. ${s.name}` },
          { header: "Address", cell: (s) => s.address ?? "—" },
          { header: "Time", cell: (s) => s.pickup_time ?? "—" },
        ]}
      />
    </Card>
  );
}

export function RoutesTab() {
  const queryClient = useQueryClient();
  const { data: routes = [], isLoading } = useQuery({ queryKey: ["transport", "routes"], queryFn: transportService.fetchRoutes });

  const [isFormOpen, setFormOpen] = useState(false);
  const [editingRoute, setEditingRoute] = useState<Route | null>(null);
  const [deletingRoute, setDeletingRoute] = useState<Route | null>(null);
  const [managingStopsForId, setManagingStopsForId] = useState<string | null>(null);
  const [assigningStudentsForId, setAssigningStudentsForId] = useState<string | null>(null);

  // Look these up live from the routes list (rather than storing the clicked
  // row object) so edits made inside the modals — which invalidate and
  // refetch this same query — are reflected immediately without reopening.
  const managingStopsFor = routes.find((r) => r.id === managingStopsForId) ?? null;
  const assigningStudentsFor = routes.find((r) => r.id === assigningStudentsForId) ?? null;

  const deleteMutation = useMutation({
    mutationFn: transportService.deleteRoute,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["transport"] });
      setDeletingRoute(null);
    },
  });

  function openCreate() {
    setEditingRoute(null);
    setFormOpen(true);
  }

  return (
    <div className="animate-fade-in space-y-4">
      <div className="flex justify-end">
        <Button onClick={openCreate}>
          <Plus size={16} strokeWidth={2} />
          Add Route
        </Button>
      </div>

      <DataTable<Route>
        isLoading={isLoading}
        rows={routes}
        rowKey={(r) => r.id}
        emptyMessage="No routes yet. Add your first one to get started."
        columns={[
          {
            header: "Route",
            cell: (r) => (
              <Link to={`/dashboard/admin/transport/routes/${r.id}`} className="font-medium text-brand-600 hover:underline">
                {r.name}
              </Link>
            ),
          },
          { header: "Morning → Evening", cell: (r) => (r.to_location ? `School → ${r.to_location} → School` : "—") },
          { header: "Vehicle", cell: (r) => r.vehicle?.name || r.vehicle?.vehicle_number || <span className="text-[var(--ink-muted)]">Unassigned</span> },
          {
            header: "Driver(s)",
            cell: (r) => (
              <span>
                {r.primary_driver?.users.full_name ?? <span className="text-[var(--ink-muted)]">Unassigned</span>}
                {r.secondary_driver && <span className="text-[var(--ink-muted)]"> + {r.secondary_driver.users.full_name}</span>}
              </span>
            ),
          },
          { header: "Stops", cell: (r) => r.pickup_points.length },
          {
            header: "Status",
            cell: (r) => <Badge variant={r.is_active ? "success" : "neutral"}>{r.is_active ? "Active" : "Inactive"}</Badge>,
          },
          {
            header: "",
            cell: (r) => (
              <div className="flex flex-wrap gap-1.5">
                <Button variant="ghost" className="!px-2 !py-1 text-xs" onClick={() => setManagingStopsForId(r.id)}>
                  Manage Stops
                </Button>
                <Button variant="ghost" className="!px-2 !py-1 text-xs" onClick={() => setAssigningStudentsForId(r.id)}>
                  Assign Students
                </Button>
                <Button
                  variant="ghost"
                  className="!px-2 !py-1 text-xs"
                  onClick={() => {
                    setEditingRoute(r);
                    setFormOpen(true);
                  }}
                >
                  Edit
                </Button>
                <Button variant="ghost" className="!px-2 !py-1 text-xs text-red-600" onClick={() => setDeletingRoute(r)}>
                  Delete
                </Button>
              </div>
            ),
          },
        ]}
      />

      <AllStopsSection routes={routes} />

      <RouteFormModal isOpen={isFormOpen} route={editingRoute} onClose={() => setFormOpen(false)} onSaved={() => setFormOpen(false)} />
      <StopsManagerModal isOpen={!!managingStopsForId} route={managingStopsFor} onClose={() => setManagingStopsForId(null)} />
      <AssignStudentsModal isOpen={!!assigningStudentsForId} route={assigningStudentsFor} onClose={() => setAssigningStudentsForId(null)} />

      <ConfirmDialog
        isOpen={!!deletingRoute}
        title="Delete route"
        message={`Are you sure you want to delete "${deletingRoute?.name}"? Its vehicle and drivers will become unassigned.`}
        confirmLabel="Delete"
        isLoading={deleteMutation.isPending}
        onConfirm={() => deletingRoute && deleteMutation.mutate(deletingRoute.id)}
        onCancel={() => setDeletingRoute(null)}
      />
    </div>
  );
}
