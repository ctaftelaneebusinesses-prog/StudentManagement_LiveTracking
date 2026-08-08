import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { usePortalStudentId } from "@/context/PortalStudentContext";
import * as attendanceService from "@/services/portal/attendance.service";
import { AttendanceCalendar } from "./components/AttendanceCalendar";
import { PortalGlassCard } from "./components/ui/PortalGlassCard";
import { PortalSkeleton } from "./components/ui/PortalSkeleton";
import { PortalProgressBar } from "./components/ui/PortalProgressBar";

function pad(n: number) {
  return String(n).padStart(2, "0");
}
function monthRange(year: number, month: number): [string, string] {
  const from = `${year}-${pad(month + 1)}-01`;
  const lastDay = new Date(year, month + 1, 0).getDate();
  const to = `${year}-${pad(month + 1)}-${pad(lastDay)}`;
  return [from, to];
}

export function PortalAttendancePage() {
  const studentId = usePortalStudentId();
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth());
  const [from, to] = monthRange(year, month);
  const yearFrom = `${year}-01-01`;
  const yearTo = `${year}-12-31`;

  const recordsQuery = useQuery({
    queryKey: ["portal", "attendance-records", studentId, year, month],
    queryFn: () => attendanceService.fetchAttendanceRecords(studentId, from, to),
    enabled: !!studentId,
  });
  const monthSummaryQuery = useQuery({
    queryKey: ["portal", "attendance-summary", studentId, "month", year, month],
    queryFn: () => attendanceService.fetchAttendanceSummary(studentId, from, to),
    enabled: !!studentId,
  });
  const yearSummaryQuery = useQuery({
    queryKey: ["portal", "attendance-summary", studentId, "year", year],
    queryFn: () => attendanceService.fetchAttendanceSummary(studentId, yearFrom, yearTo),
    enabled: !!studentId,
  });

  return (
    <div className="space-y-6">
      <div className="border-l-4 pl-4" style={{ borderColor: "var(--portal-accent)" }}>
        <h1 className="text-2xl font-semibold text-[var(--ink-primary)]">Attendance</h1>
        <p className="text-sm text-[var(--ink-muted)]">Track daily attendance and see the full history at a glance.</p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <SummaryTile label="This month" percentage={monthSummaryQuery.data?.percentage ?? null} isLoading={monthSummaryQuery.isLoading} />
        <SummaryTile label={`This year (${year})`} percentage={yearSummaryQuery.data?.percentage ?? null} isLoading={yearSummaryQuery.isLoading} />
      </div>

      <PortalGlassCard noHover>
        {recordsQuery.isLoading ? (
          <PortalSkeleton className="h-80 w-full" />
        ) : (
          <AttendanceCalendar
            year={year}
            month={month}
            records={recordsQuery.data?.records ?? []}
            onMonthChange={(y, m) => {
              setYear(y);
              setMonth(m);
            }}
          />
        )}
      </PortalGlassCard>
    </div>
  );
}

function SummaryTile({ label, percentage, isLoading }: { label: string; percentage: number | null; isLoading: boolean }) {
  return (
    <PortalGlassCard className="space-y-2" noHover>
      <p className="text-sm font-medium text-[var(--ink-secondary)]">{label}</p>
      {isLoading ? (
        <PortalSkeleton className="h-9 w-24" />
      ) : (
        <>
          <p className="text-3xl font-semibold text-[var(--ink-primary)]">{percentage !== null ? `${percentage}%` : "—"}</p>
          {percentage !== null && <PortalProgressBar percent={percentage} />}
        </>
      )}
    </PortalGlassCard>
  );
}
