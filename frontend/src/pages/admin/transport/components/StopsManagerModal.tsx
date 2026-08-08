import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { GripVertical, Plus } from "lucide-react";
import { DndContext, DragEndEvent, PointerSensor, closestCenter, useSensor, useSensors } from "@dnd-kit/core";
import { SortableContext, arrayMove, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Modal } from "@/components/ui/Modal";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import * as transportService from "@/services/transport.service";
import { PickupPoint, Route } from "@/types/transport.types";

interface StopFormValues {
  name: string;
  address: string;
  pickup_time: string;
  latitude: string;
  longitude: string;
}

function SortableStopRow({ stop, index, onEdit, onDelete }: { stop: PickupPoint; index: number; onEdit: () => void; onDelete: () => void }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: stop.id });
  const style = { transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.5 : 1 };

  return (
    <li
      ref={setNodeRef}
      style={style}
      className="flex items-center justify-between gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm dark:border-white/10 dark:bg-[#17171a]"
    >
      <div className="flex min-w-0 items-center gap-2">
        <button type="button" className="cursor-grab touch-none text-slate-400 hover:text-slate-600 dark:hover:text-slate-300" {...attributes} {...listeners}>
          <GripVertical size={16} />
        </button>
        <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-accent-500/10 text-[11px] font-semibold text-accent-600 dark:text-accent-300">
          {index + 1}
        </span>
        <div className="min-w-0">
          <span className="font-medium text-slate-800 dark:text-slate-100">{stop.name}</span>
          {stop.address && <span className="ml-2 text-slate-500 dark:text-slate-400">{stop.address}</span>}
          {stop.pickup_time && <span className="ml-2 text-slate-500 dark:text-slate-400">{stop.pickup_time}</span>}
        </div>
      </div>
      <div className="flex shrink-0 gap-2">
        <Button variant="ghost" className="!px-2 !py-1 text-xs" onClick={onEdit}>
          Edit
        </Button>
        <Button variant="ghost" className="!px-2 !py-1 text-xs text-red-600" onClick={onDelete}>
          Delete
        </Button>
      </div>
    </li>
  );
}

export function StopsManagerModal({ isOpen, route, onClose }: { isOpen: boolean; route: Route | null; onClose: () => void }) {
  const queryClient = useQueryClient();
  const [isAdding, setAdding] = useState(false);
  const [editingStop, setEditingStop] = useState<PickupPoint | null>(null);
  const [deletingStop, setDeletingStop] = useState<PickupPoint | null>(null);
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

  const { register, handleSubmit, reset } = useForm<StopFormValues>({
    defaultValues: { name: "", address: "", pickup_time: "", latitude: "", longitude: "" },
  });

  useEffect(() => {
    if (editingStop) {
      reset({
        name: editingStop.name,
        address: editingStop.address ?? "",
        pickup_time: editingStop.pickup_time ?? "",
        latitude: editingStop.latitude?.toString() ?? "",
        longitude: editingStop.longitude?.toString() ?? "",
      });
    } else if (isAdding) {
      reset({ name: "", address: "", pickup_time: "", latitude: "", longitude: "" });
    }
  }, [editingStop, isAdding, reset]);

  function invalidate() {
    void queryClient.invalidateQueries({ queryKey: ["transport", "routes"] });
  }

  const createMutation = useMutation({
    mutationFn: (values: StopFormValues) =>
      transportService.createPickup({
        route_id: route!.id,
        name: values.name,
        address: values.address || undefined,
        stop_order: (route?.pickup_points.length ?? 0) + 1,
        pickup_time: values.pickup_time || undefined,
        latitude: values.latitude ? Number(values.latitude) : undefined,
        longitude: values.longitude ? Number(values.longitude) : undefined,
      }),
    onSuccess: () => {
      invalidate();
      setAdding(false);
    },
  });

  const updateMutation = useMutation({
    mutationFn: (values: StopFormValues) =>
      transportService.updatePickupPoint(editingStop!.id, {
        name: values.name,
        address: values.address || undefined,
        pickup_time: values.pickup_time || undefined,
        latitude: values.latitude ? Number(values.latitude) : undefined,
        longitude: values.longitude ? Number(values.longitude) : undefined,
      }),
    onSuccess: () => {
      invalidate();
      setEditingStop(null);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: transportService.deletePickupPoint,
    onSuccess: () => {
      invalidate();
      setDeletingStop(null);
    },
  });

  const reorderMutation = useMutation({
    mutationFn: (stops: PickupPoint[]) =>
      Promise.all(stops.map((stop, index) => (stop.stop_order !== index + 1 ? transportService.updatePickupPoint(stop.id, { stop_order: index + 1 }) : null))),
    onSuccess: invalidate,
  });

  if (!route) return null;

  const sortedStops = [...route.pickup_points].sort((a, b) => a.stop_order - b.stop_order);
  const showForm = isAdding || !!editingStop;

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = sortedStops.findIndex((s) => s.id === active.id);
    const newIndex = sortedStops.findIndex((s) => s.id === over.id);
    if (oldIndex === -1 || newIndex === -1) return;
    reorderMutation.mutate(arrayMove(sortedStops, oldIndex, newIndex));
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={`Manage Stops — ${route.name}`} size="xl">
      <div className="space-y-4">
        <p className="text-xs text-[var(--ink-muted)]">
          Drag to reorder. This list is the Morning route (School → {route.to_location || "destination"}) — the Evening route is automatically this
          same list reversed.
        </p>

        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext items={sortedStops.map((s) => s.id)} strategy={verticalListSortingStrategy}>
            <ul className="space-y-1.5">
              {sortedStops.map((stop, index) => (
                <SortableStopRow
                  key={stop.id}
                  stop={stop}
                  index={index}
                  onEdit={() => {
                    setAdding(false);
                    setEditingStop(stop);
                  }}
                  onDelete={() => setDeletingStop(stop)}
                />
              ))}
            </ul>
          </SortableContext>
        </DndContext>
        {sortedStops.length === 0 && <p className="text-sm text-slate-500 dark:text-slate-400">No stops yet.</p>}

        {showForm ? (
          <form
            className="grid gap-3 rounded-lg border border-slate-200 p-3 sm:grid-cols-2 dark:border-white/10"
            onSubmit={handleSubmit((values) => (editingStop ? updateMutation.mutate(values) : createMutation.mutate(values)))}
          >
            <Input label="Name" {...register("name", { required: true })} />
            <Input label="Address" {...register("address")} />
            <Input label="Time" type="time" {...register("pickup_time")} />
            <div className="grid grid-cols-2 gap-3">
              <Input label="Latitude" type="number" step="any" {...register("latitude")} />
              <Input label="Longitude" type="number" step="any" {...register("longitude")} />
            </div>
            <div className="flex gap-2 sm:col-span-2">
              <Button type="submit" isLoading={createMutation.isPending || updateMutation.isPending}>
                {editingStop ? "Save stop" : "Add stop"}
              </Button>
              <Button
                type="button"
                variant="secondary"
                onClick={() => {
                  setAdding(false);
                  setEditingStop(null);
                }}
              >
                Cancel
              </Button>
            </div>
          </form>
        ) : (
          <Button variant="secondary" onClick={() => setAdding(true)}>
            <Plus size={14} strokeWidth={2} />
            Add stop
          </Button>
        )}
      </div>

      <ConfirmDialog
        isOpen={!!deletingStop}
        title="Delete stop"
        message={`Delete "${deletingStop?.name}"? Students assigned to it will need to be reassigned.`}
        confirmLabel="Delete"
        isLoading={deleteMutation.isPending}
        onConfirm={() => deletingStop && deleteMutation.mutate(deletingStop.id)}
        onCancel={() => setDeletingStop(null)}
      />
    </Modal>
  );
}
