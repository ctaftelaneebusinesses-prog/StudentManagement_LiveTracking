import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CalendarCheck, MapPin, Plus } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Select } from "@/components/ui/Select";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { Skeleton } from "@/components/ui/Skeleton";
import { EmptyState } from "@/components/ui/EmptyState";
import { Checkbox } from "@/components/ui/Checkbox";
import { useToast } from "@/components/ui/Toast";
import { getApiErrorMessage } from "@/lib/axios";
import * as portalService from "@/services/extracurricularPortal.service";
import { formatTime, todayIso } from "./utils";
import { BatchClassPicker, EMPTY_BATCH_PICKER } from "./components/BatchClassPicker";
import { resolveBatch } from "./batchPicker";

const EMPTY_FORM = {
  activity_id: "",
  title: "",
  description: "",
  event_date: "",
  start_time: "",
  end_time: "",
  venue: "",
};

export function ExtracurricularEventsPage() {
  const toast = useToast();
  const queryClient = useQueryClient();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [targetClass, setTargetClass] = useState(false);
  const [picker, setPicker] = useState(EMPTY_BATCH_PICKER);
  const [selectedStudentIds, setSelectedStudentIds] = useState<Set<string>>(new Set());

  const activitiesQuery = useQuery({ queryKey: ["extracurricular", "activities"], queryFn: portalService.fetchMyActivities });
  const activityOptions = (activitiesQuery.data ?? []).map((a) => ({ value: a.id, label: a.name }));

  const batchesQuery = useQuery({ queryKey: ["extracurricular", "batches"], queryFn: portalService.fetchMyBatches });
  const batches = batchesQuery.data ?? [];
  const batchId = targetClass
    ? (resolveBatch(batches, picker.academicYear, picker.className, picker.section, picker.activityId)?.id ?? "")
    : "";

  const rosterQuery = useQuery({
    queryKey: ["extracurricular", "batch-students", batchId],
    queryFn: () => portalService.fetchBatchStudents(batchId),
    enabled: !!batchId && isModalOpen,
  });

  useEffect(() => {
    if (rosterQuery.data) setSelectedStudentIds(new Set(rosterQuery.data.map((s) => s.id)));
  }, [rosterQuery.data]);

  function toggleStudent(studentId: string) {
    setSelectedStudentIds((prev) => {
      const next = new Set(prev);
      if (next.has(studentId)) next.delete(studentId);
      else next.add(studentId);
      return next;
    });
  }

  const eventsQuery = useQuery({ queryKey: ["extracurricular", "events"], queryFn: portalService.fetchMyEvents });

  const createMutation = useMutation({
    mutationFn: () =>
      portalService.createEvent({
        activity_id: form.activity_id || undefined,
        batch_id: batchId || undefined,
        title: form.title,
        description: form.description || undefined,
        event_date: form.event_date,
        start_time: form.start_time || undefined,
        end_time: form.end_time || undefined,
        venue: form.venue || undefined,
        student_ids: batchId ? Array.from(selectedStudentIds) : undefined,
      }),
    onSuccess: () => {
      toast.success("Event created.");
      queryClient.invalidateQueries({ queryKey: ["extracurricular", "events"] });
      setIsModalOpen(false);
      setForm(EMPTY_FORM);
      setTargetClass(false);
      setPicker(EMPTY_BATCH_PICKER);
    },
    onError: (err) => toast.error(getApiErrorMessage(err, "Failed to create event.")),
  });

  const events = eventsQuery.data ?? [];

  return (
    <div className="animate-fade-in space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-[var(--ink-primary)]">Activity Events</h1>
          <p className="text-sm text-[var(--ink-muted)]">Create showcases, competitions, and other activity events.</p>
        </div>
        <Button onClick={() => setIsModalOpen(true)}>
          <Plus size={16} strokeWidth={2} className="mr-1.5" />
          Create Event
        </Button>
      </div>

      <Card>
        {eventsQuery.isLoading ? (
          <div className="space-y-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-16 w-full" />
            ))}
          </div>
        ) : events.length === 0 ? (
          <EmptyState icon={CalendarCheck} title="No events yet" description="Events you create will appear here." />
        ) : (
          <ul className="space-y-3">
            {events.map((event) => (
              <li
                key={event.id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-black/[0.06] p-4 dark:border-white/[0.08]"
              >
                <div>
                  <p className="text-sm font-semibold text-[var(--ink-primary)]">{event.title}</p>
                  <p className="mt-0.5 text-xs text-[var(--ink-muted)]">
                    {event.activities?.name ?? "General"}
                    {event.extracurricular_batches?.classes
                      ? ` · ${event.extracurricular_batches.classes.name} - ${event.extracurricular_batches.classes.section}`
                      : ""}
                  </p>
                  {event.description && <p className="mt-1 max-w-md text-xs text-[var(--ink-secondary)]">{event.description}</p>}
                </div>
                <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-[var(--ink-secondary)]">
                  <span>{new Date(event.event_date).toLocaleDateString()}</span>
                  {event.start_time && (
                    <span>
                      {formatTime(event.start_time)}
                      {event.end_time ? ` – ${formatTime(event.end_time)}` : ""}
                    </span>
                  )}
                  {event.venue && (
                    <span className="inline-flex items-center gap-1">
                      <MapPin size={13} strokeWidth={1.75} className="text-[var(--ink-muted)]" />
                      {event.venue}
                    </span>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title="Create Activity Event">
        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            createMutation.mutate();
          }}
        >
          <Input
            label="Title"
            name="title"
            value={form.title}
            onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
            required
          />
          <Select
            label="Activity (optional)"
            name="activity_id"
            placeholder="Any activity"
            options={activityOptions}
            value={form.activity_id}
            onChange={(e) => setForm((f) => ({ ...f, activity_id: e.target.value }))}
          />

          <label className="flex items-center gap-2 text-sm text-slate-700 dark:text-slate-300">
            <Checkbox checked={targetClass} onChange={(e) => setTargetClass(e.target.checked)} />
            Notify a specific class
          </label>

          {targetClass && (
            <div className="space-y-3 rounded-lg border border-slate-200 p-3 dark:border-white/10">
              <BatchClassPicker batches={batches} value={picker} onChange={setPicker} />
              {batchId && (
                <>
                  <p className="text-sm font-medium text-slate-700 dark:text-slate-300">
                    Notify students ({selectedStudentIds.size} selected)
                  </p>
                  {rosterQuery.isLoading ? (
                    <Skeleton className="h-20 w-full" />
                  ) : (
                    <div className="max-h-48 space-y-1 overflow-y-auto">
                      {(rosterQuery.data ?? []).map((s) => (
                        <label key={s.id} className="flex items-center gap-2 rounded px-1 py-1 text-sm hover:bg-slate-50 dark:hover:bg-white/5">
                          <Checkbox checked={selectedStudentIds.has(s.id)} onChange={() => toggleStudent(s.id)} />
                          {s.users.full_name} <span className="text-xs text-slate-400 dark:text-slate-500">({s.admission_no})</span>
                        </label>
                      ))}
                    </div>
                  )}
                </>
              )}
            </div>
          )}

          <div>
            <label className="mb-1.5 block text-sm font-medium text-[var(--ink-secondary)]">Description</label>
            <textarea
              className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500 dark:border-white/20 dark:bg-white/10 dark:text-white"
              rows={3}
              value={form.description}
              onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
            />
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <Input
              label="Event Date"
              type="date"
              min={todayIso()}
              value={form.event_date}
              onChange={(e) => setForm((f) => ({ ...f, event_date: e.target.value }))}
              required
            />
            <Input
              label="Start Time"
              type="time"
              value={form.start_time}
              onChange={(e) => setForm((f) => ({ ...f, start_time: e.target.value }))}
            />
            <Input
              label="End Time"
              type="time"
              value={form.end_time}
              onChange={(e) => setForm((f) => ({ ...f, end_time: e.target.value }))}
            />
          </div>
          <Input
            label="Venue"
            value={form.venue}
            onChange={(e) => setForm((f) => ({ ...f, venue: e.target.value }))}
          />
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="secondary" onClick={() => setIsModalOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" isLoading={createMutation.isPending} disabled={!form.title || !form.event_date}>
              Create Event
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
