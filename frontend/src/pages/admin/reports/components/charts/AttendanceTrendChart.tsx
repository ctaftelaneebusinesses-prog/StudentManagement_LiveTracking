import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { AttendanceTrendPoint } from "@/types/reportsHub.types";
import { ChartTooltip } from "@/pages/admin/dashboard/components/ChartTooltip";

export function AttendanceTrendChart({ data }: { data: AttendanceTrendPoint[] }) {
  return (
    <ResponsiveContainer width="100%" height={240}>
      <LineChart data={data} margin={{ top: 4, right: 4, left: -12, bottom: 0 }}>
        <CartesianGrid vertical={false} stroke="var(--gridline)" strokeDasharray="0" />
        <XAxis
          dataKey="attendance_date"
          tickLine={false}
          axisLine={{ stroke: "var(--baseline)" }}
          tick={{ fill: "var(--ink-muted)", fontSize: 11 }}
        />
        <YAxis
          domain={[0, 100]}
          tickLine={false}
          axisLine={false}
          tick={{ fill: "var(--ink-muted)", fontSize: 12 }}
          tickFormatter={(v: number) => `${v}%`}
          width={40}
        />
        <Tooltip
          cursor={{ stroke: "var(--gridline)" }}
          content={<ChartTooltip formatValue={(v) => `${v}%`} />}
        />
        <Line
          type="monotone"
          dataKey="present_pct"
          name="Present %"
          stroke="var(--series-1)"
          strokeWidth={2}
          dot={false}
          isAnimationActive={false}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}
