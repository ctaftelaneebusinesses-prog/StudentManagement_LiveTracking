import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Modal } from "@/components/ui/Modal";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { SearchableSelect } from "@/components/ui/SearchableSelect";
import { Button } from "@/components/ui/Button";
import { Badge, BadgeVariant } from "@/components/ui/Badge";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import * as transportService from "@/services/transport.service";
import * as classesService from "@/services/admin/classes.service";
import { getApiErrorMessage } from "@/lib/axios";
import { Route, RouteStudentAssignment, TransportDirection, TransportPaymentStatus } from "@/types/transport.types";

/** Key a class by name+section, ignoring which academic year it's under. */
function classKey(name: string, section: string): string {
  return `${name}␟${section}`;
}

const PAYMENT_STATUS_OPTIONS: { value: TransportPaymentStatus; label: string }[] = [
  { value: "unpaid", label: "Unpaid" },
  { value: "partial", label: "Partial" },
  { value: "paid", label: "Paid" },
];

const PAYMENT_STATUS_BADGE: Record<TransportPaymentStatus, BadgeVariant> = {
  unpaid: "danger",
  partial: "warning",
  paid: "success",
};

const DIRECTION_OPTIONS: { value: TransportDirection; label: string }[] = [
  { value: "both", label: "Morning & Evening" },
  { value: "morning", label: "Morning only" },
  { value: "evening", label: "Evening only" },
];

const DIRECTION_LABEL: Record<TransportDirection, string> = { both: "Morning & Evening", morning: "Morning only", evening: "Evening only" };

export function AssignStudentsModal({ isOpen, route, onClose }: { isOpen: boolean; route: Route | null; onClose: () => void }) {
  const queryClient = useQueryClient();
  const [selectedClassKey, setSelectedClassKey] = useState("");
  const [studentId, setStudentId] = useState("");
  const [stopId, setStopId] = useState("");
  const [direction, setDirection] = useState<TransportDirection>("both");
  const [showRouteChangeConfirm, setShowRouteChangeConfirm] = useState(false);

  const classesQuery = useQuery({ queryKey: ["admin", "classes"], queryFn: classesService.fetchClasses, enabled: isOpen });
  const classes = classesQuery.data ?? [];

  // A school can have more than one class row sharing the same name+section
  // (e.g. two "10 - A"s, one per academic year) — assigning transport doesn't
  // care which academic year a student's class happens to be under, so the
  // picker keys on name+section and searches every matching class row rather
  // than guessing which single one is "the right year" (that guess was wrong
  // often enough to hide real students). The assign action itself only needs
  // the student's id, never a class_id, so merging is safe.
  const classOptionsByKey = new Map<string, { name: string; section: string }>();
  for (const c of classes) classOptionsByKey.set(classKey(c.name, c.section), { name: c.name, section: c.section });
  const classOptions = Array.from(classOptionsByKey, ([value, c]) => ({ value, label: `${c.name} - ${c.section}` }));

  const matchingClassIds = selectedClassKey
    ? classes.filter((c) => classKey(c.name, c.section) === selectedClassKey).map((c) => c.id)
    : [];

  const classStudentsQuery = useQuery({
    queryKey: ["admin", "classes", matchingClassIds.slice().sort(), "students"],
    queryFn: async () => {
      // pageSize is capped at 100 server-side (getClassStudentsSchema) — asking
      // for more than that 400s the whole request, which silently looked
      // identical to "this class has 0 students" in the UI below.
      const results = await Promise.all(matchingClassIds.map((id) => classesService.fetchClassStudents(id, { pageSize: 100 })));
      return results.flatMap((r) => r.items);
    },
    enabled: matchingClassIds.length > 0,
  });

  const rosterQuery = useQuery({
    queryKey: ["transport", "route-students", route?.id],
    queryFn: () => transportService.fetchRouteStudents(route!.id),
    enabled: !!route && isOpen,
  });

  function resetForm() {
    setSelectedClassKey("");
    setStudentId("");
    setStopId("");
    setDirection("both");
  }

  const selectedStudent = (classStudentsQuery.data ?? []).find((s) => s.id === studentId) ?? null;

  // Looks up whatever route the selected student is currently on (if any) so
  // assigning them to a different route can warn first instead of silently
  // overwriting their existing stop — a student may only ever have one active
  // transport route (student_pickup_points.student_id is the table's PK).
  const currentTransportQuery = useQuery({
    queryKey: ["transport", "student-transport", studentId],
    queryFn: () => transportService.fetchStudentTransport(studentId),
    enabled: !!studentId,
  });
  const currentRoute = currentTransportQuery.data?.pickup_points.routes ?? null;
  const isRouteChange = !!currentRoute && currentRoute.id !== route?.id;

  const assignMutation = useMutation({
    mutationFn: () => transportService.assignStudentTransport(studentId, { pickup_point_id: stopId, transport_direction: direction }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["transport", "route-students", route?.id] });
      void queryClient.invalidateQueries({ queryKey: ["transport", "student-transport", studentId] });
      setShowRouteChangeConfirm(false);
      resetForm();
    },
  });

  function handleAssignClick() {
    if (isRouteChange) {
      setShowRouteChangeConfirm(true);
      return;
    }
    assignMutation.mutate();
  }

  const unassignMutation = useMutation({
    mutationFn: (studentId: string) => transportService.unassignStudentTransport(studentId),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ["transport", "route-students", route?.id] }),
  });

  if (!route) return null;

  const stopOptions = [...route.pickup_points].sort((a, b) => a.stop_order - b.stop_order).map((p) => ({ value: p.id, label: p.name }));
  const roster = rosterQuery.data ?? [];

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={`Assign Students — ${route.name}`} size="xl">
      <div className="space-y-5">
        <div className="space-y-3 rounded-lg border border-slate-200 p-3 dark:border-white/10">
          <div className="grid gap-3 sm:grid-cols-2">
            <Select
              label="Class"
              placeholder="Select a class"
              options={classOptions}
              value={selectedClassKey}
              onChange={(e) => {
                setSelectedClassKey(e.target.value);
                setStudentId("");
              }}
            />
            <SearchableSelect
              label="Student"
              placeholder={selectedClassKey ? "Select a student" : "Select a class first"}
              disabled={!selectedClassKey}
              options={(classStudentsQuery.data ?? []).map((s) => ({
                value: s.id,
                label: `${s.users.full_name} · ${s.admission_no}`,
              }))}
              value={studentId}
              onChange={setStudentId}
            />
          </div>
          {classStudentsQuery.isError && (
            <p className="text-sm text-[var(--delta-bad)]">
              {getApiErrorMessage(classStudentsQuery.error, "Failed to load students for this class.")}
            </p>
          )}
          {selectedClassKey &&
            !classStudentsQuery.isLoading &&
            !classStudentsQuery.isError &&
            (classStudentsQuery.data ?? []).length === 0 && (
              <p className="text-sm text-slate-500 dark:text-slate-400">No students in this class yet.</p>
            )}

          {selectedStudent && (
            <div className="grid gap-3 sm:grid-cols-2">
              <Select label="Stop" placeholder="Select a stop" options={stopOptions} value={stopId} onChange={(e) => setStopId(e.target.value)} />
              <Select
                label="When"
                options={DIRECTION_OPTIONS}
                value={direction}
                onChange={(e) => setDirection(e.target.value as TransportDirection)}
              />
              {isRouteChange && (
                <p className="text-sm text-amber-600 dark:text-amber-400 sm:col-span-2">
                  Already assigned to {currentRoute!.name}. Assigning here will move them to {route.name}.
                </p>
              )}
              <Button className="sm:col-span-2" disabled={!stopId} isLoading={assignMutation.isPending} onClick={handleAssignClick}>
                Assign {selectedStudent.users.full_name}
              </Button>
            </div>
          )}
        </div>

        <div>
          <h3 className="mb-2 text-sm font-semibold text-slate-700 dark:text-slate-300">Assigned students ({roster.length})</h3>
          <ul className="space-y-1.5">
            {roster.map((entry) => (
              <li key={entry.student_id} className="rounded-lg border border-slate-200 px-3 py-2 text-sm dark:border-white/10">
                <div className="flex items-center justify-between">
                  <span>
                    {entry.students.users.full_name} · {entry.students.admission_no}
                    <span className="ml-2 text-xs text-slate-500 dark:text-slate-400">{DIRECTION_LABEL[entry.transport_direction]}</span>
                  </span>
                  <Button variant="ghost" className="!px-2 !py-1 text-xs text-red-600" onClick={() => unassignMutation.mutate(entry.student_id)}>
                    Remove
                  </Button>
                </div>
                <TransportFeeEditor entry={entry} routeId={route.id} />
              </li>
            ))}
            {roster.length === 0 && <p className="text-sm text-slate-500 dark:text-slate-400">No students assigned to this route yet.</p>}
          </ul>
        </div>
      </div>

      <ConfirmDialog
        isOpen={showRouteChangeConfirm}
        title="Change transport route?"
        message={`This student is already assigned to ${currentRoute?.name ?? "another route"}. Do you want to change the transport route?`}
        confirmLabel="Yes, Change Route"
        isLoading={assignMutation.isPending}
        onConfirm={() => assignMutation.mutate()}
        onCancel={() => setShowRouteChangeConfirm(false)}
      />
    </Modal>
  );
}

function TransportFeeEditor({ entry, routeId }: { entry: RouteStudentAssignment; routeId: string }) {
  const queryClient = useQueryClient();
  const [isEditing, setEditing] = useState(false);
  const [amount, setAmount] = useState(entry.fee_amount != null ? String(entry.fee_amount) : "");
  const [status, setStatus] = useState<TransportPaymentStatus>(entry.payment_status);

  const mutation = useMutation({
    mutationFn: () =>
      transportService.setTransportFee(entry.student_id, {
        fee_amount: amount === "" ? undefined : Number(amount),
        payment_status: status,
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["transport", "route-students", routeId] });
      setEditing(false);
    },
  });

  if (!isEditing) {
    return (
      <div className="mt-1.5 flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
        <Badge variant={PAYMENT_STATUS_BADGE[entry.payment_status]}>{entry.payment_status}</Badge>
        <span>{entry.fee_amount != null ? `₹${entry.fee_amount}` : "No fee set"}</span>
        <button type="button" className="text-brand-600 hover:underline" onClick={() => setEditing(true)}>
          Edit fee
        </button>
      </div>
    );
  }

  return (
    <div className="mt-2 flex flex-wrap items-end gap-2">
      <Input label="Fee amount" type="number" min="0" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} className="!w-32" />
      <Select
        label="Payment status"
        options={PAYMENT_STATUS_OPTIONS}
        value={status}
        onChange={(e) => setStatus(e.target.value as TransportPaymentStatus)}
        className="!w-32"
      />
      <Button className="!px-3 !py-1.5 text-xs" isLoading={mutation.isPending} onClick={() => mutation.mutate()}>
        Save
      </Button>
      <Button variant="ghost" className="!px-2 !py-1.5 text-xs" onClick={() => setEditing(false)}>
        Cancel
      </Button>
    </div>
  );
}
