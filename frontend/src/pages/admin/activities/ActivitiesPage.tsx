import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Pencil, Plus, Search, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { DataTable } from "@/components/ui/DataTable";
import { Input } from "@/components/ui/Input";
import { Modal } from "@/components/ui/Modal";
import { useToast } from "@/components/ui/Toast";
import { ChartCard } from "@/pages/admin/dashboard/components/ChartCard";
import { EmptyState } from "@/components/ui/EmptyState";
import { Skeleton } from "@/components/ui/Skeleton";
import * as activitiesService from "@/services/admin/activities.service";
import * as extracurricularStaffService from "@/services/admin/extracurricularStaff.service";
import { Activity } from "@/types/extracurricularStaff.types";
import { getApiErrorMessage } from "@/lib/axios";

const activityFormSchema = z.object({
  name: z.string().min(2, "Activity name is required"),
  staff_title: z.string().min(2, "Staff title is required"),
  category: z.string().optional(),
});
type ActivityFormValues = z.infer<typeof activityFormSchema>;

const EMPTY_FORM: ActivityFormValues = { name: "", staff_title: "", category: "" };

export function ActivitiesPage() {
  const queryClient = useQueryClient();
  const toast = useToast();

  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"" | "active" | "inactive">("");
  const [modalMode, setModalMode] = useState<"add" | "edit" | null>(null);
  const [editingActivity, setEditingActivity] = useState<Activity | null>(null);
  const [pendingDeactivate, setPendingDeactivate] = useState<Activity | null>(null);
  const [viewAssignmentsActivity, setViewAssignmentsActivity] = useState<Activity | null>(null);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search), 350);
    return () => clearTimeout(timer);
  }, [search]);

  const { data: activities = [], isLoading } = useQuery({
    queryKey: ["admin", "activities", debouncedSearch, statusFilter],
    queryFn: () =>
      activitiesService.fetchActivities({
        search: debouncedSearch || undefined,
        is_active: statusFilter === "" ? undefined : statusFilter === "active",
      }),
  });

  function invalidate() {
    queryClient.invalidateQueries({ queryKey: ["admin", "activities"] });
  }

  const deactivateMutation = useMutation({
    mutationFn: (id: string) => activitiesService.deactivateActivity(id),
    onSuccess: () => {
      invalidate();
      toast.success(`${pendingDeactivate?.name ?? "Activity"} deactivated.`);
      setPendingDeactivate(null);
    },
    onError: (err) => toast.error(getApiErrorMessage(err, "Failed to deactivate activity.")),
  });

  function openAddModal() {
    setEditingActivity(null);
    setModalMode("add");
  }

  function openEditModal(activity: Activity) {
    setEditingActivity(activity);
    setModalMode("edit");
  }

  return (
    <div className="animate-fade-in space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-[var(--ink-primary)]">Activities</h1>
        <p className="mt-1 text-sm text-[var(--ink-muted)]">
          Manage the extracurricular activities (dance, yoga, karate, music, art, ...) offered at your school.
        </p>
      </div>

      <ChartCard
        title="Activities"
        subtitle={`${activities.length} total`}
        legend={
          <Button onClick={openAddModal} className="!px-3 !py-1.5 text-xs">
            <Plus size={14} className="mr-1" />
            Add activity
          </Button>
        }
      >
        <div className="mb-4 flex flex-wrap items-center gap-3">
          <div className="relative max-w-sm flex-1">
            <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[var(--ink-muted)]" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by activity name or staff title…"
              className="w-full rounded-lg border border-slate-300 bg-white py-2 pl-9 pr-3 text-sm text-slate-900 outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500 dark:border-white/15 dark:bg-white/5 dark:text-white"
            />
          </div>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as "" | "active" | "inactive")}
            className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500 dark:border-white/15 dark:bg-white/5 dark:text-white"
          >
            <option value="">All statuses</option>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
          </select>
        </div>

        <DataTable
          isLoading={isLoading}
          rows={activities}
          rowKey={(a) => a.id}
          emptyMessage={
            debouncedSearch ? "No activities match your search." : "No activities yet. Add your first activity to get started."
          }
          columns={[
            { header: "Activity name", cell: (a) => <span className="font-medium text-[var(--ink-primary)]">{a.name}</span> },
            { header: "Staff title", cell: (a) => a.staff_title },
            { header: "Category", cell: (a) => a.category ?? "—" },
            {
              header: "Assignment",
              cell: (a) => {
                const pending = a.assignedPendingCount ?? 0;
                const completed = a.assignedCompletedCount ?? 0;
                if (pending === 0 && completed === 0) {
                  return <span className="text-sm text-[var(--ink-muted)]">Not assigned</span>;
                }
                return (
                  <button
                    type="button"
                    onClick={() => setViewAssignmentsActivity(a)}
                    className="flex flex-wrap gap-1 rounded-md outline-none hover:opacity-80 focus-visible:ring-2 focus-visible:ring-brand-500"
                    title="View who's completed and who's pending"
                  >
                    {completed > 0 && <Badge variant="success">{completed} Completed</Badge>}
                    {pending > 0 && <Badge variant="warning">{pending} Pending</Badge>}
                  </button>
                );
              },
            },
            {
              header: "Status",
              cell: (a) => <Badge variant={a.is_active ? "success" : "neutral"}>{a.is_active ? "Active" : "Inactive"}</Badge>,
            },
            {
              header: "",
              cell: (a) => (
                <div className="flex justify-end gap-1">
                  <Button variant="ghost" className="!p-1.5" title="Edit" onClick={() => openEditModal(a)}>
                    <Pencil size={15} />
                  </Button>
                  {a.is_active && (
                    <Button
                      variant="ghost"
                      className="!p-1.5 text-red-600"
                      title="Deactivate"
                      onClick={() => setPendingDeactivate(a)}
                    >
                      <Trash2 size={15} />
                    </Button>
                  )}
                </div>
              ),
              className: "text-right",
            },
          ]}
        />
      </ChartCard>

      <ActivityFormModal
        isOpen={modalMode !== null}
        mode={modalMode ?? "add"}
        activity={editingActivity}
        onClose={() => setModalMode(null)}
        onSaved={invalidate}
      />

      <ConfirmDialog
        isOpen={!!pendingDeactivate}
        title="Deactivate activity"
        message={`Deactivate "${pendingDeactivate?.name}"? It will no longer be selectable as a staff type or assignment, but existing records are preserved.`}
        confirmLabel="Deactivate"
        isLoading={deactivateMutation.isPending}
        onConfirm={() => pendingDeactivate && deactivateMutation.mutate(pendingDeactivate.id)}
        onCancel={() => setPendingDeactivate(null)}
      />

      <ActivityAssignmentsModal activity={viewAssignmentsActivity} onClose={() => setViewAssignmentsActivity(null)} />
    </div>
  );
}

function formatDateTime(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" });
}

interface ActivityAssignmentsModalProps {
  activity: Activity | null;
  onClose: () => void;
}

/** Per-staff breakdown behind the Activities table's aggregate "N Completed / N Pending" badges. */
function ActivityAssignmentsModal({ activity, onClose }: ActivityAssignmentsModalProps) {
  const { data: assignments = [], isLoading } = useQuery({
    queryKey: ["admin", "activities", "assignments", activity?.id],
    queryFn: () => activitiesService.fetchActivityAssignments(activity!.id),
    enabled: !!activity,
  });

  return (
    <Modal isOpen={!!activity} onClose={onClose} title={activity ? `Assignments — ${activity.name}` : "Assignments"} size="md">
      {isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-12 w-full" />
          ))}
        </div>
      ) : assignments.length === 0 ? (
        <EmptyState title="No one assigned yet" description="Edit this activity to assign teacher(s)." />
      ) : (
        <div className="space-y-2">
          {assignments.map((a) => (
            <div
              key={a.id}
              className="flex items-center justify-between gap-3 rounded-lg border border-slate-200 p-3 dark:border-white/10"
            >
              <div>
                <p className="text-sm font-medium text-[var(--ink-primary)]">{a.full_name || a.staff_code}</p>
                <p className="text-xs text-[var(--ink-muted)]">
                  {a.status === "completed"
                    ? `Completed ${formatDateTime(a.completed_at)}`
                    : `Assigned ${formatDateTime(a.assigned_at)}`}
                </p>
              </div>
              <Badge variant={a.status === "completed" ? "success" : "warning"}>
                {a.status === "completed" ? "Completed" : "Pending"}
              </Badge>
            </div>
          ))}
        </div>
      )}
    </Modal>
  );
}

interface ActivityFormModalProps {
  isOpen: boolean;
  mode: "add" | "edit";
  activity: Activity | null;
  onClose: () => void;
  onSaved: () => void;
}

function ActivityFormModal({ isOpen, mode, activity, onClose, onSaved }: ActivityFormModalProps) {
  const toast = useToast();
  const [staffIds, setStaffIds] = useState<string[]>([]);
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<ActivityFormValues>({ resolver: zodResolver(activityFormSchema), defaultValues: EMPTY_FORM });

  const { data: staffList = { items: [], total: 0, page: 1, pageSize: 200 } } = useQuery({
    queryKey: ["admin", "extracurricular-staff", "active"],
    queryFn: () => extracurricularStaffService.fetchExtracurricularStaffList({ status: "active", pageSize: 200 }),
    enabled: isOpen,
  });

  const { data: assignedStaff } = useQuery({
    queryKey: ["admin", "extracurricular-staff", "by-activity", activity?.id],
    queryFn: () => extracurricularStaffService.fetchExtracurricularStaffList({ activity_id: activity!.id, pageSize: 200 }),
    enabled: isOpen && !!activity,
  });

  useEffect(() => {
    if (!isOpen) return;
    reset(
      activity
        ? { name: activity.name, staff_title: activity.staff_title, category: activity.category ?? "" }
        : EMPTY_FORM
    );
    if (!activity) setStaffIds([]);
  }, [isOpen, activity, reset]);

  useEffect(() => {
    if (isOpen && activity && assignedStaff) {
      setStaffIds(assignedStaff.items.map((s) => s.id));
    }
  }, [isOpen, activity, assignedStaff]);

  function toggleStaff(id: string) {
    setStaffIds((prev) => (prev.includes(id) ? prev.filter((s) => s !== id) : [...prev, id]));
  }

  const saveMutation = useMutation({
    mutationFn: (values: ActivityFormValues) =>
      activity
        ? activitiesService.updateActivity(activity.id, {
            name: values.name,
            staff_title: values.staff_title,
            category: values.category || undefined,
            staff_ids: staffIds,
          })
        : activitiesService.createActivity({
            name: values.name,
            staff_title: values.staff_title,
            category: values.category || undefined,
            staff_ids: staffIds,
          }),
    onSuccess: () => {
      onSaved();
      toast.success(mode === "edit" ? "Activity updated." : "Activity added.");
      onClose();
    },
    onError: (err) => toast.error(getApiErrorMessage(err, mode === "edit" ? "Failed to update activity." : "Failed to add activity.")),
  });

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={mode === "edit" ? "Edit activity" : "Add activity"} size="md">
      <form className="space-y-4" onSubmit={handleSubmit((values) => saveMutation.mutate(values))}>
        <Input label="Activity name" error={errors.name?.message} {...register("name")} />
        <Input
          label="Staff title"
          error={errors.staff_title?.message}
          placeholder="e.g. Dance Instructor"
          {...register("staff_title")}
        />
        <Input label="Category (optional)" placeholder="e.g. Performing Arts" {...register("category")} />

        <div className="space-y-1.5">
          <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Assign to teacher(s) (optional)</label>
          <div className="max-h-48 space-y-1 overflow-y-auto rounded-lg border border-slate-200 p-2 dark:border-white/10">
            {staffList.items.length === 0 ? (
              <p className="px-2 py-3 text-sm text-slate-400">No active extracurricular staff found.</p>
            ) : (
              staffList.items.map((s) => (
                <label
                  key={s.id}
                  className="flex items-center gap-2 rounded-md px-2 py-1.5 text-sm text-slate-700 hover:bg-slate-50 dark:text-slate-300 dark:hover:bg-white/5"
                >
                  <input
                    type="checkbox"
                    checked={staffIds.includes(s.id)}
                    onChange={() => toggleStaff(s.id)}
                    className="rounded border-slate-300 text-brand-600 focus:ring-brand-500"
                  />
                  {s.users.full_name}
                </label>
              ))
            )}
          </div>
          <p className="text-xs text-[var(--ink-muted)]">
            Assigned staff are notified immediately and can mark the activity complete from their portal.
          </p>
        </div>

        <Button type="submit" className="w-full" isLoading={isSubmitting || saveMutation.isPending}>
          {mode === "edit" ? "Save changes" : "Add activity"}
        </Button>
      </form>
    </Modal>
  );
}
