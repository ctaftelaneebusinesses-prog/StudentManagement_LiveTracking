import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Card } from "@/components/ui/Card";
import { Select } from "@/components/ui/Select";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { Spinner } from "@/components/ui/Spinner";
import * as portalService from "@/services/teacher/portal.service";
import * as attendanceService from "@/services/teacher/attendance.service";
import { AttendanceStatus } from "@/types/dashboard.types";
import { AttendanceHistoryRow } from "@/types/teacher.types";

const STATUS_OPTIONS: { value: AttendanceStatus; label: string }[] = [
  { value: "present", label: "Present" },
  { value: "absent", label: "Absent" },
  { value: "late", label: "Late" },
  { value: "half_day", label: "Half day" },
  { value: "leave", label: "On leave" },
];

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

export function TeacherAttendancePage() {
  const [classId, setClassId] = useState("");
  const [date, setDate] = useState(todayIso());
  const [entries, setEntries] = useState<Record<string, { status: AttendanceStatus; remarks: string }>>({});
  const [saveMessage, setSaveMessage] = useState<string | null>(null);

  const dashboardQuery = useQuery({ queryKey: ["teacher", "dashboard"], queryFn: portalService.fetchDashboard });
  const classOptions = (dashboardQuery.data?.classes ?? []).map((c) => ({
    value: c.id,
    label: `${c.name} - ${c.section}`,
  }));

  const rosterQuery = useQuery({
    queryKey: ["teacher", "roster", classId],
    queryFn: () => portalService.fetchRoster(classId),
    enabled: !!classId,
  });

  const existingQuery = useQuery({
    queryKey: ["teacher", "attendance", classId, date],
    queryFn: () => attendanceService.fetchForClassDate(classId, date),
    enabled: !!classId && !!date,
  });

  useEffect(() => {
    if (!rosterQuery.data) return;
    const existingByStudent = new Map((existingQuery.data ?? []).map((r) => [r.student_id, r]));
    const next: Record<string, { status: AttendanceStatus; remarks: string }> = {};
    for (const student of rosterQuery.data) {
      const existing = existingByStudent.get(student.id);
      next[student.id] = { status: existing?.status ?? "present", remarks: existing?.remarks ?? "" };
    }
    setEntries(next);
    setSaveMessage(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rosterQuery.data, existingQuery.data]);

  const bulkMutation = useMutation({
    mutationFn: () =>
      attendanceService.bulkMarkAttendance(
        classId,
        date,
        Object.entries(entries).map(([student_id, v]) => ({
          student_id,
          status: v.status,
          remarks: v.remarks || undefined,
        }))
      ),
    onSuccess: () => {
      setSaveMessage("Attendance saved.");
      existingQuery.refetch();
    },
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">Attendance</h1>
        <p className="text-sm text-slate-500">Mark or update attendance for one of your classes.</p>
      </div>

      <Card className="space-y-4">
        <div className="flex flex-wrap items-end gap-4">
          <Select
            label="Class"
            name="attendanceClassId"
            placeholder="Select class"
            options={classOptions}
            value={classId}
            onChange={(e) => setClassId(e.target.value)}
          />
          <Input label="Date" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        </div>

        {!classId ? (
          <p className="text-sm text-slate-500">Select a class to take attendance.</p>
        ) : rosterQuery.isLoading || existingQuery.isLoading ? (
          <Spinner label="Loading roster..." />
        ) : (rosterQuery.data ?? []).length === 0 ? (
          <p className="text-sm text-slate-500">No students in this class yet.</p>
        ) : (
          <div className="space-y-3">
            <div className="overflow-x-auto rounded-lg border border-slate-200">
              <table className="min-w-full divide-y divide-slate-200 text-sm">
                <thead className="bg-slate-50">
                  <tr>
                    <th className="px-4 py-3 text-left font-medium text-slate-500">Student</th>
                    <th className="px-4 py-3 text-left font-medium text-slate-500">Status</th>
                    <th className="px-4 py-3 text-left font-medium text-slate-500">Remarks</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 bg-white">
                  {(rosterQuery.data ?? []).map((student) => (
                    <tr key={student.id}>
                      <td className="px-4 py-3 text-slate-700">
                        {student.users.full_name}
                        <span className="ml-2 text-xs text-slate-400">#{student.admission_no}</span>
                      </td>
                      <td className="px-4 py-3">
                        <select
                          className="rounded-md border border-slate-300 px-2 py-1 text-sm"
                          value={entries[student.id]?.status ?? "present"}
                          onChange={(e) =>
                            setEntries((prev) => ({
                              ...prev,
                              [student.id]: {
                                ...prev[student.id],
                                status: e.target.value as AttendanceStatus,
                                remarks: prev[student.id]?.remarks ?? "",
                              },
                            }))
                          }
                        >
                          {STATUS_OPTIONS.map((opt) => (
                            <option key={opt.value} value={opt.value}>
                              {opt.label}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td className="px-4 py-3">
                        <input
                          className="w-full rounded-md border border-slate-300 px-2 py-1 text-sm"
                          value={entries[student.id]?.remarks ?? ""}
                          onChange={(e) =>
                            setEntries((prev) => ({
                              ...prev,
                              [student.id]: {
                                status: prev[student.id]?.status ?? "present",
                                remarks: e.target.value,
                              },
                            }))
                          }
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {saveMessage && <p className="text-sm text-green-600">{saveMessage}</p>}
            {bulkMutation.isError && <p className="text-sm text-red-600">Failed to save attendance.</p>}
            <Button onClick={() => bulkMutation.mutate()} isLoading={bulkMutation.isPending}>
              Save attendance
            </Button>
          </div>
        )}
      </Card>

      <AttendanceHistoryCard classOptions={classOptions} />
    </div>
  );
}

function AttendanceHistoryCard({ classOptions }: { classOptions: { value: string; label: string }[] }) {
  const [classId, setClassId] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState(todayIso());

  const historyQuery = useQuery({
    queryKey: ["teacher", "attendance-history", classId, from, to],
    queryFn: () => attendanceService.fetchHistory(classId, from || undefined, to || undefined),
    enabled: !!classId,
  });

  const groupedByDate = useMemo(() => {
    const groups = new Map<string, AttendanceHistoryRow[]>();
    for (const row of historyQuery.data ?? []) {
      if (!groups.has(row.date)) groups.set(row.date, []);
      groups.get(row.date)!.push(row);
    }
    return Array.from(groups.entries()).sort(([a], [b]) => b.localeCompare(a));
  }, [historyQuery.data]);

  return (
    <Card className="space-y-4">
      <h2 className="text-lg font-semibold text-slate-900">Attendance history</h2>
      <div className="flex flex-wrap items-end gap-4">
        <Select
          label="Class"
          name="historyClassId"
          placeholder="Select class"
          options={classOptions}
          value={classId}
          onChange={(e) => setClassId(e.target.value)}
        />
        <Input label="From" type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
        <Input label="To" type="date" value={to} onChange={(e) => setTo(e.target.value)} />
      </div>

      {!classId ? (
        <p className="text-sm text-slate-500">Select a class to view history.</p>
      ) : historyQuery.isLoading ? (
        <Spinner label="Loading history..." />
      ) : groupedByDate.length === 0 ? (
        <p className="text-sm text-slate-500">No attendance recorded in this range.</p>
      ) : (
        <div className="space-y-4">
          {groupedByDate.map(([date, rows]) => (
            <div key={date}>
              <h3 className="mb-2 text-sm font-semibold text-slate-700">{date}</h3>
              <ul className="space-y-1 text-sm">
                {rows.map((r) => (
                  <li key={r.id} className="flex justify-between rounded-md border border-slate-100 px-3 py-1.5">
                    <span className="text-slate-600">{r.students?.users.full_name ?? r.student_id}</span>
                    <span className="text-slate-800 capitalize">{r.status.replace("_", " ")}</span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}
