export interface SelectOption {
  value: string;
  label: string;
}

/** "14:30" -> "2:30 PM". */
export function formatTime(time: string): string {
  const [h, m] = time.split(":").map(Number);
  if (Number.isNaN(h) || Number.isNaN(m)) return time;
  const period = h >= 12 ? "PM" : "AM";
  const hour12 = h % 12 === 0 ? 12 : h % 12;
  return `${hour12}:${String(m).padStart(2, "0")} ${period}`;
}

export function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}
