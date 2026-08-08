import { useState } from "react";
import { useForm } from "react-hook-form";
import { useMutation, useQuery } from "@tanstack/react-query";
import { CalendarClock, Printer, MessageSquarePlus } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { Input } from "@/components/ui/Input";
import { Textarea } from "@/components/ui/Textarea";
import { Skeleton } from "@/components/ui/Skeleton";
import { EmptyState } from "@/components/ui/EmptyState";
import { useToast } from "@/components/ui/Toast";
import * as portalService from "@/services/teacher/portal.service";
import * as changeRequestService from "@/services/teacher/timetableChangeRequest.service";
import { getApiErrorMessage } from "@/lib/axios";
import { DAY_NAMES } from "@/types/dashboard.types";
import { TeacherWeeklyPeriod } from "@/types/teacher.types";

interface SuggestFormValues {
  room_number: string;
  start_time: string;
  end_time: string;
  reason: string;
}

export function TeacherTimetablePage() {
  const toast = useToast();
  const [suggestTarget, setSuggestTarget] = useState<TeacherWeeklyPeriod | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["teacher", "timetable", "weekly"],
    queryFn: portalService.fetchWeeklyTimetable,
  });

  const { register, handleSubmit, reset, formState: { isSubmitting, errors } } = useForm<SuggestFormValues>();

  const suggestMutation = useMutation({
    mutationFn: (values: SuggestFormValues) => {
      if (!suggestTarget) throw new Error("No period selected");
      return changeRequestService.suggestChange({
        class_id: suggestTarget.class_id,
        period_id: suggestTarget.id,
        day_of_week: suggestTarget.day_of_week,
        period_no: suggestTarget.period_no,
        proposed_change: {
          room_number: values.room_number || undefined,
          start_time: values.start_time || undefined,
          end_time: values.end_time || undefined,
        },
        reason: values.reason,
      });
    },
    onSuccess: () => {
      reset();
      setSuggestTarget(null);
      toast.success("Change suggestion sent to the admin for review.");
    },
    onError: (err) => toast.error(getApiErrorMessage(err, "Failed to submit suggestion.")),
  });

  function openSuggest(period: TeacherWeeklyPeriod) {
    reset({ room_number: period.room_number ?? "", start_time: period.start_time.slice(0, 5), end_time: period.end_time.slice(0, 5), reason: "" });
    setSuggestTarget(period);
  }

  const days = data ?? [];
  const hasAnyPeriods = days.some((d) => d.periods.length > 0);

  return (
    <div className="animate-fade-in space-y-6 print:space-y-2">
      <div className="flex flex-wrap items-center justify-between gap-3 print:hidden">
        <div>
          <h1 className="text-2xl font-semibold text-[var(--ink-primary)]">My Timetable</h1>
          <p className="text-sm text-[var(--ink-muted)]">Your full weekly schedule across every class you teach.</p>
        </div>
        <Button variant="secondary" onClick={() => window.print()}>
          <Printer size={16} className="mr-1.5 inline" strokeWidth={1.75} />
          Print
        </Button>
      </div>

      <h1 className="hidden text-xl font-semibold print:block">My Timetable</h1>

      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-20 w-full" />
          ))}
        </div>
      ) : !hasAnyPeriods ? (
        <EmptyState title="No periods scheduled" description="Once the admin builds your timetable, it will appear here." />
      ) : (
        <div className="space-y-4">
          {DAY_NAMES.map((dayName, dayIndex) => {
            const day = days.find((d) => d.dayOfWeek === dayIndex);
            if (!day || day.periods.length === 0) return null;
            return (
              <Card key={dayIndex} className="space-y-3 print:break-inside-avoid print:border print:shadow-none">
                <h2 className="text-sm font-semibold uppercase tracking-wide text-[var(--ink-secondary)]">{dayName}</h2>
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
                  {day.periods.map((p) => (
                    <div
                      key={p.id}
                      className="rounded-xl border border-black/[0.06] p-3 dark:border-white/[0.08]"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="inline-flex items-center gap-1.5 text-xs font-medium text-[var(--ink-muted)]">
                          <CalendarClock size={13} strokeWidth={1.75} />
                          Period {p.period_no} · {p.start_time.slice(0, 5)}–{p.end_time.slice(0, 5)}
                        </span>
                        <button
                          type="button"
                          title="Suggest a change"
                          onClick={() => openSuggest(p)}
                          className="text-[var(--ink-muted)] hover:text-brand-600 print:hidden"
                        >
                          <MessageSquarePlus size={15} strokeWidth={1.75} />
                        </button>
                      </div>
                      <p className="mt-1 font-medium text-[var(--ink-primary)]">
                        {p.classes ? `${p.classes.name} - ${p.classes.section}` : "—"}
                      </p>
                      <p className="text-sm text-[var(--ink-secondary)]">{p.subjects?.name ?? "—"}</p>
                      {p.room_number && <p className="text-xs text-[var(--ink-muted)]">Room {p.room_number}</p>}
                    </div>
                  ))}
                </div>
              </Card>
            );
          })}
        </div>
      )}

      <Modal isOpen={!!suggestTarget} onClose={() => setSuggestTarget(null)} title="Suggest a timetable change">
        <form className="space-y-4" onSubmit={handleSubmit((values) => suggestMutation.mutate(values))} noValidate>
          <p className="text-sm text-[var(--ink-muted)]">
            This sends a suggestion to the admin — it won't change your timetable until they review and apply it.
          </p>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Input label="Proposed start time" type="time" {...register("start_time")} />
            <Input label="Proposed end time" type="time" {...register("end_time")} />
          </div>
          <Input label="Proposed room" {...register("room_number")} />
          <Textarea
            label="Reason"
            rows={3}
            error={errors.reason?.message}
            {...register("reason", { required: "Please explain the reason for this change" })}
          />
          {suggestMutation.isError && (
            <p className="text-sm text-red-600">{getApiErrorMessage(suggestMutation.error, "Failed to submit suggestion.")}</p>
          )}
          <Button type="submit" className="w-full" isLoading={isSubmitting || suggestMutation.isPending}>
            Send suggestion
          </Button>
        </form>
      </Modal>
    </div>
  );
}
