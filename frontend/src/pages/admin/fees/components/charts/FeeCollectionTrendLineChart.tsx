import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { SeriesPoint } from "@/types/adminDashboard.types";
import { ChartTooltip } from "@/pages/admin/dashboard/components/ChartTooltip";
import { formatCompactCurrency } from "@/pages/admin/dashboard/utils/format";

export function FeeCollectionTrendLineChart({ data }: { data: SeriesPoint[] }) {
  return (
    <ResponsiveContainer width="100%" height={240}>
      <LineChart data={data} margin={{ top: 4, right: 8, left: -12, bottom: 0 }}>
        <CartesianGrid vertical={false} stroke="var(--gridline)" />
        <XAxis
          dataKey="label"
          tickLine={false}
          axisLine={{ stroke: "var(--baseline)" }}
          tick={{ fill: "var(--ink-muted)", fontSize: 11 }}
          interval={4}
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
        <Line
          type="monotone"
          dataKey="value"
          name="Collected"
          stroke="var(--series-2)"
          strokeWidth={2}
          dot={false}
          activeDot={{ r: 4 }}
          isAnimationActive={false}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}
