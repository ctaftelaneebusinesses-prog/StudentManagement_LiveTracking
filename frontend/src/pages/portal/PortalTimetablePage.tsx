import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { CalendarClock } from "lucide-react";
import { usePortalStudentId } from "@/context/PortalStudentContext";
import * as timetableService from "@/services/portal/timetable.service";
import { DAY_NAMES } from "@/types/dashboard.types";
import { PortalGlassCard } from "./components/ui/PortalGlassCard";
import { PortalSkeleton } from "./components/ui/PortalSkeleton";
import { PortalEmptyState } from "./components/ui/PortalEmptyState";
import { staggerContainer } from "./components/ui/portalMotion";

export function PortalTimetablePage() {
  const studentId = usePortalStudentId();
  const { data, isLoading } = useQuery({
    queryKey: ["portal", "timetable", studentId],
    queryFn: () => timetableService.fetchWeeklyTimetable(studentId),
    enabled: !!studentId,
  });

  return (
    <div className="space-y-6">
      <div className="border-l-4 pl-4" style={{ borderColor: "var(--portal-accent)" }}>
        <h1 className="text-2xl font-semibold text-[var(--ink-primary)]">Timetable</h1>
        <p className="text-sm text-[var(--ink-muted)]">This week's class schedule, published by the school.</p>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <PortalSkeleton key={i} className="h-40 w-full" />
          ))}
        </div>
      ) : !data?.length ? (
        <PortalGlassCard noHover>
          <PortalEmptyState
            title="No timetable published yet"
            description="Your class teacher hasn't published a timetable yet."
            icon={CalendarClock}
          />
        </PortalGlassCard>
      ) : (
        <motion.div variants={staggerContainer} initial="hidden" animate="show" className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {data.map((day) => (
            <PortalGlassCard key={day.dayOfWeek} className="space-y-3">
              <h2 className="text-sm font-semibold text-[var(--ink-primary)]">{DAY_NAMES[day.dayOfWeek]}</h2>
              {day.periods.length === 0 ? (
                <p className="text-xs text-[var(--ink-muted)]">No periods scheduled.</p>
              ) : (
                <ul className="space-y-1.5">
                  {day.periods.map((period) => (
                    <li
                      key={period.id}
                      className="flex items-center justify-between rounded-lg border px-3 py-2 text-sm"
                      style={{ borderColor: "var(--portal-glass-border)" }}
                    >
                      <span className="text-[var(--ink-muted)]">
                        {period.start_time.slice(0, 5)}–{period.end_time.slice(0, 5)}
                      </span>
                      <div className="text-right">
                        <p className="font-medium text-[var(--ink-primary)]">{period.subjects?.name ?? "—"}</p>
                        {period.users?.full_name && <p className="text-xs text-[var(--ink-muted)]">{period.users.full_name}</p>}
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </PortalGlassCard>
          ))}
        </motion.div>
      )}
    </div>
  );
}
