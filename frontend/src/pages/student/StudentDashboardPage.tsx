import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { Card } from "@/components/ui/Card";
import { Spinner } from "@/components/ui/Spinner";
import { Button } from "@/components/ui/Button";
import * as studentDashboardService from "@/services/studentDashboard.service";
import { DAY_NAMES } from "@/types/dashboard.types";

const STATUS_LABEL: Record<string, string> = {
  present: "Present",
  absent: "Absent",
  late: "Late",
  half_day: "Half day",
  leave: "On leave",
};

const STATUS_COLOR: Record<string, string> = {
  present: "text-green-600",
  absent: "text-red-600",
  late: "text-amber-600",
  half_day: "text-amber-600",
  leave: "text-slate-500",
};

export function StudentDashboardPage() {
  const { user } = useAuth();
  const studentId = user?.id ?? "";
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ["student-dashboard", studentId],
    queryFn: () => studentDashboardService.fetchStudentDashboard(studentId),
    enabled: !!studentId,
  });

  const markReadMutation = useMutation({
    mutationFn: (notificationId: string) => studentDashboardService.markNotificationRead(studentId, notificationId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["student-dashboard", studentId] }),
  });

  if (isLoading) return <Spinner label="Loading your dashboard..." />;
  if (!data) return <p className="text-sm text-slate-500">Nothing to show yet.</p>;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">Welcome, {user?.full_name ?? "there"}</h1>
        <p className="text-sm text-slate-500">Here's what's happening this month.</p>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <AttendanceCard summary={data.attendance} />
        <MarksCard summary={data.marks} />
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <HomeworkCard items={data.homework} />
        <NotificationsCard
          notifications={data.notifications}
          onMarkRead={(id) => markReadMutation.mutate(id)}
          isMarking={markReadMutation.isPending}
        />
      </div>

      <TimetableCard days={data.timetable} />
    </div>
  );
}

function AttendanceCard({ summary }: { summary: NonNullable<Awaited<ReturnType<typeof studentDashboardService.fetchStudentDashboard>>>["attendance"] }) {
  return (
    <Card className="space-y-4">
      <h2 className="text-lg font-semibold text-slate-900">Attendance summary</h2>
      <p className="text-xs text-slate-500">
        {summary.from} to {summary.to}
      </p>
      <div className="flex items-center gap-4">
        <div className="text-3xl font-bold text-slate-900">
          {summary.percentage !== null ? `${summary.percentage}%` : "—"}
        </div>
        <p className="text-sm text-slate-500">{summary.total} day(s) recorded</p>
      </div>
      <div className="grid grid-cols-2 gap-2 text-sm sm:grid-cols-3">
        {Object.entries(summary.counts).map(([status, count]) => (
          <div key={status} className="rounded-md border border-slate-100 p-2">
            <p className={`font-semibold ${STATUS_COLOR[status] ?? "text-slate-700"}`}>{count}</p>
            <p className="text-xs text-slate-500">{STATUS_LABEL[status] ?? status}</p>
          </div>
        ))}
      </div>
    </Card>
  );
}

function MarksCard({ summary }: { summary: NonNullable<Awaited<ReturnType<typeof studentDashboardService.fetchStudentDashboard>>>["marks"] }) {
  return (
    <Card className="space-y-4">
      <h2 className="text-lg font-semibold text-slate-900">Marks summary</h2>
      {!summary.latestExam ? (
        <p className="text-sm text-slate-500">No exam results published yet.</p>
      ) : (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium text-slate-700">{summary.latestExam.examName}</p>
            <p className="text-lg font-bold text-slate-900">
              {summary.latestExam.percentage !== null ? `${summary.latestExam.percentage}%` : "—"}
            </p>
          </div>
          <ul className="space-y-1 text-sm">
            {summary.latestExam.subjects.map((s) => (
              <li key={s.subjectId} className="flex justify-between border-b border-slate-100 py-1">
                <span className="text-slate-600">{s.subjectName}</span>
                <span className="text-slate-800">
                  {s.marksObtained} / {s.maxMarks} {s.grade ? `(${s.grade})` : ""}
                </span>
              </li>
            ))}
          </ul>
          {summary.exams.length > 1 && (
            <p className="text-xs text-slate-500">
              {summary.exams.length - 1} earlier exam(s) also on record.
            </p>
          )}
        </div>
      )}
    </Card>
  );
}

function HomeworkCard({ items }: { items: Awaited<ReturnType<typeof studentDashboardService.fetchStudentDashboard>>["homework"] }) {
  return (
    <Card className="space-y-4">
      <h2 className="text-lg font-semibold text-slate-900">Homework</h2>
      {items.length === 0 ? (
        <p className="text-sm text-slate-500">No upcoming homework.</p>
      ) : (
        <ul className="space-y-3">
          {items.map((hw) => (
            <li key={hw.id} className="rounded-md border border-slate-100 p-3">
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium text-slate-800">{hw.title}</p>
                <span className="text-xs text-slate-500">Due {hw.due_date}</span>
              </div>
              {hw.subjects && <p className="text-xs text-slate-500">{hw.subjects.name}</p>}
              {hw.description && <p className="mt-1 text-sm text-slate-600">{hw.description}</p>}
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

function NotificationsCard({
  notifications,
  onMarkRead,
  isMarking,
}: {
  notifications: Awaited<ReturnType<typeof studentDashboardService.fetchStudentDashboard>>["notifications"];
  onMarkRead: (id: string) => void;
  isMarking: boolean;
}) {
  return (
    <Card className="space-y-4">
      <h2 className="text-lg font-semibold text-slate-900">Notifications</h2>
      {notifications.length === 0 ? (
        <p className="text-sm text-slate-500">No notifications.</p>
      ) : (
        <ul className="space-y-3">
          {notifications.map((n) => (
            <li key={n.id} className={`rounded-md border p-3 ${n.isRead ? "border-slate-100" : "border-brand-200 bg-brand-50"}`}>
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="text-sm font-medium text-slate-800">{n.title}</p>
                  <p className="text-sm text-slate-600">{n.message}</p>
                  <p className="mt-1 text-xs text-slate-400">{new Date(n.created_at).toLocaleString()}</p>
                </div>
                {!n.isRead && (
                  <Button variant="ghost" className="!px-2 !py-1 text-xs" isLoading={isMarking} onClick={() => onMarkRead(n.id)}>
                    Mark read
                  </Button>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

function TimetableCard({ days }: { days: Awaited<ReturnType<typeof studentDashboardService.fetchStudentDashboard>>["timetable"] }) {
  return (
    <Card className="space-y-4">
      <h2 className="text-lg font-semibold text-slate-900">Timetable</h2>
      {days.length === 0 ? (
        <p className="text-sm text-slate-500">No timetable published yet.</p>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {days.map((day) => (
            <div key={day.dayOfWeek}>
              <h3 className="mb-2 text-sm font-semibold text-slate-700">{DAY_NAMES[day.dayOfWeek]}</h3>
              <ul className="space-y-1 text-sm">
                {day.periods.map((p) => (
                  <li key={p.id} className="flex justify-between rounded-md border border-slate-100 px-2 py-1">
                    <span className="text-slate-600">
                      {p.start_time.slice(0, 5)}–{p.end_time.slice(0, 5)}
                    </span>
                    <span className="text-slate-800">{p.subjects?.name ?? "—"}</span>
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
