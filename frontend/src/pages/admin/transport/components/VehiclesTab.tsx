import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Plus, Search } from "lucide-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/Button";
import { DataTable } from "@/components/ui/DataTable";
import { Badge } from "@/components/ui/Badge";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { getApiErrorMessage } from "@/lib/axios";
import * as transportService from "@/services/transport.service";
import { VehicleFormModal } from "./VehicleFormModal";
import { Vehicle } from "@/types/transport.types";

const STATUS_OPTIONS = [
  { value: "", label: "All statuses" },
  { value: "active", label: "Active" },
  { value: "inactive", label: "Inactive" },
];

export function VehiclesTab() {
  const queryClient = useQueryClient();
  const { data: vehicles = [], isLoading } = useQuery({ queryKey: ["transport", "vehicles"], queryFn: transportService.fetchVehicles });

  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [isFormOpen, setFormOpen] = useState(false);
  const [editingVehicle, setEditingVehicle] = useState<Vehicle | null>(null);
  const [deletingVehicle, setDeletingVehicle] = useState<Vehicle | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const deleteMutation = useMutation({
    mutationFn: transportService.deleteVehicle,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["transport"] });
      setDeletingVehicle(null);
      setDeleteError(null);
    },
    onError: (err) => setDeleteError(getApiErrorMessage(err, "Failed to delete vehicle.")),
  });

  function openCreate() {
    setEditingVehicle(null);
    setFormOpen(true);
  }

  const filteredVehicles = useMemo(() => {
    const term = search.trim().toLowerCase();
    return vehicles.filter((v) => {
      const matchesSearch =
        !term ||
        v.vehicle_number.toLowerCase().includes(term) ||
        (v.name ?? "").toLowerCase().includes(term) ||
        (v.make_model ?? "").toLowerCase().includes(term);
      const matchesStatus = !status || (status === "active" ? v.is_active : !v.is_active);
      return matchesSearch && matchesStatus;
    });
  }, [vehicles, search, status]);

  return (
    <div className="animate-fade-in space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative max-w-sm flex-1">
            <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[var(--ink-muted)]" />
            <input
              placeholder="Search vehicles..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full rounded-lg border border-slate-300 bg-white py-2 pl-9 pr-3 text-sm text-slate-900 outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500 dark:border-white/15 dark:bg-white/5 dark:text-white"
            />
          </div>
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500 dark:border-white/15 dark:bg-white/5 dark:text-white"
          >
            {STATUS_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>
        <Button onClick={openCreate}>
          <Plus size={16} strokeWidth={2} />
          Add Vehicle
        </Button>
      </div>

      <DataTable<Vehicle>
        isLoading={isLoading}
        rows={filteredVehicles}
        rowKey={(v) => v.id}
        emptyMessage={vehicles.length === 0 ? "No vehicles yet. Add your first one to get started." : "No vehicles match your search."}
        columns={[
          {
            header: "Vehicle",
            cell: (v) => (
              <Link to={`/dashboard/admin/transport/vehicles/${v.id}`} className="font-medium text-brand-600 hover:underline">
                {v.name ? `${v.name} (${v.vehicle_number})` : v.vehicle_number}
              </Link>
            ),
          },
          { header: "Make/Model", cell: (v) => v.make_model ?? "—" },
          { header: "Capacity", cell: (v) => v.capacity },
          {
            header: "Driver(s)",
            cell: (v) =>
              v.drivers ? (
                <span>
                  {v.drivers.users.full_name}
                  {v.secondary_driver && <span className="text-[var(--ink-muted)]"> + {v.secondary_driver.users.full_name}</span>}
                </span>
              ) : (
                <span className="text-[var(--ink-muted)]">Unassigned</span>
              ),
          },
          {
            header: "Route",
            cell: (v) =>
              v.routes ? (
                <Link to={`/dashboard/admin/transport/routes/${v.routes.id}`} className="text-brand-600 hover:underline">
                  {v.routes.name}
                </Link>
              ) : (
                <span className="text-[var(--ink-muted)]">Unassigned</span>
              ),
          },
          {
            header: "Status",
            cell: (v) => <Badge variant={v.is_active ? "success" : "neutral"}>{v.is_active ? "Active" : "Inactive"}</Badge>,
          },
          {
            header: "",
            cell: (v) => (
              <div className="flex flex-wrap gap-1.5">
                <Button
                  variant="ghost"
                  className="!px-2 !py-1 text-xs"
                  onClick={() => {
                    setEditingVehicle(v);
                    setFormOpen(true);
                  }}
                >
                  Edit
                </Button>
                <Button
                  variant="ghost"
                  className="!px-2 !py-1 text-xs text-red-600"
                  onClick={() => {
                    setDeletingVehicle(v);
                    setDeleteError(null);
                  }}
                >
                  Delete
                </Button>
              </div>
            ),
          },
        ]}
      />

      <VehicleFormModal isOpen={isFormOpen} vehicle={editingVehicle} onClose={() => setFormOpen(false)} onSaved={() => setFormOpen(false)} />

      <ConfirmDialog
        isOpen={!!deletingVehicle}
        title="Delete vehicle"
        message={deleteError ?? `Are you sure you want to delete "${deletingVehicle?.vehicle_number}"? This cannot be undone.`}
        confirmLabel="Delete"
        isLoading={deleteMutation.isPending}
        onConfirm={() => deletingVehicle && deleteMutation.mutate(deletingVehicle.id)}
        onCancel={() => setDeletingVehicle(null)}
      />
    </div>
  );
}
