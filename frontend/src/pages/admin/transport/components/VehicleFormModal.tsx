import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Modal } from "@/components/ui/Modal";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Button } from "@/components/ui/Button";
import { getApiErrorMessage } from "@/lib/axios";
import * as transportService from "@/services/transport.service";
import { Vehicle } from "@/types/transport.types";

interface VehicleFormValues {
  vehicle_number: string;
  name: string;
  capacity: number;
  make_model: string;
  gps_device_id: string;
  registration_number: string;
  insurance_expiry: string;
  fuel_type: string;
}

interface VehicleFormModalProps {
  isOpen: boolean;
  vehicle: Vehicle | null;
  onClose: () => void;
  onSaved: () => void;
}

const FUEL_OPTIONS = [
  { value: "petrol", label: "Petrol" },
  { value: "diesel", label: "Diesel" },
  { value: "cng", label: "CNG" },
  { value: "electric", label: "Electric" },
  { value: "other", label: "Other" },
];

export function VehicleFormModal({ isOpen, vehicle, onClose, onSaved }: VehicleFormModalProps) {
  const queryClient = useQueryClient();
  const isEditMode = !!vehicle;

  const { register, handleSubmit, reset } = useForm<VehicleFormValues>({
    defaultValues: {
      vehicle_number: "",
      name: "",
      capacity: 1,
      make_model: "",
      gps_device_id: "",
      registration_number: "",
      insurance_expiry: "",
      fuel_type: "",
    },
  });

  useEffect(() => {
    if (!isOpen) return;
    reset({
      vehicle_number: vehicle?.vehicle_number ?? "",
      name: vehicle?.name ?? "",
      capacity: vehicle?.capacity ?? 1,
      make_model: vehicle?.make_model ?? "",
      gps_device_id: vehicle?.gps_device_id ?? "",
      registration_number: vehicle?.registration_number ?? "",
      insurance_expiry: vehicle?.insurance_expiry ?? "",
      fuel_type: vehicle?.fuel_type ?? "",
    });
  }, [isOpen, vehicle, reset]);

  const mutation = useMutation({
    mutationFn: (values: VehicleFormValues) => {
      const payload = {
        vehicle_number: values.vehicle_number,
        name: values.name || undefined,
        capacity: Number(values.capacity),
        make_model: values.make_model || undefined,
        gps_device_id: values.gps_device_id || undefined,
        registration_number: values.registration_number || undefined,
        insurance_expiry: values.insurance_expiry || undefined,
        fuel_type: values.fuel_type || undefined,
      };
      return isEditMode ? transportService.updateVehicle(vehicle!.id, payload) : transportService.createVehicle(payload);
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["transport"] });
      onSaved();
    },
  });

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={isEditMode ? "Edit Vehicle" : "Add Vehicle"} size="xl">
      <form className="grid gap-4 sm:grid-cols-2" onSubmit={handleSubmit((values) => mutation.mutate(values))}>
        <Input label="Vehicle number" {...register("vehicle_number", { required: true })} />
        <Input label="Vehicle name (optional)" placeholder="e.g. Bus 1 — Yellow Route" {...register("name")} />
        <Input label="Capacity" type="number" min="1" {...register("capacity", { valueAsNumber: true })} />
        <Input label="Make / model" {...register("make_model")} />
        <Input label="GPS device ID" {...register("gps_device_id")} />
        <Input label="Registration number" {...register("registration_number")} />
        <Input label="Insurance expiry" type="date" {...register("insurance_expiry")} />
        <Select label="Fuel type" placeholder="Not set" options={FUEL_OPTIONS} {...register("fuel_type")} />

        <p className="text-xs text-[var(--ink-muted)] sm:col-span-2">
          Driver and route assignment happens while creating or editing a Route, not here.
        </p>

        {mutation.isError && (
          <p className="sm:col-span-2 text-sm text-red-600">{getApiErrorMessage(mutation.error, "Failed to save vehicle. Please try again.")}</p>
        )}

        <Button type="submit" className="sm:col-span-2" isLoading={mutation.isPending}>
          {isEditMode ? "Save changes" : "Add vehicle"}
        </Button>
      </form>
    </Modal>
  );
}
