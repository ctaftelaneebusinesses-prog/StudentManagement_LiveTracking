const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

/** "2026-06-01" -> "01 June 2026". Returns "" for empty/invalid input. */
export function formatDisplayDate(iso: string): string {
  if (!iso) return "";
  const [year, month, day] = iso.split("-").map(Number);
  if (!year || !month || !day) return "";
  return `${String(day).padStart(2, "0")} ${MONTH_NAMES[month - 1]} ${year}`;
}

/** Local y/m/d -> "YYYY-MM-DD", avoiding UTC-shift bugs from toISOString(). */
export function toIsoDate(year: number, month: number, day: number): string {
  return `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

export interface CalendarDay {
  date: number;
  iso: string;
  isCurrentMonth: boolean;
}

/** Full 6-row (42-cell) calendar grid for the given month, including leading/trailing days from adjacent months. */
export function buildCalendarGrid(year: number, month: number): CalendarDay[] {
  const firstOfMonth = new Date(year, month, 1);
  const startOffset = firstOfMonth.getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const daysInPrevMonth = new Date(year, month, 0).getDate();

  const cells: CalendarDay[] = [];

  for (let i = startOffset - 1; i >= 0; i--) {
    const date = daysInPrevMonth - i;
    const prevMonth = month === 0 ? 11 : month - 1;
    const prevYear = month === 0 ? year - 1 : year;
    cells.push({ date, iso: toIsoDate(prevYear, prevMonth, date), isCurrentMonth: false });
  }

  for (let date = 1; date <= daysInMonth; date++) {
    cells.push({ date, iso: toIsoDate(year, month, date), isCurrentMonth: true });
  }

  const nextMonth = month === 11 ? 0 : month + 1;
  const nextYear = month === 11 ? year + 1 : year;
  let nextDate = 1;
  while (cells.length < 42) {
    cells.push({ date: nextDate, iso: toIsoDate(nextYear, nextMonth, nextDate), isCurrentMonth: false });
    nextDate++;
  }

  return cells;
}

export const WEEKDAY_LABELS = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];
export const MONTH_LABELS = MONTH_NAMES;

/** Leave applications close for "today" at 6 PM local time — after that, only tomorrow onwards is selectable. Mirrors backend/src/utils/leaveDate.ts exactly. */
export const LEAVE_CUTOFF_HOUR = 18;

/** True once today's date itself is no longer selectable for a new leave application (past the 6 PM cutoff). */
export function isLeaveCutoffPassed(now: Date = new Date()): boolean {
  return now.getHours() >= LEAVE_CUTOFF_HOUR;
}

/** Earliest selectable leave-application date: today, or tomorrow once the 6 PM cutoff has passed. */
export function getMinLeaveDate(now: Date = new Date()): string {
  const d = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  if (isLeaveCutoffPassed(now)) d.setDate(d.getDate() + 1);
  return toIsoDate(d.getFullYear(), d.getMonth(), d.getDate());
}
