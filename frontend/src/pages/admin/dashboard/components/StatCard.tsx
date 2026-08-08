import { Minus, TrendingDown, TrendingUp } from "lucide-react";
import { Area, AreaChart, ResponsiveContainer } from "recharts";
import { useNavigate } from "react-router-dom";
import { StatCardData } from "@/types/adminDashboard.types";
import { STAT_ICONS } from "./statIcons";
import { STAT_CARD_ROUTES } from "./statRoutes";
import { useCountUp } from "@/hooks/useCountUp";

interface StatCardProps {
  data: StatCardData;
  /** Entrance-animation delay in ms, staggered per card position in the grid. */
  entranceDelayMs?: number;
  /** Briefly pulses the card's ring to draw attention (e.g. arriving via a "focus" deep link). */
  highlighted?: boolean;
}

function formatValue(data: StatCardData, animatedValue: number): string {
  if (data.displayValue) return data.displayValue;
  return animatedValue.toLocaleString("en-IN");
}

export function StatCard({ data, entranceDelayMs, highlighted }: StatCardProps) {
  const navigate = useNavigate();
  const Icon = STAT_ICONS[data.icon] ?? Minus;
  const { direction, percent, upIsGood } = data.trend;
  const isGood = direction === "flat" ? null : (direction === "up") === upIsGood;
  const TrendIcon = direction === "up" ? TrendingUp : direction === "down" ? TrendingDown : Minus;
  const animatedValue = useCountUp(data.value);

  const trendColorClass =
    isGood === null
      ? "text-[var(--ink-muted)] bg-black/5 dark:bg-white/5"
      : isGood
        ? "text-[var(--delta-good)] bg-emerald-500/10"
        : "text-[var(--delta-bad)] bg-red-500/10";

  const sparkData = data.spark.map((value, i) => ({ i, value }));

  const route = STAT_CARD_ROUTES[data.id];

  function handleActivate() {
    if (route) navigate(route);
  }

  return (
    <div
      role={route ? "button" : undefined}
      tabIndex={route ? 0 : undefined}
      onClick={route ? handleActivate : undefined}
      onKeyDown={
        route
          ? (e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                handleActivate();
              }
            }
          : undefined
      }
      style={entranceDelayMs ? { animationDelay: `${entranceDelayMs}ms` } : undefined}
      className={`group relative animate-slide-up overflow-hidden rounded-2xl border border-black/[0.06] bg-white p-5
        shadow-sm transition-all duration-200 ease-out hover:-translate-y-1 hover:border-accent-200
        hover:shadow-card-hover dark:border-white/[0.08] dark:bg-[#17171a] dark:hover:border-accent-800
        ${route ? "cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-accent-400" : ""}
        ${highlighted ? "ring-2 ring-[var(--delta-bad)]" : ""}`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2.5">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-accent-50 text-accent-600 transition-colors duration-200 group-hover:bg-accent-100 dark:bg-accent-900/40 dark:text-accent-300 dark:group-hover:bg-accent-900/60">
            <Icon size={18} strokeWidth={1.75} />
          </span>
          <p title={data.label} className="truncate text-[13px] font-medium leading-tight text-[var(--ink-secondary)]">
            {data.label}
          </p>
        </div>
        {percent > 0 && (
          <span
            className={`flex shrink-0 items-center gap-1 rounded-full px-2 py-1 text-[11px] font-semibold ${trendColorClass}`}
          >
            <TrendIcon size={12} strokeWidth={2.25} />
            {`${percent.toFixed(1)}%`}
          </span>
        )}
      </div>

      <p className="mt-3 text-[26px] font-semibold leading-none text-[var(--ink-primary)]">
        {formatValue(data, animatedValue)}
      </p>
      <p className="mt-1.5 text-xs text-[var(--ink-muted)]">{data.description}</p>

      <div className="mt-3 h-9 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={sparkData} margin={{ top: 2, right: 0, bottom: 0, left: 0 }}>
            <defs>
              <linearGradient id={`spark-${data.id}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#0ea5a0" stopOpacity={0.32} />
                <stop offset="100%" stopColor="#0ea5a0" stopOpacity={0} />
              </linearGradient>
            </defs>
            <Area
              type="monotone"
              dataKey="value"
              stroke="#0ea5a0"
              strokeWidth={1.5}
              fill={`url(#spark-${data.id})`}
              isAnimationActive={false}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
