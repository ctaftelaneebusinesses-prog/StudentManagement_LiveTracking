import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { SeriesPoint } from "@/types/adminDashboard.types";
import { ChartTooltip } from "../ChartTooltip";
import { formatCompactCurrency } from "../../utils/format";

export function FeeTrendAreaChart({ data }: { data: SeriesPoint[] }) {
  return (
    <ResponsiveContainer width="100%" height={224}>
      <AreaChart data={data} margin={{ top: 4, right: 8, left: -12, bottom: 0 }}>
        <defs>
          <linearGradient id="fee-trend-fill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--series-1)" stopOpacity={0.18} />
            <stop offset="100%" stopColor="var(--series-1)" stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid vertical={false} stroke="var(--gridline)" />
        <XAxis
          dataKey="label"
          tickLine={false}
          axisLine={{ stroke: "var(--baseline)" }}
          tick={{ fill: "var(--ink-muted)", fontSize: 12 }}
        />
        <YAxis
          tickLine={false}
          axisLine={false}
          tick={{ fill: "var(--ink-muted)", fontSize: 12 }}
          tickFormatter={(v: number) => formatCompactCurrency(v)}
          width={52}
        />
        <Tooltip
          content={<ChartTooltip formatValue={(v) => formatCompactCurrency(Number(v))} />}
          cursor={{ stroke: "var(--baseline)", strokeWidth: 1 }}
        />
        <Area
          type="monotone"
          dataKey="value"
          name="Cumulative fees"
          stroke="var(--series-1)"
          strokeWidth={2}
          fill="url(#fee-trend-fill)"
          isAnimationActive={false}
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}
