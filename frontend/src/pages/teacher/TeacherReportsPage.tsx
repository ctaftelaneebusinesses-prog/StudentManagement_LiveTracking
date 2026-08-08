import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";
import { Card } from "@/components/ui/Card";
import { Select } from "@/components/ui/Select";
import { Spinner } from "@/components/ui/Spinner";
import { ExportButtons } from "@/components/ui/ExportButtons";
import * as portalService from "@/services/teacher/portal.service";
import * as reportsService from "@/services/teacher/reports.service";

const STATUS_LABEL: Record<string, string> = {
  present: "Present",
  absent: "Absent",
  late: "Late",
  half_day: "Half day",
  leave: "On leave",
};

export function TeacherReportsPage() {
  const [classId, setClassId] = useState("");
  const [studentId, setStudentId] = useState("");

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
  const studentOptions = (rosterQuery.data ?? []).map((s) => ({ value: s.id, label: s.users.full_name }));

  const attendanceQuery = useQuery({
    queryKey: ["teacher", "report", "attendance", studentId],
    queryFn: () => reportsService.fetchStudentAttendanceSummary(studentId),
    enabled: !!studentId,
  });

  const marksQuery = useQuery({
    queryKey: ["teacher", "report", "marks", studentId],
    queryFn: () => reportsService.fetchStudentMarksSummary(studentId),
    enabled: !!studentId,
  });

  const classPerformanceQuery = useQuery({
    queryKey: ["teacher", "report", "class-performance", classId],
    queryFn: () => reportsService.fetchClassPerformance(classId),
    enabled: !!classId,
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">Reports</h1>
        <p className="text-sm text-slate-500">Class-wide performance, plus per-student attendance and marks.</p>
      </div>

      <Card className="space-y-4">
        <div className="flex flex-wrap items-end gap-4">
          <Select
            label="Class"
            name="reportClassId"
            placeholder="Select class"
            options={classOptions}
            value={classId}
            onChange={(e) => {
              setClassId(e.target.value);
              setStudentId("");
            }}
          />
          <Select
            label="Student"
            name="reportStudentId"
            placeholder="Select student"
            options={studentOptions}
            value={studentId}
            onChange={(e) => setStudentId(e.target.value)}
          />
        </div>
      </Card>

      {classId && (
        <Card className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-lg font-semibold text-slate-900">Class performance</h2>
            {classPerformanceQuery.data && (
              <ExportButtons
                title="Class performance"
                filename="class-performance"
                columns={[
                  {
                    header: "Subject",
                    accessor: (r: NonNullable<typeof classPerformanceQuery.data>["subjectPerformance"][number]) => r.subjectName,
                  },
                  {
                    header: "Average %",
                    accessor: (r: NonNullable<typeof classPerformanceQuery.data>["subjectPerformance"][number]) =>
                      r.averagePercentage ?? "—",
                  },
                ]}
                rows={classPerformanceQuery.data.subjectPerformance}
              />
            )}
          </div>

          {classPerformanceQuery.isLoading ? (
            <Spinner label="Loading class performance..." />
          ) : !classPerformanceQuery.data ? (
            <p className="text-sm text-slate-500">No data.</p>
          ) : (
            <>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="rounded-md border border-slate-100 p-3">
                  <p className="text-xs text-slate-500">Students</p>
                  <p className="text-2xl font-bold text-slate-900">{classPerformanceQuery.data.studentCount}</p>
                </div>
                <div className="rounded-md border border-slate-100 p-3">
                  <p className="text-xs text-slate-500">Attendance % (last 30 days)</p>
                  <p className="text-2xl font-bold text-slate-900">
                    {classPerformanceQuery.data.attendance.percentage !== null
                      ? `${classPerformanceQuery.data.attendance.percentage}%`
                      : "—"}
                  </p>
                </div>
              </div>

              {classPerformanceQuery.data.subjectPerformance.length === 0 ? (
                <p className="text-sm text-slate-500">No exam marks recorded for this class yet.</p>
              ) : (
                <ResponsiveContainer width="100%" height={280}>
                  <BarChart data={classPerformanceQuery.data.subjectPerformance}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="subjectName" tick={{ fontSize: 11 }} />
                    <YAxis domain={[0, 100]} unit="%" />
                    <Tooltip />
                    <Legend />
                    <Bar dataKey="averagePercentage" name="Average %" fill="#4f46e5" />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </>
          )}
        </Card>
      )}

      {studentId && (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <Card className="space-y-4">
            <h2 className="text-lg font-semibold text-slate-900">Attendance summary</h2>
            {attendanceQuery.isLoading ? (
              <Spinner label="Loading attendance..." />
            ) : !attendanceQuery.data ? (
              <p className="text-sm text-slate-500">No data.</p>
            ) : (
              <>
                <p className="text-xs text-slate-500">
                  {attendanceQuery.data.from} to {attendanceQuery.data.to}
                </p>
                <div className="flex items-center gap-4">
                  <div className="text-3xl font-bold text-slate-900">
                    {attendanceQuery.data.percentage !== null ? `${attendanceQuery.data.percentage}%` : "—"}
                  </div>
                  <p className="text-sm text-slate-500">{attendanceQuery.data.total} day(s) recorded</p>
                </div>
                <div className="grid grid-cols-2 gap-2 text-sm sm:grid-cols-3">
                  {Object.entries(attendanceQuery.data.counts).map(([status, count]) => (
                    <div key={status} className="rounded-md border border-slate-100 p-2">
                      <p className="font-semibold text-slate-700">{count}</p>
                      <p className="text-xs text-slate-500">{STATUS_LABEL[status] ?? status}</p>
                    </div>
                  ))}
                </div>
              </>
            )}
          </Card>

          <Card className="space-y-4">
            <h2 className="text-lg font-semibold text-slate-900">Marks summary</h2>
            {marksQuery.isLoading ? (
              <Spinner label="Loading marks..." />
            ) : !marksQuery.data?.latestExam ? (
              <p className="text-sm text-slate-500">No exam results recorded yet.</p>
            ) : (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-medium text-slate-700">{marksQuery.data.latestExam.examName}</p>
                  <p className="text-lg font-bold text-slate-900">
                    {marksQuery.data.latestExam.percentage !== null ? `${marksQuery.data.latestExam.percentage}%` : "—"}
                  </p>
                </div>
                <ul className="space-y-1 text-sm">
                  {marksQuery.data.latestExam.subjects.map((s) => (
                    <li key={s.subjectId} className="flex justify-between border-b border-slate-100 py-1">
                      <span className="text-slate-600">{s.subjectName}</span>
                      <span className="text-slate-800">
                        {s.marksObtained} / {s.maxMarks} {s.grade ? `(${s.grade})` : ""}
                      </span>
                    </li>
                  ))}
                </ul>
                {marksQuery.data.exams.length > 1 && (
                  <p className="text-xs text-slate-500">
                    {marksQuery.data.exams.length - 1} earlier exam(s) also on record.
                  </p>
                )}
              </div>
            )}
          </Card>
        </div>
      )}
    </div>
  );
}
