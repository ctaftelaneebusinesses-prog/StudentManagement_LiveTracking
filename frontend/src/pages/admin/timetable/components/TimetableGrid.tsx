import { Fragment } from "react";
import { CalendarPlus, Sparkles } from "lucide-react";
import { SCHOOL_WEEK_DAYS, TimetablePeriodEntry, WEEKDAY_NAMES } from "@/types/timetable.types";

/** Stable per-subject/activity accent from the shared categorical palette — used as an identity marker beside the text, never on the text itself. */
function subjectAccentColor(id: string | null): string {
  if (!id) return "var(--ink-muted)";
  let hash = 0;
  for (let i = 0; i < id.length; i++) hash = (hash * 31 + id.charCodeAt(i)) | 0;
  const idx = (Math.abs(hash) % 8) + 1;
  return `var(--series-${idx})`;
}

export function TimetableGridSkeleton() {
  return (
    <div className="overflow-x-auto">
      <div
        className="grid min-w-[820px] gap-2"
        style={{ gridTemplateColumns: `88px repeat(${SCHOOL_WEEK_DAYS.length}, minmax(120px, 1fr))` }}
      >
        <div />
        {SCHOOL_WEEK_DAYS.map((day) => (
          <div key={day} className="mb-1 h-4 animate-pulse rounded bg-black/[0.06] dark:bg-white/[0.06]" />
        ))}
        {Array.from({ length: 6 }, (_, row) => (
          <Fragment key={row}>
            <div className="mb-2 h-10 animate-pulse rounded bg-black/[0.06] dark:bg-white/[0.06]" />
            {SCHOOL_WEEK_DAYS.map((day) => (
              <div
                key={day}
                className="mb-2 min-h-[64px] animate-pulse rounded-lg bg-black/[0.04] dark:bg-white/[0.04]"
              />
            ))}
          </Fragment>
        ))}
      </div>
    </div>
  );
}

interface TimetableGridProps {
  periodNumbers: number[];
  getCell: (periodNo: number, dayOfWeek: number) => TimetablePeriodEntry | undefined;
  onCellClick: (periodNo: number, dayOfWeek: number) => void;
}

export function TimetableGrid({ periodNumbers, getCell, onCellClick }: TimetableGridProps) {
  return (
    <div className="overflow-x-auto">
      <div
        className="grid min-w-[820px] gap-2"
        style={{ gridTemplateColumns: `88px repeat(${SCHOOL_WEEK_DAYS.length}, minmax(120px, 1fr))` }}
      >
        <div />
        {SCHOOL_WEEK_DAYS.map((day) => (
          <div
            key={day}
            className="pb-1 text-center text-xs font-semibold uppercase tracking-wide text-[var(--ink-muted)]"
          >
            {WEEKDAY_NAMES[day].slice(0, 3)}
          </div>
        ))}

        {periodNumbers.map((periodNo) => {
          const rowSample = SCHOOL_WEEK_DAYS.map((d) => getCell(periodNo, d)).find(Boolean);
          return (
            <Fragment key={periodNo}>
              <div className="flex flex-col justify-center pb-2 pr-2 text-right">
                <span className="text-xs font-semibold text-[var(--ink-primary)]">Period {periodNo}</span>
                {rowSample && (
                  <span className="text-[10px] text-[var(--ink-muted)]">
                    {rowSample.start_time.slice(0, 5)}–{rowSample.end_time.slice(0, 5)}
                  </span>
                )}
              </div>
              {SCHOOL_WEEK_DAYS.map((day) => {
                const cell = getCell(periodNo, day);
                return (
                  <button
                    key={day}
                    type="button"
                    onClick={() => onCellClick(periodNo, day)}
                    className={
                      cell
                        ? "group relative mb-2 flex min-h-[64px] flex-col justify-center gap-0.5 rounded-lg border border-black/[0.06] bg-white p-2.5 text-left shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md print:border-slate-300 print:shadow-none print:hover:translate-y-0 dark:border-white/[0.08] dark:bg-[#1c1c1f]"
                        : "group mb-2 flex min-h-[64px] items-center justify-center rounded-lg border border-dashed border-black/10 text-[var(--ink-muted)] transition-colors hover:border-accent-400 hover:bg-accent-50/50 hover:text-accent-600 print:border-none dark:border-white/10 dark:hover:bg-accent-500/5"
                    }
                  >
                    {cell ? (
                      <>
                        <span
                          className="absolute inset-y-1.5 left-0 w-[3px] rounded-full print:hidden"
                          style={{
                            backgroundColor: subjectAccentColor(
                              cell.period_type === "extracurricular" ? cell.activity_id : cell.subject_id
                            ),
                          }}
                        />
                        <span className="flex items-center gap-1 truncate pl-1.5 text-[13px] font-semibold text-[var(--ink-primary)] print:pl-0 print:text-black">
                          {cell.period_type === "extracurricular" && (
                            <Sparkles size={11} strokeWidth={2} className="shrink-0 text-accent-500 print:hidden" />
                          )}
                          {cell.period_type === "extracurricular" ? (cell.activities?.name ?? "Activity") : (cell.subjects?.name ?? "Untitled")}
                        </span>
                        {cell.users?.full_name && (
                          <span className="truncate pl-1.5 text-xs text-[var(--ink-secondary)] print:pl-0 print:text-black">
                            {cell.users.full_name}
                          </span>
                        )}
                        {cell.room_number && (
                          <span className="mt-0.5 ml-1.5 inline-flex w-fit items-center rounded-full bg-black/[0.04] px-1.5 py-0.5 text-[10px] font-medium text-[var(--ink-muted)] print:ml-0 print:bg-transparent print:text-black dark:bg-white/[0.06]">
                            Room {cell.room_number}
                          </span>
                        )}
                      </>
                    ) : (
                      <CalendarPlus size={16} className="opacity-0 transition-opacity group-hover:opacity-100" />
                    )}
                  </button>
                );
              })}
            </Fragment>
          );
        })}
      </div>
    </div>
  );
}
