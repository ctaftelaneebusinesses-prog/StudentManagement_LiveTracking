interface TooltipPayloadEntry {
  name?: string;
  value?: number | string;
  color?: string;
  dataKey?: string | number;
}

interface ChartTooltipProps {
  active?: boolean;
  label?: string | number;
  payload?: TooltipPayloadEntry[];
  formatValue?: (value: number | string, key?: string | number) => string;
}

export function ChartTooltip({ active, label, payload, formatValue }: ChartTooltipProps) {
  if (!active || !payload || payload.length === 0) return null;

  return (
    <div className="rounded-lg border border-black/[0.06] bg-white px-3 py-2 text-xs shadow-lg dark:border-white/[0.1] dark:bg-[#1f1f22]">
      {label !== undefined && <p className="mb-1 font-medium text-[var(--ink-primary)]">{label}</p>}
      <div className="space-y-0.5">
        {payload.map((entry, i) => (
          <div key={i} className="flex items-center gap-1.5">
            <span className="h-1.5 w-1.5 shrink-0 rounded-full" style={{ backgroundColor: entry.color }} />
            <span className="text-[var(--ink-secondary)]">{entry.name}:</span>
            <span className="font-medium text-[var(--ink-primary)]">
              {entry.value !== undefined
                ? formatValue
                  ? formatValue(entry.value, entry.dataKey)
                  : entry.value
                : "—"}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
