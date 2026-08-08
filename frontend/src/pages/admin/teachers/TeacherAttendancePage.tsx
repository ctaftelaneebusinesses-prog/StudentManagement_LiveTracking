import { useState } from "react";
import { Link } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CalendarCheck, CalendarX, ChevronRight } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Badge, BadgeVariant } from "@/components/ui/Badge";
import { DataTable } from "@/components/ui/DataTable";
import { ExportButtons } from "@/components/ui/ExportButtons";
import { Tabs } from "@/components/ui/Tabs";
import { useToast } from "@/components/ui/Toast";
import { getApiErrorMessage } from "@/lib/axios";
import * as teacherAttendanceService from "@/services/admin/teacherAttendance.service";
import { TeacherAttendanceStatus, TeacherDailyAttendance, TeacherMonthlyAttendanceRow } from "@/types/admin.types";
import { ExportColumn } from "@/utils/export";

const STATUS_OPTIONS: { value: TeacherAttendanceStatus; label: string }[] = [
  { value: "present", label: "Present" },
  { value: "absent", label: "Absent" },
  { value: "half_day", label: "Half day" },
  { value: "leave", label: "Leave" },
];

const STATUS_BADGE: Record<TeacherAttendanceStatus, BadgeVariant> = {
  present: "success",
  absent: "danger",
  half_day: "warning",
  leave: "neutral",
};

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

function currentMonth(): string {
  return new Date().toISOString().slice(0, 7);
}

function formatTime(iso: string | null): string {
  return iso ? new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "—";
}

type ViewTab = "daily" | "monthly";

export function TeacherAttendancePage() {
  const [tab, setTab] = useState<ViewTab>("daily");

  return (
    <div className="animate-fade-in space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-[var(--ink-primary)]">Teacher Attendance</h1>
        <p className="mt-1 text-sm text-[var(--ink-muted)]">
          Who checked in today, and monthly present/absent records for every teacher.
        </p>
      </div>

      <Tabs
        tabs={[
          { key: "daily", label: "Daily", icon: CalendarCheck },
          { key: "monthly", label: "Monthly", icon: CalendarX },
        ]}
        active={tab}
        onChange={setTab}
      />

      {tab === "daily" ? <DailyView /> : <MonthlyView />}
    </div>
  );
}

function DailyView() {
  const toast = useToast();
  const queryClient = useQueryClient();
  const [date, setDate] = useState(todayIso());

  const { data = [], isLoading } = useQuery({
    queryKey: ["admin", "teacher-attendance", "daily", date],
    queryFn: () => teacherAttendanceService.fetchDailyAttendance(date),
  });

  const markMutation = useMutation({
    mutationFn: (input: { teacher_id: string; status: TeacherAttendanceStatus }) =>
      teacherAttendanceService.markAttendance({ teacher_id: input.teacher_id, date, status: input.status }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin", "teacher-attendance", "daily", date] });
    },
    onError: (err) => toast.error(getApiErrorMessage(err, "Failed to update attendance.")),
  });

  const presentCount = data.filter((r) => r.status === "present").length;
  const absentCount = data.filter((r) => r.status === "absent").length;
  const unmarkedCount = data.filter((r) => r.status === null).length;

  const exportColumns: ExportColumn<TeacherDailyAttendance>[] = [
    { header: "Employee ID", accessor: (r) => r.employee_id },
    { header: "Name", accessor: (r) => r.teacher_name },
    { header: "Status", accessor: (r) => r.status ?? "Not marked" },
    { header: "Check-in", accessor: (r) => formatTime(r.check_in_at) },
    { header: "Check-out", accessor: (r) => formatTime(r.check_out_at) },
    { header: "Remarks", accessor: (r) => r.remarks ?? "" },
  ];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <Input label="Date" type="date" value={date} onChange={(e) => setDate(e.target.value)} className="!w-44" />
        <ExportButtons title="Teacher Attendance" columns={exportColumns} rows={data} filename={`teacher-attendance-${date}`} />
      </div>

      <div className="grid grid-cols-3 gap-4 text-center">
        <Card>
          <p className="text-xs uppercase tracking-wide text-[var(--ink-muted)]">Present</p>
          <p className="mt-1 text-2xl font-semibold text-[var(--status-good)]">{presentCount}</p>
        </Card>
        <Card>
          <p className="text-xs uppercase tracking-wide text-[var(--ink-muted)]">Absent</p>
          <p className="mt-1 text-2xl font-semibold text-[var(--status-serious)]">{absentCount}</p>
        </Card>
        <Card>
          <p className="text-xs uppercase tracking-wide text-[var(--ink-muted)]">Not marked yet</p>
          <p className="mt-1 text-2xl font-semibold text-[var(--ink-primary)]">{unmarkedCount}</p>
        </Card>
      </div>

      <Card>
        <DataTable<TeacherDailyAttendance>
          isLoading={isLoading}
          rows={data}
          rowKey={(r) => r.teacher_id}
          emptyMessage="No teachers found."
          columns={[
            { header: "Employee ID", cell: (r) => r.employee_id },
            {
              header: "Name",
              cell: (r) => (
                <Link to={`/dashboard/admin/teachers/${r.teacher_id}`} className="font-medium text-brand-600 hover:underline">
                  {r.teacher_name}
                </Link>
              ),
            },
            {
              header: "Status",
              cell: (r) =>
                r.status ? (
                  <Badge variant={STATUS_BADGE[r.status]}>{r.status.replace("_", " ")}</Badge>
                ) : (
                  <Badge variant="neutral">Not marked</Badge>
                ),
            },
            { header: "Check-in", cell: (r) => formatTime(r.check_in_at) },
            { header: "Check-out", cell: (r) => formatTime(r.check_out_at) },
            {
              header: "Override",
              cell: (r) => (
                <Select
                  label=""
                  className="!py-1 text-xs"
                  placeholder="Set status"
                  options={STATUS_OPTIONS}
                  value={r.status ?? ""}
                  onChange={(e) => markMutation.mutate({ teacher_id: r.teacher_id, status: e.target.value as TeacherAttendanceStatus })}
                />
              ),
            },
          ]}
        />
      </Card>
    </div>
  );
}

function MonthlyView() {
  const [month, setMonth] = useState(currentMonth());

  const { data = [], isLoading } = useQuery({
    queryKey: ["admin", "teacher-attendance", "monthly", month],
    queryFn: () => teacherAttendanceService.fetchMonthlySummary(month),
  });

  const exportColumns: ExportColumn<TeacherMonthlyAttendanceRow>[] = [
    { header: "Employee ID", accessor: (r) => r.employee_id },
    { header: "Name", accessor: (r) => r.teacher_name },
    { header: "Present", accessor: (r) => r.present },
    { header: "Absent", accessor: (r) => r.absent },
    { header: "Half day", accessor: (r) => r.half_day },
    { header: "Leave", accessor: (r) => r.leave },
    { header: "Total marked", accessor: (r) => r.total },
  ];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <Input label="Month" type="month" value={month} onChange={(e) => setMonth(e.target.value)} className="!w-44" />
        <ExportButtons title="Teacher Attendance (Monthly)" columns={exportColumns} rows={data} filename={`teacher-attendance-${month}`} />
      </div>

      <Card>
        <DataTable<TeacherMonthlyAttendanceRow>
          isLoading={isLoading}
          rows={data}
          rowKey={(r) => r.teacher_id}
          emptyMessage="No teachers found."
          columns={[
            { header: "Employee ID", cell: (r) => r.employee_id },
            {
              header: "Name",
              cell: (r) => (
                <Link
                  to={`/dashboard/admin/teachers/${r.teacher_id}`}
                  className="flex items-center gap-1 font-medium text-brand-600 hover:underline"
                >
                  {r.teacher_name} <ChevronRight size={14} />
                </Link>
              ),
            },
            { header: "Present", cell: (r) => r.present },
            { header: "Absent", cell: (r) => r.absent },
            { header: "Half day", cell: (r) => r.half_day },
            { header: "Leave", cell: (r) => r.leave },
            { header: "Total marked", cell: (r) => r.total },
          ]}
        />
      </Card>
    </div>
  );
}
