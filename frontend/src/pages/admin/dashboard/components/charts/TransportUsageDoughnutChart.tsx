import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";
import { CategorySlice } from "@/types/adminDashboard.types";
import { ChartTooltip } from "../ChartTooltip";
import { ChartLegend } from "../ChartLegend";

const STATUS_COLORS: Record<string, string> = {
  "On Route": "var(--status-good)",
  Idle: "var(--status-warning)",
  Maintenance: "var(--status-serious)",
  "Off Duty": "var(--ink-muted)",
};

export function TransportUsageDoughnutChart({ data }: { data: CategorySlice[] }) {
  const total = data.reduce((sum, d) => sum + d.value, 0);
  const colorFor = (label: string) => STATUS_COLORS[label] ?? "var(--series-1)";

  return (
    <div>
      <div className="relative">
        <ResponsiveContainer width="100%" height={196}>
          <PieChart>
            <Tooltip content={<ChartTooltip formatValue={(v) => `${v} vehicles`} />} />
            <Pie
              data={data}
              dataKey="value"
              nameKey="label"
              innerRadius={54}
              outerRadius={80}
              paddingAngle={3}
              isAnimationActive={false}
            >
              {data.map((entry) => (
                <Cell key={entry.label} fill={colorFor(entry.label)} stroke="var(--surface)" strokeWidth={2} />
              ))}
            </Pie>
          </PieChart>
        </ResponsiveContainer>
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-xl font-semibold text-[var(--ink-primary)]">{total}</span>
          <span className="text-[11px] text-[var(--ink-muted)]">vehicles</span>
        </div>
      </div>
      <div className="mt-2">
        <ChartLegend items={data.map((d) => ({ label: d.label, color: colorFor(d.label) }))} />
      </div>
    </div>
  );
}
