import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";
import type { PieLabelRenderProps } from "recharts";
import { CategorySlice } from "@/types/adminDashboard.types";
import { ChartTooltip } from "../ChartTooltip";
import { ChartLegend } from "../ChartLegend";
import { formatCompactNumber } from "../../utils/format";

const COLORS = ["var(--series-1)", "var(--series-2)", "var(--series-3)", "var(--series-4)", "var(--series-7)"];

export function ClassDistributionPieChart({ data }: { data: CategorySlice[] }) {
  const total = data.reduce((sum, d) => sum + d.value, 0);

  function renderLabel(props: PieLabelRenderProps) {
    const { cx, cy, midAngle, outerRadius, value } = props;
    const share = Number(value) / total;
    if (share < 0.08 || cx === undefined || cy === undefined || outerRadius === undefined || midAngle === undefined)
      return null;
    const radius = Number(outerRadius) + 16;
    const angle = -midAngle * (Math.PI / 180);
    const x = Number(cx) + radius * Math.cos(angle);
    const y = Number(cy) + radius * Math.sin(angle);
    return (
      <text x={x} y={y} textAnchor={x > Number(cx) ? "start" : "end"} dominantBaseline="central" fontSize={11} fill="var(--ink-muted)">
        {Math.round(share * 100)}%
      </text>
    );
  }

  return (
    <div>
      <ResponsiveContainer width="100%" height={196}>
        <PieChart>
          <Tooltip content={<ChartTooltip formatValue={(v) => formatCompactNumber(Number(v))} />} />
          <Pie
            data={data}
            dataKey="value"
            nameKey="label"
            innerRadius={0}
            outerRadius={80}
            paddingAngle={2}
            isAnimationActive={false}
            label={renderLabel}
            labelLine={false}
          >
            {data.map((entry, i) => (
              <Cell key={entry.label} fill={COLORS[i % COLORS.length]} stroke="var(--surface)" strokeWidth={2} />
            ))}
          </Pie>
        </PieChart>
      </ResponsiveContainer>
      <div className="mt-2">
        <ChartLegend items={data.map((d, i) => ({ label: d.label, color: COLORS[i % COLORS.length] }))} />
      </div>
    </div>
  );
}
