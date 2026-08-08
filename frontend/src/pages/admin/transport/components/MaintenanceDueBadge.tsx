export function MaintenanceDueBadge({ nextDueDate }: { nextDueDate: string | null }) {
  if (!nextDueDate) return <span className="text-[var(--ink-muted)]">—</span>;

  const daysUntilDue = Math.round((new Date(nextDueDate).getTime() - Date.now()) / 86_400_000);
  const isOverdue = daysUntilDue < 0;
  const isUpcoming = daysUntilDue >= 0 && daysUntilDue <= 14;

  const style = isOverdue
    ? "bg-[var(--status-serious)]/10 text-[var(--status-serious)]"
    : isUpcoming
      ? "bg-[var(--status-warning)]/10 text-[var(--status-warning)]"
      : "bg-[var(--status-good)]/10 text-[var(--status-good)]";

  const label = isOverdue ? `Overdue by ${Math.abs(daysUntilDue)}d` : isUpcoming ? `Due in ${daysUntilDue}d` : `Due ${nextDueDate}`;

  return <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold ${style}`}>{label}</span>;
}
