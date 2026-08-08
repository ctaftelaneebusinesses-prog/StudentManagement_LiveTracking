import type { LucideIcon } from "lucide-react";
import { useCountUp } from "@/hooks/useCountUp";

interface PlatformStatCardProps {
  label: string;
  value: number;
  icon: LucideIcon;
  /** Small qualifier under the number, e.g. "of 12 active". */
  hint?: string;
  /** Accent hue — keeps related cards visually grouped without inventing a new color system. */
  tone?: "accent" | "emerald" | "amber" | "rose" | "sky" | "violet";
  entranceDelayMs?: number;
  onClick?: () => void;
}

const TONE_STYLES: Record<NonNullable<PlatformStatCardProps["tone"]>, string> = {
  accent: "bg-accent-50 text-accent-600 group-hover:bg-accent-100 dark:bg-accent-900/40 dark:text-accent-300",
  emerald: "bg-emerald-50 text-emerald-600 group-hover:bg-emerald-100 dark:bg-emerald-900/30 dark:text-emerald-300",
  amber: "bg-amber-50 text-amber-600 group-hover:bg-amber-100 dark:bg-amber-900/30 dark:text-amber-300",
  rose: "bg-rose-50 text-rose-600 group-hover:bg-rose-100 dark:bg-rose-900/30 dark:text-rose-300",
  sky: "bg-sky-50 text-sky-600 group-hover:bg-sky-100 dark:bg-sky-900/30 dark:text-sky-300",
  violet: "bg-violet-50 text-violet-600 group-hover:bg-violet-100 dark:bg-violet-900/30 dark:text-violet-300",
};

/**
 * Platform-tier stat tile. Mirrors the school console's StatCard geometry and
 * motion so the two dashboards feel like one product, minus the sparkline and
 * trend chip — the platform has no per-period baseline to trend against yet,
 * and a fabricated one would be worse than none.
 */
export function PlatformStatCard({
  label,
  value,
  icon: Icon,
  hint,
  tone = "accent",
  entranceDelayMs,
  onClick,
}: PlatformStatCardProps) {
  const animated = useCountUp(value);

  return (
    <div
      role={onClick ? "button" : undefined}
      tabIndex={onClick ? 0 : undefined}
      onClick={onClick}
      onKeyDown={
        onClick
          ? (e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                onClick();
              }
            }
          : undefined
      }
      style={entranceDelayMs ? { animationDelay: `${entranceDelayMs}ms` } : undefined}
      className={`group relative animate-slide-up overflow-hidden rounded-2xl border border-black/[0.06] bg-white p-5
        shadow-sm transition-all duration-200 ease-out hover:-translate-y-1 hover:border-accent-200
        hover:shadow-card-hover dark:border-white/[0.08] dark:bg-[#17171a] dark:hover:border-accent-800
        ${onClick ? "cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-accent-400" : ""}`}
    >
      <div className="flex min-w-0 items-center gap-2.5">
        <span
          className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl transition-colors duration-200 ${TONE_STYLES[tone]}`}
        >
          <Icon size={18} strokeWidth={1.75} />
        </span>
        <p title={label} className="truncate text-[13px] font-medium leading-tight text-[var(--ink-secondary)]">
          {label}
        </p>
      </div>

      <p className="mt-3 text-[26px] font-semibold leading-none text-[var(--ink-primary)]">
        {animated.toLocaleString("en-IN")}
      </p>
      {hint && <p className="mt-1.5 text-xs text-[var(--ink-muted)]">{hint}</p>}
    </div>
  );
}
