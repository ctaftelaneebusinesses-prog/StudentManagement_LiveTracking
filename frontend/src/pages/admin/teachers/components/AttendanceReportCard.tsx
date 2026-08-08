import { useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";
import { CalendarRange, Printer, Search, Table2 } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { DatePicker } from "@/components/ui/DatePicker";
import { Tabs } from "@/components/ui/Tabs";
import { DataTable } from "@/components/ui/DataTable";
import { Badge, BadgeVariant } from "@/components/ui/Badge";
import { Skeleton } from "@/components/ui/Skeleton";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { ExportButtons } from "@/components/ui/ExportButtons";
import { useToast } from "@/components/ui/Toast";
import { ChartCard } from "@/pages/admin/dashboard/components/ChartCard";
import { ChartLegend } from "@/pages/admin/dashboard/components/ChartLegend";
import { ChartTooltip } from "@/pages/admin/dashboard/components/ChartTooltip";
import * as teacherAttendanceService from "@/services/admin/teacherAttendance.service";
import * as schoolService from "@/services/admin/school.service";
import { TeacherAttendanceRecord, TeacherAttendanceStatus } from "@/types/admin.types";
import { getApiErrorMessage } from "@/lib/axios";
import { buildCalendarGrid, formatDisplayDate, MONTH_LABELS, WEEKDAY_LABELS, toIsoDate } from "@/utils/date";
import { ExportColumn } from "@/utils/export";

const STATUS_META: Record<TeacherAttendanceStatus, { label: string; badge: BadgeVariant; color: string }> = {
  present: { label: "Present", badge: "success", color: "var(--status-good)" },
  absent: { label: "Absent", badge: "danger", color: "var(--status-serious)" },
  half_day: { label: "Half day", badge: "warning", color: "var(--series-2)" },
  leave: { label: "Leave", badge: "info", color: "var(--status-warning)" },
};

const HOLIDAY_COLOR = "var(--series-1)";
const WEEKDAY_FULL_LABELS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const MARK_STATUS_OPTIONS: { value: TeacherAttendanceStatus; label: string }[] = [
  { value: "present", label: "Present" },
  { value: "absent", label: "Absent" },
  { value: "half_day", label: "Half day" },
  { value: "leave", label: "Leave" },
];
const MAX_CALENDAR_MONTHS = 12;

function todayIso(): string {
  const now = new Date();
  return toIsoDate(now.getFullYear(), now.getMonth(), now.getDate());
}

function firstOfMonthIso(): string {
  const now = new Date();
  return toIsoDate(now.getFullYear(), now.getMonth(), 1);
}

function parseIso(iso: string): Date {
  return new Date(`${iso}T00:00:00`);
}

function formatTime(iso: string | null): string {
  return iso ? new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "—";
}

/** Every ISO date from `from` to `to` inclusive. Iterates via local Date increments to sidestep UTC-shift bugs. */
function enumerateDates(from: string, to: string): string[] {
  const dates: string[] = [];
  const cursor = parseIso(from);
  const end = parseIso(to);
  while (cursor <= end) {
    dates.push(toIsoDate(cursor.getFullYear(), cursor.getMonth(), cursor.getDate()));
    cursor.setDate(cursor.getDate() + 1);
  }
  return dates;
}

/** Every {year, month} spanned by `from`..`to` inclusive, oldest first. */
function enumerateMonths(from: string, to: string): { year: number; month: number }[] {
  const months: { year: number; month: number }[] = [];
  const start = parseIso(from);
  const end = parseIso(to);
  const cursor = new Date(start.getFullYear(), start.getMonth(), 1);
  const endMarker = new Date(end.getFullYear(), end.getMonth(), 1);
  while (cursor <= endMarker) {
    months.push({ year: cursor.getFullYear(), month: cursor.getMonth() });
    cursor.setMonth(cursor.getMonth() + 1);
  }
  return months;
}

type DayInfo =
  | { kind: "holiday"; name: string }
  | { kind: "status"; status: TeacherAttendanceStatus; remarks: string | null }
  | { kind: "none" };

type ViewTab = "calendar" | "table";

export function AttendanceReportCard({ teacherId, teacherName }: { teacherId: string; teacherName: string }) {
  const toast = useToast();
  const queryClient = useQueryClient();
  const today = todayIso();

  const [from, setFrom] = useState(firstOfMonthIso());
  const [to, setTo] = useState(today);
  const [view, setView] = useState<ViewTab>("calendar");
  const [search, setSearch] = useState("");

  let dateError: string | null = null;
  if (to > today) dateError = "To Date cannot be in the future.";
  else if (from > to) dateError = "From Date cannot be later than To Date.";

  const isRangeValid = !dateError;

  const recordsQuery = useQuery({
    queryKey: ["admin", "teachers", teacherId, "attendance", "range", from, to],
    queryFn: () => teacherAttendanceService.fetchAttendanceForTeacher(teacherId, from, to),
    enabled: isRangeValid,
  });

  const holidaysQuery = useQuery({ queryKey: ["admin", "holidays"], queryFn: schoolService.fetchHolidays });
  const schoolQuery = useQuery({ queryKey: ["admin", "school"], queryFn: schoolService.fetchMySchool });

  const { register, handleSubmit, reset } = useForm({
    defaultValues: { date: today, status: "present" as TeacherAttendanceStatus, remarks: "" },
  });

  const markMutation = useMutation({
    mutationFn: (values: { date: string; status: TeacherAttendanceStatus; remarks: string }) =>
      teacherAttendanceService.markAttendance({
        teacher_id: teacherId,
        date: values.date,
        status: values.status,
        remarks: values.remarks || undefined,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin", "teachers", teacherId, "attendance"] });
      toast.success("Attendance recorded.");
      reset({ date: today, status: "present", remarks: "" });
    },
    onError: (err) => toast.error(getApiErrorMessage(err, "Failed to record attendance.")),
  });

  const records = recordsQuery.data ?? [];
  const holidays = holidaysQuery.data ?? [];
  const workingWeekdays = (schoolQuery.data?.settings?.workingDays as number[] | undefined) ?? [1, 2, 3, 4, 5];

  const recordsByDate = useMemo(() => new Map(records.map((r) => [r.date, r])), [records]);

  const holidaysByDate = useMemo(() => {
    if (!isRangeValid) return new Map<string, string>();
    const map = new Map<string, string>();
    for (const h of holidays) {
      if (h.date >= from && h.date <= to) map.set(h.date, h.name);
    }
    return map;
  }, [holidays, from, to, isRangeValid]);

  const summary = useMemo(() => {
    const counts = { present: 0, absent: 0, half_day: 0, leave: 0 };
    for (const r of records) {
      if (r.status in counts) counts[r.status as keyof typeof counts] += 1;
    }
    if (!isRangeValid) {
      return { ...counts, totalWorkingDays: 0, percentage: 0 };
    }
    const totalWorkingDays = enumerateDates(from, to).filter(
      (iso) => workingWeekdays.includes(parseIso(iso).getDay()) && !holidaysByDate.has(iso)
    ).length;
    const percentage = totalWorkingDays > 0 ? ((counts.present + counts.half_day * 0.5) / totalWorkingDays) * 100 : 0;
    return { ...counts, totalWorkingDays, percentage };
  }, [records, from, to, workingWeekdays, holidaysByDate, isRangeValid]);

  const filteredRecords = useMemo(() => {
    if (!search.trim()) return records;
    const q = search.trim().toLowerCase();
    return records.filter((r) => {
      const day = WEEKDAY_FULL_LABELS[parseIso(r.date).getDay()];
      return (
        r.date.includes(q) ||
        day.toLowerCase().includes(q) ||
        STATUS_META[r.status].label.toLowerCase().includes(q) ||
        (r.remarks ?? "").toLowerCase().includes(q)
      );
    });
  }, [records, search]);

  const months = useMemo(() => (isRangeValid ? enumerateMonths(from, to) : []), [from, to, isRangeValid]);
  const calendarTruncated = months.length > MAX_CALENDAR_MONTHS;

  const chartData = [
    { key: "present", name: "Present", value: summary.present, color: STATUS_META.present.color },
    { key: "absent", name: "Absent", value: summary.absent, color: STATUS_META.absent.color },
    { key: "half_day", name: "Half day", value: summary.half_day, color: STATUS_META.half_day.color },
    { key: "leave", name: "Leave", value: summary.leave, color: STATUS_META.leave.color },
  ].filter((d) => d.value > 0);

  const exportColumns: ExportColumn<TeacherAttendanceRecord>[] = [
    { header: "Date", accessor: (r) => r.date },
    { header: "Day", accessor: (r) => WEEKDAY_FULL_LABELS[parseIso(r.date).getDay()] },
    { header: "Check-in", accessor: (r) => formatTime(r.check_in_at) },
    { header: "Check-out", accessor: (r) => formatTime(r.check_out_at) },
    { header: "Status", accessor: (r) => STATUS_META[r.status].label },
    { header: "Remarks", accessor: (r) => r.remarks ?? "" },
  ];

  const isLoading = recordsQuery.isLoading || holidaysQuery.isLoading;

  return (
    <Card className="animate-fade-in space-y-5 print:shadow-none print:border-none">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-slate-900 dark:text-white">Attendance Report</h2>
          <p className="text-xs text-[var(--ink-muted)] print:hidden">
            Select a date range to view attendance history, trends, and export reports.
          </p>
        </div>
        <div className="hidden text-right print:block">
          <p className="text-sm font-semibold">{teacherName}</p>
          <p className="text-xs text-[var(--ink-muted)]">
            {formatDisplayDate(from)} – {formatDisplayDate(to)}
          </p>
        </div>
      </div>

      <div className="flex flex-wrap items-end gap-3 print:hidden">
        <DatePicker label="From Date" value={from} onChange={setFrom} maxDate={to} />
        <DatePicker label="To Date" value={to} onChange={setTo} maxDate={today} />
        <div className="ml-auto flex gap-2">
          <Button variant="secondary" className="!px-3 !py-2 text-xs" onClick={() => window.print()}>
            <Printer size={14} className="mr-1" />
            Print
          </Button>
          <ExportButtons
            title={`Attendance Report — ${teacherName}`}
            columns={exportColumns}
            rows={filteredRecords}
            filename={`attendance-report-${teacherId}-${from}_to_${to}`}
          />
        </div>
      </div>
      {dateError && <p className="text-xs font-medium text-red-600 print:hidden">{dateError}</p>}

      {isLoading ? (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-20 w-full rounded-xl" />
          ))}
        </div>
      ) : (
        isRangeValid && (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
            <SummaryTile label="Working Days" value={summary.totalWorkingDays} />
            <SummaryTile label="Present" value={summary.present} color="var(--status-good)" />
            <SummaryTile label="Absent" value={summary.absent} color="var(--status-serious)" />
            <SummaryTile label="Approved Leave" value={summary.leave} color="var(--status-warning)" />
            <SummaryTile label="Half Days" value={summary.half_day} color="var(--series-2)" />
            <SummaryTile label="Attendance %" value={`${summary.percentage.toFixed(1)}%`} color="#0b8681" />
          </div>
        )
      )}

      {isRangeValid && chartData.length > 0 && (
        <ChartCard
          title="Status Distribution"
          subtitle={`${formatDisplayDate(from)} – ${formatDisplayDate(to)}`}
          className="print:hidden"
          legend={<ChartLegend items={chartData.map((d) => ({ label: d.name, color: d.color }))} />}
        >
          <ResponsiveContainer width="100%" height={200}>
            <PieChart>
              <Pie data={chartData} dataKey="value" nameKey="name" innerRadius={50} outerRadius={78} paddingAngle={2} isAnimationActive>
                {chartData.map((d) => (
                  <Cell key={d.key} fill={d.color} stroke="var(--surface)" strokeWidth={2} />
                ))}
              </Pie>
              <Tooltip content={<ChartTooltip />} />
            </PieChart>
          </ResponsiveContainer>
        </ChartCard>
      )}

      {isRangeValid && (
        <>
          <div className="flex flex-wrap items-center justify-between gap-3 print:hidden">
            <Tabs
              tabs={[
                { key: "calendar", label: "Calendar", icon: CalendarRange },
                { key: "table", label: "Table", icon: Table2 },
              ]}
              active={view}
              onChange={setView}
            />
            {view === "table" && (
              <div className="relative w-full max-w-xs">
                <Search size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[var(--ink-muted)]" />
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search date, day, status, remarks..."
                  className="w-full rounded-md border border-slate-300 bg-white py-2 pl-9 pr-3 text-sm shadow-sm outline-none
                    focus:border-brand-500 focus:ring-1 focus:ring-brand-500 dark:border-white/20 dark:bg-white/10 dark:text-white"
                />
              </div>
            )}
          </div>

          <div className="hidden items-center gap-4 text-xs print:flex">
            <LegendDot color={STATUS_META.present.color} label="Present" />
            <LegendDot color={STATUS_META.absent.color} label="Absent" />
            <LegendDot color={STATUS_META.leave.color} label="Leave" />
            <LegendDot color={HOLIDAY_COLOR} label="Holiday" />
          </div>

          {view === "calendar" ? (
            calendarTruncated ? (
              <p className="text-sm text-[var(--ink-muted)]">
                Select a range of {MAX_CALENDAR_MONTHS} months or fewer to view the calendar. The summary, table, and
                export still cover the full range.
              </p>
            ) : (
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 print:grid-cols-2">
                {months.map(({ year, month }) => (
                  <MonthGrid
                    key={`${year}-${month}`}
                    year={year}
                    month={month}
                    from={from}
                    to={to}
                    recordsByDate={recordsByDate}
                    holidaysByDate={holidaysByDate}
                  />
                ))}
              </div>
            )
          ) : (
            <DataTable<TeacherAttendanceRecord>
              isLoading={recordsQuery.isLoading}
              rows={filteredRecords}
              rowKey={(r) => r.id}
              emptyMessage="No attendance recorded for this range."
              columns={[
                { header: "Date", cell: (r) => r.date },
                { header: "Day", cell: (r) => WEEKDAY_FULL_LABELS[parseIso(r.date).getDay()] },
                { header: "Check-in", cell: (r) => formatTime(r.check_in_at) },
                { header: "Check-out", cell: (r) => formatTime(r.check_out_at) },
                { header: "Status", cell: (r) => <Badge variant={STATUS_META[r.status].badge}>{STATUS_META[r.status].label}</Badge> },
                { header: "Remarks", cell: (r) => r.remarks ?? "—" },
              ]}
            />
          )}
        </>
      )}

      <form
        className="flex flex-wrap items-end gap-3 border-t border-slate-100 pt-4 dark:border-white/10 print:hidden"
        onSubmit={handleSubmit((values) => markMutation.mutate(values))}
      >
        <Input label="Date" type="date" max={today} {...register("date", { required: true })} />
        <Select label="Status" options={MARK_STATUS_OPTIONS} {...register("status")} />
        <Input label="Remarks (optional)" {...register("remarks")} />
        <Button type="submit" isLoading={markMutation.isPending}>
          Mark attendance
        </Button>
      </form>
    </Card>
  );
}

function SummaryTile({ label, value, color }: { label: string; value: number | string; color?: string }) {
  return (
    <div className="rounded-xl border border-black/[0.06] bg-white p-3 text-center shadow-sm transition-shadow duration-200 hover:shadow-md dark:border-white/[0.08] dark:bg-[#1c1c1f]">
      <p className="text-[10px] font-medium uppercase tracking-wide text-[var(--ink-muted)]">{label}</p>
      <p className="mt-1 text-xl font-semibold" style={color ? { color } : undefined}>
        {value}
      </p>
    </div>
  );
}

function LegendDot({ color, label }: { color: string; label: string }) {
  return (
    <span className="flex items-center gap-1.5">
      <span className="h-2 w-2 rounded-full" style={{ backgroundColor: color }} />
      {label}
    </span>
  );
}

function MonthGrid({
  year,
  month,
  from,
  to,
  recordsByDate,
  holidaysByDate,
}: {
  year: number;
  month: number;
  from: string;
  to: string;
  recordsByDate: Map<string, TeacherAttendanceRecord>;
  holidaysByDate: Map<string, string>;
}) {
  const cells = useMemo(() => buildCalendarGrid(year, month), [year, month]);

  function dayInfo(iso: string): DayInfo {
    if (iso < from || iso > to) return { kind: "none" };
    const holidayName = holidaysByDate.get(iso);
    if (holidayName) return { kind: "holiday", name: holidayName };
    const record = recordsByDate.get(iso);
    if (record) return { kind: "status", status: record.status, remarks: record.remarks };
    return { kind: "none" };
  }

  return (
    <div className="rounded-xl border border-black/[0.06] p-3 dark:border-white/[0.08]">
      <p className="mb-2 text-center text-xs font-semibold text-[var(--ink-primary)]">
        {MONTH_LABELS[month]} {year}
      </p>
      <div className="grid grid-cols-7 gap-1 pb-1 text-center text-[10px] font-medium text-[var(--ink-muted)]">
        {WEEKDAY_LABELS.map((d) => (
          <span key={d}>{d}</span>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-1">
        {cells.map((cell) => {
          const info = dayInfo(cell.iso);
          const inRange = cell.iso >= from && cell.iso <= to;
          const dotColor =
            info.kind === "holiday" ? HOLIDAY_COLOR : info.kind === "status" ? STATUS_META[info.status].color : undefined;
          const title =
            info.kind === "holiday"
              ? `Holiday — ${info.name}`
              : info.kind === "status"
                ? `${STATUS_META[info.status].label}${info.remarks ? ` — ${info.remarks}` : ""}`
                : undefined;
          return (
            <div
              key={cell.iso}
              title={title}
              className={`flex h-7 w-7 items-center justify-center rounded-full text-[11px]
                ${!cell.isCurrentMonth || !inRange ? "text-[var(--ink-muted)] opacity-40" : "text-[var(--ink-primary)]"}`}
              style={dotColor && inRange ? { backgroundColor: `color-mix(in srgb, ${dotColor} 22%, transparent)` } : undefined}
            >
              {cell.date}
            </div>
          );
        })}
      </div>
    </div>
  );
}
