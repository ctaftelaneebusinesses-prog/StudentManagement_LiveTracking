import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Clock, MapPin } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Skeleton } from "@/components/ui/Skeleton";
import { EmptyState } from "@/components/ui/EmptyState";
import * as portalService from "@/services/extracurricularPortal.service";
import { ExtracurricularScheduleSlot } from "@/types/extracurricularPortal.types";
import { formatTime } from "./utils";

const DAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

export function ExtracurricularSchedulePage() {
  const { data, isLoading } = useQuery({
    queryKey: ["extracurricular", "schedule", "weekly"],
    queryFn: portalService.fetchWeeklySchedule,
  });

  const byDay = useMemo(() => {
    const groups = new Map<number, ExtracurricularScheduleSlot[]>();
    for (let d = 0; d < 7; d++) groups.set(d, []);
    for (const slot of data ?? []) {
      groups.get(slot.day_of_week)?.push(slot);
    }
    return groups;
  }, [data]);

  const today = new Date().getDay();

  return (
    <div className="animate-fade-in space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-[var(--ink-primary)]">Weekly Schedule</h1>
        <p className="text-sm text-[var(--ink-muted)]">Your recurring sessions across every batch you run.</p>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-40 w-full" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {DAY_NAMES.map((name, day) => {
            const slots = (byDay.get(day) ?? []).sort((a, b) => a.start_time.localeCompare(b.start_time));
            const isToday = day === today;
            return (
              <Card key={day} className={`space-y-3 ${isToday ? "ring-2 ring-amber-500" : ""}`}>
                <div className="flex items-center justify-between">
                  <h2 className="text-sm font-semibold text-[var(--ink-primary)]">{name}</h2>
                  {isToday && (
                    <span className="rounded-full bg-amber-500/10 px-2 py-0.5 text-[11px] font-semibold text-amber-600 dark:text-amber-400">
                      Today
                    </span>
                  )}
                </div>
                {slots.length === 0 ? (
                  <p className="text-xs text-[var(--ink-muted)]">No sessions scheduled.</p>
                ) : (
                  <ul className="space-y-2">
                    {slots.map((slot) => {
                      const batch = slot.extracurricular_batches;
                      return (
                        <li key={slot.id} className="rounded-lg border border-black/[0.06] p-3 dark:border-white/[0.08]">
                          <p className="text-sm font-medium text-[var(--ink-primary)]">{batch?.activities?.name ?? "Activity"}</p>
                          {batch?.classes && (
                            <p className="text-xs text-[var(--ink-muted)]">
                              {batch.classes.name} - {batch.classes.section}
                              {batch.name ? ` · ${batch.name}` : ""}
                            </p>
                          )}
                          <div className="mt-1.5 flex flex-wrap items-center gap-3 text-xs text-[var(--ink-secondary)]">
                            <span className="inline-flex items-center gap-1">
                              <Clock size={12} strokeWidth={1.75} className="text-[var(--ink-muted)]" />
                              {formatTime(slot.start_time)} – {formatTime(slot.end_time)}
                            </span>
                            {slot.venue && (
                              <span className="inline-flex items-center gap-1">
                                <MapPin size={12} strokeWidth={1.75} className="text-[var(--ink-muted)]" />
                                {slot.venue}
                              </span>
                            )}
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </Card>
            );
          })}
        </div>
      )}

      {!isLoading && (data ?? []).length === 0 && (
        <Card>
          <EmptyState title="No schedule slots yet" description="Once the admin sets up your schedule, sessions will appear here." />
        </Card>
      )}
    </div>
  );
}
