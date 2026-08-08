import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Modal } from "@/components/ui/Modal";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Button } from "@/components/ui/Button";
import { getApiErrorMessage } from "@/lib/axios";
import { useSchool } from "@/hooks/useSchool";
import * as transportService from "@/services/transport.service";
import { Route } from "@/types/transport.types";

interface RouteFormValues {
  name: string;
  to_location: string;
  vehicle_id: string;
  primary_driver_id: string;
  secondary_driver_id: string;
}

export function RouteFormModal({ isOpen, route, onClose, onSaved }: { isOpen: boolean; route: Route | null; onClose: () => void; onSaved: () => void }) {
  const queryClient = useQueryClient();
  const isEditMode = !!route;
  const { selectedSchool } = useSchool();

  const { data: vehicles = [] } = useQuery({ queryKey: ["transport", "vehicles"], queryFn: transportService.fetchVehicles, enabled: isOpen });
  const { data: drivers = [] } = useQuery({ queryKey: ["transport", "drivers"], queryFn: transportService.fetchDrivers, enabled: isOpen });

  const { register, handleSubmit, reset, watch } = useForm<RouteFormValues>({
    defaultValues: { name: "", to_location: "", vehicle_id: "", primary_driver_id: "", secondary_driver_id: "" },
  });
  const primaryDriverId = watch("primary_driver_id");

  useEffect(() => {
    if (!isOpen) return;
    reset({
      name: route?.name ?? "",
      to_location: route?.to_location ?? "",
      vehicle_id: route?.vehicle_id ?? "",
      primary_driver_id: route?.primary_driver_id ?? "",
      secondary_driver_id: route?.secondary_driver_id ?? "",
    });
  }, [isOpen, route, reset]);

  // A vehicle already owned by a different route can't be picked — except
  // the route's own current vehicle when editing, so it stays selectable.
  const availableVehicles = vehicles.filter((v) => !v.routes || v.routes.id === route?.id || v.id === route?.vehicle_id);

  const mutation = useMutation({
    mutationFn: (values: RouteFormValues) => {
      const payload = {
        name: values.name,
        to_location: values.to_location,
        vehicle_id: values.vehicle_id,
        primary_driver_id: values.primary_driver_id,
        secondary_driver_id: values.secondary_driver_id || undefined,
      };
      return isEditMode ? transportService.updateRoute(route!.id, payload) : transportService.createRoute(payload);
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["transport"] });
      onSaved();
    },
  });

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={isEditMode ? "Edit Route" : "Add Route"} size="lg">
      <form className="grid gap-4 sm:grid-cols-2" onSubmit={handleSubmit((values) => mutation.mutate(values))}>
        <div className="sm:col-span-2">
          <Input label="Route name" {...register("name", { required: true })} />
        </div>

        <div>
          <label className="mb-1.5 block text-sm font-medium text-[var(--ink-secondary)]">From</label>
          <div className="flex h-10 items-center rounded-lg border border-black/[0.08] bg-black/[0.02] px-3 text-sm text-[var(--ink-muted)] dark:border-white/[0.08] dark:bg-white/[0.04]">
            {selectedSchool.name || "School"}
          </div>
        </div>
        <Input label="To" placeholder="Destination" {...register("to_location", { required: true })} />

        <Select
          label="Assigned vehicle"
          placeholder="Select a vehicle"
          options={availableVehicles.map((v) => ({ value: v.id, label: v.name ? `${v.name} (${v.vehicle_number})` : v.vehicle_number }))}
          {...register("vehicle_id", { required: true })}
        />
        <div />

        <Select
          label="Primary driver"
          placeholder="Select a driver"
          options={drivers.map((d) => ({ value: d.id, label: d.users.full_name }))}
          {...register("primary_driver_id", { required: true })}
        />
        <Select
          label="Secondary driver (optional)"
          placeholder="None"
          options={drivers.filter((d) => d.id !== primaryDriverId).map((d) => ({ value: d.id, label: d.users.full_name }))}
          {...register("secondary_driver_id")}
        />

        {mutation.isError && (
          <p className="sm:col-span-2 text-sm text-red-600">{getApiErrorMessage(mutation.error, "Failed to save route.")}</p>
        )}
        <Button type="submit" className="sm:col-span-2" isLoading={mutation.isPending}>
          {isEditMode ? "Save changes" : "Create route"}
        </Button>
      </form>
    </Modal>
  );
}
