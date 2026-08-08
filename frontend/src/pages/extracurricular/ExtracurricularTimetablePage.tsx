import { useQuery } from "@tanstack/react-query";
import { CalendarClock, Printer, Sparkles } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Skeleton } from "@/components/ui/Skeleton";
import { EmptyState } from "@/components/ui/EmptyState";
import * as portalService from "@/services/extracurricularPortal.service";
import { DAY_NAMES } from "@/types/dashboard.types";

export function ExtracurricularTimetablePage() {
  const { data, isLoading } = useQuery({
    queryKey: ["extracurricular", "timetable", "weekly"],
    queryFn: portalService.fetchWeeklyTimetable,
  });

  const days = data ?? [];
  const hasAnyPeriods = days.some((d) => d.periods.length > 0);

  return (
    <div className="animate-fade-in space-y-6 print:space-y-2">
      <div className="flex flex-wrap items-center justify-between gap-3 print:hidden">
        <div>
          <h1 className="text-2xl font-semibold text-[var(--ink-primary)]">My Timetable</h1>
          <p className="text-sm text-[var(--ink-muted)]">Every period you've been assigned as instructor, across every class.</p>
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
        <EmptyState
          icon={CalendarClock}
          title="No periods scheduled"
          description="Once the admin assigns you as instructor for a timetable period, it will appear here."
        />
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
                    <div key={p.id} className="rounded-xl border border-black/[0.06] p-3 dark:border-white/[0.08]">
                      <span className="inline-flex items-center gap-1.5 text-xs font-medium text-[var(--ink-muted)]">
                        <CalendarClock size={13} strokeWidth={1.75} />
                        Period {p.period_no} · {p.start_time.slice(0, 5)}–{p.end_time.slice(0, 5)}
                      </span>
                      <p className="mt-1 font-medium text-[var(--ink-primary)]">
                        {p.classes ? `${p.classes.name} - ${p.classes.section}` : "—"}
                      </p>
                      <p className="flex items-center gap-1 text-sm text-[var(--ink-secondary)]">
                        <Sparkles size={12} strokeWidth={1.75} className="text-accent-500" />
                        {p.activities?.name ?? "—"}
                      </p>
                      {p.room_number && <p className="text-xs text-[var(--ink-muted)]">Room {p.room_number}</p>}
                    </div>
                  ))}
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
