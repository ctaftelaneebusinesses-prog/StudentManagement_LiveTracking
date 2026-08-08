import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { ChartTooltip } from "@/pages/admin/dashboard/components/ChartTooltip";
import { ChartLegend } from "@/pages/admin/dashboard/components/ChartLegend";
import { GrowthPoint } from "@/types/superAdmin.types";

/**
 * Platform-console charts. All colors come from the app's existing
 * `--series-*` CSS variables rather than new hex values, so light/dark and
 * every other chart in the product stay one visual system.
 */

const SERIES = [
  "var(--series-1)",
  "var(--series-2)",
  "var(--series-3)",
  "var(--series-4)",
  "var(--series-5)",
  "var(--series-6)",
  "var(--series-7)",
  "var(--series-8)",
];

const AXIS_PROPS = {
  stroke: "var(--ink-muted)",
  fontSize: 11,
  tickLine: false,
  axisLine: false,
} as const;

/** Formats a YYYY-MM bucket as "Mar '26" without pulling in a date library. */
function formatMonth(month: string): string {
  const [year, m] = month.split("-");
  const name = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"][Number(m) - 1];
  return `${name ?? month} '${year.slice(2)}`;
}

export function SchoolsByStatusChart({ data }: { data: { name: string; value: number }[] }) {
  const shown = data.filter((d) => d.value > 0);
  const colors = { Active: "var(--series-2)", Inactive: "var(--series-4)" } as Record<string, string>;

  if (shown.length === 0) {
    return <p className="py-12 text-center text-xs text-[var(--ink-muted)]">No schools yet.</p>;
  }

  return (
    <div>
      <ResponsiveContainer width="100%" height={196}>
        <PieChart>
          <Tooltip content={<ChartTooltip />} />
          <Pie
            data={shown}
            dataKey="value"
            nameKey="name"
            innerRadius={52}
            outerRadius={80}
            paddingAngle={2}
            isAnimationActive={false}
          >
            {shown.map((entry) => (
              <Cell
                key={entry.name}
                fill={colors[entry.name] ?? "var(--series-1)"}
                stroke="var(--surface)"
                strokeWidth={2}
              />
            ))}
          </Pie>
        </PieChart>
      </ResponsiveContainer>
      <div className="mt-2">
        <ChartLegend
          items={shown.map((d) => ({ label: `${d.name} (${d.value})`, color: colors[d.name] ?? "var(--series-1)" }))}
        />
      </div>
    </div>
  );
}

const ROLE_LABELS: Record<string, string> = {
  school_admin: "School Admins",
  principal: "Principals",
  teacher: "Teachers",
  student: "Students",
  accountant: "Accountants",
  driver: "Drivers",
  extracurricular_staff: "EC Staff",
  support_staff: "Support Staff",
};

export function UsersByRoleChart({ data }: { data: { role: string; count: number }[] }) {
  const rows = data.map((d) => ({ label: ROLE_LABELS[d.role] ?? d.role, count: d.count }));

  if (rows.length === 0) {
    return <p className="py-12 text-center text-xs text-[var(--ink-muted)]">No user accounts yet.</p>;
  }

  return (
    <ResponsiveContainer width="100%" height={230}>
      <BarChart data={rows} layout="vertical" margin={{ top: 4, right: 12, bottom: 0, left: 4 }}>
        <CartesianGrid horizontal={false} stroke="var(--gridline)" />
        <XAxis type="number" {...AXIS_PROPS} allowDecimals={false} />
        <YAxis type="category" dataKey="label" width={92} {...AXIS_PROPS} />
        <Tooltip cursor={{ fill: "var(--gridline)" }} content={<ChartTooltip />} />
        <Bar dataKey="count" name="Users" radius={[0, 5, 5, 0]} isAnimationActive={false} barSize={16}>
          {rows.map((_, i) => (
            <Cell key={i} fill={SERIES[i % SERIES.length]} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

export function StudentsBySchoolChart({
  data,
}: {
  data: { schoolId: string; schoolName: string; students: number }[];
}) {
  // Only the busiest schools stay legible on one axis; the rest are rolled up
  // rather than silently dropped, so the total still reconciles.
  const TOP_N = 8;
  const top = data.slice(0, TOP_N);
  const restTotal = data.slice(TOP_N).reduce((sum, d) => sum + d.students, 0);
  const rows = restTotal > 0 ? [...top, { schoolName: `Other (${data.length - TOP_N})`, students: restTotal }] : top;

  if (rows.length === 0) {
    return <p className="py-12 text-center text-xs text-[var(--ink-muted)]">No students enrolled yet.</p>;
  }

  return (
    <ResponsiveContainer width="100%" height={230}>
      <BarChart data={rows} margin={{ top: 4, right: 8, bottom: 0, left: -14 }}>
        <CartesianGrid vertical={false} stroke="var(--gridline)" />
        <XAxis dataKey="schoolName" {...AXIS_PROPS} interval={0} angle={-18} textAnchor="end" height={52} />
        <YAxis {...AXIS_PROPS} allowDecimals={false} />
        <Tooltip cursor={{ fill: "var(--gridline)" }} content={<ChartTooltip />} />
        <Bar dataKey="students" name="Students" radius={[5, 5, 0, 0]} isAnimationActive={false} maxBarSize={44}>
          {rows.map((_, i) => (
            <Cell key={i} fill={SERIES[i % SERIES.length]} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

export function GrowthAreaChart({ data, label, color }: { data: GrowthPoint[]; label: string; color: string }) {
  if (data.length === 0) {
    return <p className="py-12 text-center text-xs text-[var(--ink-muted)]">Not enough history yet.</p>;
  }

  const rows = data.map((d) => ({ ...d, month: formatMonth(d.month) }));
  const gradientId = `growth-${label.replace(/\s+/g, "-").toLowerCase()}`;

  return (
    <ResponsiveContainer width="100%" height={210}>
      <AreaChart data={rows} margin={{ top: 4, right: 8, bottom: 0, left: -18 }}>
        <defs>
          <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity={0.34} />
            <stop offset="100%" stopColor={color} stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid vertical={false} stroke="var(--gridline)" />
        <XAxis dataKey="month" {...AXIS_PROPS} />
        <YAxis {...AXIS_PROPS} allowDecimals={false} />
        <Tooltip content={<ChartTooltip />} />
        <Area
          type="monotone"
          dataKey="total"
          name={label}
          stroke={color}
          strokeWidth={2}
          fill={`url(#${gradientId})`}
          isAnimationActive={false}
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}
