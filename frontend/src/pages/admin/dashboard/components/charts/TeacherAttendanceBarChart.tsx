import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { MultiSeriesPoint } from "@/types/adminDashboard.types";
import { ChartTooltip } from "../ChartTooltip";
import { ChartLegend } from "../ChartLegend";

const SERIES = [
  { key: "present", name: "Present", color: "var(--status-good)" },
  { key: "onLeave", name: "On leave", color: "var(--status-warning)" },
  { key: "absent", name: "Absent", color: "var(--status-critical)" },
];

export function TeacherAttendanceBarChart({ data }: { data: MultiSeriesPoint[] }) {
  return (
    <div>
      <ResponsiveContainer width="100%" height={196}>
        <BarChart data={data} margin={{ top: 4, right: 8, left: -12, bottom: 0 }}>
          <CartesianGrid vertical={false} stroke="var(--gridline)" />
          <XAxis
            dataKey="label"
            tickLine={false}
            axisLine={{ stroke: "var(--baseline)" }}
            tick={{ fill: "var(--ink-muted)", fontSize: 12 }}
          />
          <YAxis tickLine={false} axisLine={false} tick={{ fill: "var(--ink-muted)", fontSize: 12 }} width={32} />
          <Tooltip cursor={{ fill: "var(--gridline)", opacity: 0.4 }} content={<ChartTooltip />} />
          {SERIES.map((s, i) => (
            <Bar
              key={s.key}
              dataKey={s.key}
              name={s.name}
              stackId="teachers"
              fill={s.color}
              stroke="var(--surface)"
              strokeWidth={1}
              radius={i === SERIES.length - 1 ? [4, 4, 0, 0] : [0, 0, 0, 0]}
              maxBarSize={24}
              isAnimationActive={false}
            />
          ))}
        </BarChart>
      </ResponsiveContainer>
      <div className="mt-2">
        <ChartLegend items={SERIES.map((s) => ({ label: s.name, color: s.color }))} />
      </div>
    </div>
  );
}
