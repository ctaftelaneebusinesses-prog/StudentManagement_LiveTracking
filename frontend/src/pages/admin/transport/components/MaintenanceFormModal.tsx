import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Modal } from "@/components/ui/Modal";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Button } from "@/components/ui/Button";
import { getApiErrorMessage } from "@/lib/axios";
import * as transportService from "@/services/transport.service";

interface MaintenanceFormValues {
  maintenance_type: string;
  description: string;
  cost: string;
  performed_at: string;
  odometer_reading: string;
  next_due_date: string;
  next_due_odometer: string;
  performed_by: string;
}

const TYPE_OPTIONS = [
  { value: "service", label: "Service" },
  { value: "repair", label: "Repair" },
  { value: "inspection", label: "Inspection" },
  { value: "tire_change", label: "Tire change" },
  { value: "insurance_renewal", label: "Insurance renewal" },
  { value: "other", label: "Other" },
];

export function MaintenanceFormModal({ isOpen, vehicleId, onClose, onSaved }: { isOpen: boolean; vehicleId: string | null; onClose: () => void; onSaved: () => void }) {
  const queryClient = useQueryClient();
  const [selectedVehicleId, setSelectedVehicleId] = useState(vehicleId ?? "");

  // vehicleId is only pre-supplied when opened from a vehicle's own detail
  // page; from the fleet-wide Maintenance tab it's null and the admin picks
  // the vehicle here instead.
  const { data: vehicles = [] } = useQuery({
    queryKey: ["transport", "vehicles"],
    queryFn: transportService.fetchVehicles,
    enabled: !vehicleId,
  });

  useEffect(() => {
    if (isOpen) setSelectedVehicleId(vehicleId ?? "");
  }, [isOpen, vehicleId]);

  const { register, handleSubmit, reset } = useForm<MaintenanceFormValues>({
    defaultValues: {
      maintenance_type: "service",
      description: "",
      cost: "",
      performed_at: "",
      odometer_reading: "",
      next_due_date: "",
      next_due_odometer: "",
      performed_by: "",
    },
  });

  const mutation = useMutation({
    mutationFn: (values: MaintenanceFormValues) =>
      transportService.createMaintenanceRecord(selectedVehicleId, {
        maintenance_type: values.maintenance_type,
        description: values.description || undefined,
        cost: values.cost ? Number(values.cost) : undefined,
        performed_at: values.performed_at || undefined,
        odometer_reading: values.odometer_reading ? Number(values.odometer_reading) : undefined,
        next_due_date: values.next_due_date || undefined,
        next_due_odometer: values.next_due_odometer ? Number(values.next_due_odometer) : undefined,
        performed_by: values.performed_by || undefined,
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["transport", "maintenance"] });
      reset();
      onSaved();
    },
  });

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Add Maintenance Record" size="xl">
      <form className="grid gap-4 sm:grid-cols-2" onSubmit={handleSubmit((values) => mutation.mutate(values))}>
        {!vehicleId && (
          <Select
            label="Vehicle"
            placeholder="Select a vehicle"
            options={vehicles.map((v) => ({ value: v.id, label: v.vehicle_number }))}
            value={selectedVehicleId}
            onChange={(e) => setSelectedVehicleId(e.target.value)}
          />
        )}
        <Select label="Type" options={TYPE_OPTIONS} {...register("maintenance_type")} />
        <Input label="Performed by (vendor/mechanic)" {...register("performed_by")} />
        <Input label="Date performed" type="date" {...register("performed_at")} />
        <Input label="Cost" type="number" step="0.01" {...register("cost")} />
        <Input label="Odometer reading" type="number" step="0.1" {...register("odometer_reading")} />
        <Input label="Next due date" type="date" {...register("next_due_date")} />
        <Input label="Next due odometer" type="number" step="0.1" {...register("next_due_odometer")} />
        <div className="sm:col-span-2">
          <Input label="Description" {...register("description")} />
        </div>

        {mutation.isError && (
          <p className="sm:col-span-2 text-sm text-red-600">{getApiErrorMessage(mutation.error, "Failed to save maintenance record.")}</p>
        )}

        <Button type="submit" className="sm:col-span-2" isLoading={mutation.isPending} disabled={!selectedVehicleId}>
          Add record
        </Button>
      </form>
    </Modal>
  );
}
