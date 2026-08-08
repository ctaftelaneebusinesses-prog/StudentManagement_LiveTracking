import { useState } from "react";
import { Plus } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { Select } from "@/components/ui/Select";
import { Button } from "@/components/ui/Button";
import { DataTable } from "@/components/ui/DataTable";
import * as transportService from "@/services/transport.service";
import { MaintenanceFormModal } from "./MaintenanceFormModal";
import { MaintenanceDueBadge } from "./MaintenanceDueBadge";
import { MaintenanceRecord } from "@/types/transport.types";

export function MaintenanceTab() {
  const [vehicleFilter, setVehicleFilter] = useState("");
  const [isFormOpen, setFormOpen] = useState(false);

  const { data: vehicles = [] } = useQuery({ queryKey: ["transport", "vehicles"], queryFn: transportService.fetchVehicles });
  const { data: records = [], isLoading } = useQuery({
    queryKey: ["transport", "maintenance", vehicleFilter || "all"],
    queryFn: () => transportService.fetchMaintenanceRecords(vehicleFilter || undefined),
  });

  return (
    <div className="animate-fade-in space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <Select
          label="Vehicle"
          placeholder="All vehicles"
          options={vehicles.map((v) => ({ value: v.id, label: v.vehicle_number }))}
          value={vehicleFilter}
          onChange={(e) => setVehicleFilter(e.target.value)}
        />
        <Button onClick={() => setFormOpen(true)} disabled={vehicles.length === 0}>
          <Plus size={16} strokeWidth={2} />
          Add Record
        </Button>
      </div>

      <DataTable<MaintenanceRecord>
        isLoading={isLoading}
        rows={records}
        rowKey={(m) => m.id}
        emptyMessage="No maintenance records yet."
        columns={[
          { header: "Vehicle", cell: (m) => m.vehicles?.vehicle_number ?? "—" },
          { header: "Type", cell: (m) => <span className="capitalize">{m.maintenance_type.replace("_", " ")}</span> },
          { header: "Performed", cell: (m) => m.performed_at },
          { header: "Cost", cell: (m) => (m.cost != null ? `₹${Number(m.cost).toFixed(2)}` : "—") },
          { header: "Next due", cell: (m) => <MaintenanceDueBadge nextDueDate={m.next_due_date} /> },
          { header: "Notes", cell: (m) => m.description ?? "—" },
        ]}
      />

      <MaintenanceFormModal isOpen={isFormOpen} vehicleId={null} onClose={() => setFormOpen(false)} onSaved={() => setFormOpen(false)} />
    </div>
  );
}
