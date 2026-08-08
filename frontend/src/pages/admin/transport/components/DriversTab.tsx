import { useState } from "react";
import { Link } from "react-router-dom";
import { Plus } from "lucide-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/Button";
import { DataTable } from "@/components/ui/DataTable";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import * as transportService from "@/services/transport.service";
import { DriverFormModal } from "./DriverFormModal";
import { Driver } from "@/types/transport.types";

export function DriversTab() {
  const queryClient = useQueryClient();
  const { data: drivers = [], isLoading } = useQuery({ queryKey: ["transport", "drivers"], queryFn: transportService.fetchDrivers });

  const [isFormOpen, setFormOpen] = useState(false);
  const [editingDriver, setEditingDriver] = useState<Driver | null>(null);
  const [deactivatingDriver, setDeactivatingDriver] = useState<Driver | null>(null);

  const deactivateMutation = useMutation({
    mutationFn: transportService.deactivateDriver,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["transport"] });
      setDeactivatingDriver(null);
    },
  });

  function openCreate() {
    setEditingDriver(null);
    setFormOpen(true);
  }

  return (
    <div className="animate-fade-in space-y-4">
      <div className="flex justify-end">
        <Button onClick={openCreate}>
          <Plus size={16} strokeWidth={2} />
          Add Driver
        </Button>
      </div>

      <DataTable<Driver>
        isLoading={isLoading}
        rows={drivers}
        rowKey={(d) => d.id}
        emptyMessage="No drivers yet. Add your first one to get started."
        columns={[
          {
            header: "Name",
            cell: (d) => (
              <Link to={`/dashboard/admin/transport/drivers/${d.id}`} className="font-medium text-brand-600 hover:underline">
                {d.users.full_name}
              </Link>
            ),
          },
          { header: "Email", cell: (d) => d.users.email },
          { header: "Phone", cell: (d) => d.users.phone ?? "—" },
          { header: "License", cell: (d) => d.license_number },
          { header: "License expiry", cell: (d) => d.license_expiry ?? "—" },
          {
            header: "Status",
            cell: (d) =>
              d.users.is_active ? (
                <span className="text-[var(--status-good)]">Active</span>
              ) : (
                <span className="text-[var(--ink-muted)]">Deactivated</span>
              ),
          },
          {
            header: "",
            cell: (d) => (
              <div className="flex gap-2">
                <Button
                  variant="ghost"
                  className="!px-2 !py-1 text-xs"
                  onClick={() => {
                    setEditingDriver(d);
                    setFormOpen(true);
                  }}
                >
                  Edit
                </Button>
                {d.users.is_active && (
                  <Button variant="ghost" className="!px-2 !py-1 text-xs text-red-600" onClick={() => setDeactivatingDriver(d)}>
                    Deactivate
                  </Button>
                )}
              </div>
            ),
          },
        ]}
      />

      <DriverFormModal isOpen={isFormOpen} driver={editingDriver} onClose={() => setFormOpen(false)} onSaved={() => setFormOpen(false)} />

      <ConfirmDialog
        isOpen={!!deactivatingDriver}
        title="Deactivate driver"
        message={`Are you sure you want to deactivate ${deactivatingDriver?.users.full_name}? They will no longer be able to sign in or start trips.`}
        confirmLabel="Deactivate"
        isLoading={deactivateMutation.isPending}
        onConfirm={() => deactivatingDriver && deactivateMutation.mutate(deactivatingDriver.id)}
        onCancel={() => setDeactivatingDriver(null)}
      />
    </div>
  );
}
