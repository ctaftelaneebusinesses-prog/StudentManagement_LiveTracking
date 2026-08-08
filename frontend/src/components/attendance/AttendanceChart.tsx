import {
  BarChart, Bar, LineChart, Line, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from 'recharts';

const COLORS = {
  present: '#22c55e',
  absent: '#ef4444',
  late: '#f59e0b',
  excused: '#3b82f6',
};

interface BreakdownDatum {
  label: string;
  present_count: number;
  absent_count: number;
  late_count: number;
  excused_count: number;
}

interface TrendDatum {
  label: string;
  present_pct: number;
}

// Stacked bar chart: present/absent/late/excused counts per class or per day
export function AttendanceBreakdownChart({ data, height = 320 }: { data: BreakdownDatum[]; height?: number }) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data}>
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis dataKey="label" tick={{ fontSize: 12 }} />
        <YAxis allowDecimals={false} />
        <Tooltip />
        <Legend />
        <Bar dataKey="present_count" name="Present" stackId="a" fill={COLORS.present} />
        <Bar dataKey="absent_count" name="Absent" stackId="a" fill={COLORS.absent} />
        <Bar dataKey="late_count" name="Late" stackId="a" fill={COLORS.late} />
        <Bar dataKey="excused_count" name="Excused" stackId="a" fill={COLORS.excused} />
      </BarChart>
    </ResponsiveContainer>
  );
}

// Line chart: attendance % trend over time
export function AttendanceTrendChart({ data, height = 300 }: { data: TrendDatum[]; height?: number }) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <LineChart data={data}>
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis dataKey="label" tick={{ fontSize: 12 }} />
        <YAxis domain={[0, 100]} unit="%" />
        <Tooltip />
        <Line type="monotone" dataKey="present_pct" name="Present %" stroke="#22c55e" strokeWidth={2} dot={false} />
      </LineChart>
    </ResponsiveContainer>
  );
}

// Pie chart: single-period status split (e.g. one student, one class, one day)
export function AttendancePieChart({
  present, absent, late, excused, height = 260,
}: { present: number; absent: number; late: number; excused: number; height?: number }) {
  const data = [
    { name: 'Present', value: present, color: COLORS.present },
    { name: 'Absent', value: absent, color: COLORS.absent },
    { name: 'Late', value: late, color: COLORS.late },
    { name: 'Excused', value: excused, color: COLORS.excused },
  ].filter((d) => d.value > 0);

  return (
    <ResponsiveContainer width="100%" height={height}>
      <PieChart>
        <Pie data={data} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={90} label>
          {data.map((entry) => (
            <Cell key={entry.name} fill={entry.color} />
          ))}
        </Pie>
        <Tooltip />
        <Legend />
      </PieChart>
    </ResponsiveContainer>
  );
}
