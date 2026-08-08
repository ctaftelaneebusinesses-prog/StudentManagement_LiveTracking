import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { SeriesPoint } from "@/types/adminDashboard.types";
import { ChartTooltip } from "../ChartTooltip";

export function AttendanceLineChart({ data }: { data: SeriesPoint[] }) {
  return (
    <ResponsiveContainer width="100%" height={224}>
      <LineChart data={data} margin={{ top: 4, right: 8, left: -12, bottom: 0 }}>
        <CartesianGrid vertical={false} stroke="var(--gridline)" />
        <XAxis
          dataKey="label"
          tickLine={false}
          axisLine={{ stroke: "var(--baseline)" }}
          tick={{ fill: "var(--ink-muted)", fontSize: 12 }}
        />
        <YAxis
          domain={[70, 100]}
          ticks={[70, 80, 90, 100]}
          tickLine={false}
          axisLine={false}
          tick={{ fill: "var(--ink-muted)", fontSize: 12 }}
          tickFormatter={(v: number) => `${v}%`}
          width={40}
        />
        <Tooltip
          content={<ChartTooltip formatValue={(v) => `${v}%`} />}
          cursor={{ stroke: "var(--baseline)", strokeWidth: 1 }}
        />
        <Line
          type="monotone"
          dataKey="value"
          name="Attendance"
          stroke="var(--series-1)"
          strokeWidth={2}
          dot={false}
          activeDot={{ r: 5, strokeWidth: 2, stroke: "var(--surface)" }}
          isAnimationActive={false}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}
