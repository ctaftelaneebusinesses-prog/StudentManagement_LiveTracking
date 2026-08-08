import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { ChartTooltip } from "@/pages/admin/dashboard/components/ChartTooltip";
import { TeacherClassSummary } from "@/types/teacher.types";

/** Magnitude across a handful of categories (one bar per class) — a single series, so one hue and no legend box (the card title already names it). */
export function ClassSizeChart({ classes }: { classes: TeacherClassSummary[] }) {
  const data = classes.map((c) => ({ label: `${c.name}-${c.section}`, students: c.studentCount }));

  return (
    <ResponsiveContainer width="100%" height={180}>
      <BarChart data={data} margin={{ top: 4, right: 8, left: -12, bottom: 0 }}>
        <CartesianGrid vertical={false} stroke="var(--gridline)" />
        <XAxis
          dataKey="label"
          tickLine={false}
          axisLine={{ stroke: "var(--baseline)" }}
          tick={{ fill: "var(--ink-muted)", fontSize: 11 }}
        />
        <YAxis tickLine={false} axisLine={false} tick={{ fill: "var(--ink-muted)", fontSize: 12 }} width={28} allowDecimals={false} />
        <Tooltip cursor={{ fill: "var(--gridline)", opacity: 0.4 }} content={<ChartTooltip />} />
        <Bar
          dataKey="students"
          name="Students"
          fill="var(--series-1)"
          radius={[4, 4, 0, 0]}
          maxBarSize={36}
          isAnimationActive={false}
        />
      </BarChart>
    </ResponsiveContainer>
  );
}
