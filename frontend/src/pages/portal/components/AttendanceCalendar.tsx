import { ChevronLeft, ChevronRight } from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";
import { buildCalendarGrid, MONTH_LABELS, WEEKDAY_LABELS } from "@/utils/date";
import { AttendanceCalendarRecord } from "@/types/portal.types";
import { AttendanceStatus } from "@/types/dashboard.types";

interface AttendanceCalendarProps {
  year: number;
  month: number;
  records: AttendanceCalendarRecord[];
  onMonthChange: (year: number, month: number) => void;
}

const STATUS_DOT: Partial<Record<AttendanceStatus, string>> = {
  present: "bg-emerald-500",
  absent: "bg-red-500",
  leave: "bg-blue-500",
  late: "bg-amber-500",
  half_day: "bg-amber-500",
  excused: "bg-slate-400",
};

const LEGEND: { status: AttendanceStatus; label: string }[] = [
  { status: "present", label: "Present" },
  { status: "absent", label: "Absent" },
  { status: "leave", label: "Leave" },
  { status: "late", label: "Late / Half day" },
  { status: "excused", label: "Excused" },
];

/** Color-coded month calendar for a student's attendance history — reuses the shared calendar-grid math from utils/date.ts (the same helper DatePicker.tsx uses). Cross-fades between months via AnimatePresence instead of swapping the grid instantly. */
export function AttendanceCalendar({ year, month, records, onMonthChange }: AttendanceCalendarProps) {
  const cells = buildCalendarGrid(year, month);
  const byDate = new Map(records.map((r) => [r.date, r.status]));
  const today = new Date();
  const todayIso = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;

  function goPrev() {
    onMonthChange(month === 0 ? year - 1 : year, month === 0 ? 11 : month - 1);
  }
  function goNext() {
    onMonthChange(month === 11 ? year + 1 : year, month === 11 ? 0 : month + 1);
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={goPrev}
          className="rounded-lg p-1.5 text-[var(--ink-muted)] transition-colors hover:bg-black/[0.04] dark:hover:bg-white/[0.06]"
          aria-label="Previous month"
        >
          <ChevronLeft size={18} strokeWidth={1.75} />
        </button>
        <h3 className="text-sm font-semibold text-[var(--ink-primary)]">
          {MONTH_LABELS[month]} {year}
        </h3>
        <button
          type="button"
          onClick={goNext}
          className="rounded-lg p-1.5 text-[var(--ink-muted)] transition-colors hover:bg-black/[0.04] dark:hover:bg-white/[0.06]"
          aria-label="Next month"
        >
          <ChevronRight size={18} strokeWidth={1.75} />
        </button>
      </div>

      <AnimatePresence mode="wait">
        <motion.div
          key={`${year}-${month}`}
          initial={{ opacity: 0, x: 12 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -12 }}
          transition={{ duration: 0.18, ease: "easeOut" }}
          className="grid grid-cols-7 gap-1.5 text-center"
        >
          {WEEKDAY_LABELS.map((label) => (
            <div key={label} className="text-xs font-medium text-[var(--ink-muted)]">
              {label}
            </div>
          ))}
          {cells.map((cell) => {
            const status = byDate.get(cell.iso);
            const dotClass = status ? STATUS_DOT[status] ?? "bg-slate-300" : undefined;
            return (
              <div
                key={cell.iso}
                className={`flex aspect-square flex-col items-center justify-center gap-0.5 rounded-lg text-xs
                  ${cell.isCurrentMonth ? "text-[var(--ink-primary)]" : "text-[var(--ink-muted)] opacity-40"}`}
                style={cell.iso === todayIso ? { boxShadow: "0 0 0 2px var(--portal-accent)" } : undefined}
              >
                <span>{cell.date}</span>
                {status && cell.isCurrentMonth && <span className={`h-1.5 w-1.5 rounded-full ${dotClass}`} />}
              </div>
            );
          })}
        </motion.div>
      </AnimatePresence>

      <div className="flex flex-wrap gap-x-4 gap-y-1.5 border-t pt-3" style={{ borderColor: "var(--portal-glass-border)" }}>
        {LEGEND.map(({ status, label }) => (
          <span key={status} className="flex items-center gap-1.5 text-xs text-[var(--ink-muted)]">
            <span className={`h-1.5 w-1.5 rounded-full ${STATUS_DOT[status]}`} />
            {label}
          </span>
        ))}
      </div>
    </div>
  );
}
