import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { CalendarCheck, ClipboardList, Wallet, BookOpen, Bell, Bus, GraduationCap, CalendarClock } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { useAuth } from "@/hooks/useAuth";
import { usePortalStudentId } from "@/context/PortalStudentContext";
import * as dashboardService from "@/services/portal/dashboard.service";
import * as attendanceService from "@/services/portal/attendance.service";
import * as homeworkService from "@/services/student/homework.service";
import { PortalGlassCard } from "./components/ui/PortalGlassCard";
import { PortalStatCard } from "./components/ui/PortalStatCard";
import { PortalSkeleton } from "./components/ui/PortalSkeleton";
import { staggerContainer, fadeSlideUp } from "./components/ui/portalMotion";
import { StoryCarousel } from "./components/story/StoryCarousel";
import { DAY_NAMES } from "@/types/dashboard.types";

function pad(n: number) {
  return String(n).padStart(2, "0");
}

export function PortalDashboardPage() {
  const { user } = useAuth();
  const studentId = usePortalStudentId();
  const queryClient = useQueryClient();
  const today = new Date();
  const todayIso = `${today.getFullYear()}-${pad(today.getMonth() + 1)}-${pad(today.getDate())}`;
  const monthFrom = `${today.getFullYear()}-${pad(today.getMonth() + 1)}-01`;

  const displayName = user?.full_name ?? "there";

  const todayAttendance = useQuery({
    queryKey: ["portal", "dashboard", "attendance-today", studentId],
    queryFn: () => attendanceService.fetchAttendanceRecords(studentId, todayIso, todayIso),
    enabled: !!studentId,
  });
  const monthAttendance = useQuery({
    queryKey: ["portal", "dashboard", "attendance-month", studentId],
    queryFn: () => dashboardService.fetchAttendanceSummary(studentId, monthFrom, todayIso),
    enabled: !!studentId,
  });
  const fees = useQuery({
    queryKey: ["portal", "dashboard", "fees", studentId],
    queryFn: () => dashboardService.fetchPendingFees(studentId),
    enabled: !!studentId,
  });
  const exams = useQuery({
    queryKey: ["portal", "dashboard", "exams", studentId],
    queryFn: () => dashboardService.fetchUpcomingExams(studentId),
    enabled: !!studentId,
  });
  const homework = useQuery({
    queryKey: ["portal", "dashboard", "homework", studentId],
    queryFn: () => dashboardService.fetchHomeworkToday(studentId),
    enabled: !!studentId,
  });
  const timetable = useQuery({
    queryKey: ["portal", "dashboard", "timetable", studentId],
    queryFn: () => dashboardService.fetchTodayTimetable(studentId),
    enabled: !!studentId,
  });
  const transport = useQuery({
    queryKey: ["portal", "dashboard", "transport", studentId],
    queryFn: () => dashboardService.fetchTransport(studentId),
    enabled: !!studentId,
  });
  const announcements = useQuery({
    queryKey: ["portal", "dashboard", "announcements", studentId],
    queryFn: () => dashboardService.fetchAnnouncements(studentId),
    enabled: !!studentId,
  });
  const marks = useQuery({
    queryKey: ["portal", "dashboard", "marks", studentId],
    queryFn: () => dashboardService.fetchMarksSummary(studentId),
    enabled: !!studentId,
  });
  const questionPapers = useQuery({
    queryKey: ["portal", "dashboard", "question-papers", studentId],
    queryFn: () => homeworkService.fetchQuestionPapers(studentId),
    enabled: !!studentId,
  });

  const markReadMutation = useMutation({
    mutationFn: (notificationId: string) => dashboardService.markAnnouncementRead(studentId, notificationId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["portal", "dashboard", "announcements", studentId] }),
  });

  const todayStatus = todayAttendance.data?.records[0]?.status;
  const todayDay = today.getDay();
  const todaysPeriods = timetable.data?.find((d) => d.dayOfWeek === todayDay)?.periods ?? [];
  const vehicle = transport.data?.pickup_points?.routes?.vehicle;

  return (
    <div className="space-y-6">
      <motion.div
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex flex-wrap items-end justify-between gap-3 rounded-2xl border p-5"
        style={{
          background: "linear-gradient(120deg, var(--portal-grad-from), var(--portal-grad-via), var(--portal-grad-to))",
          borderColor: "var(--portal-glass-border)",
        }}
      >
        <div>
          <h1 className="text-2xl font-semibold text-white">Welcome, {displayName}</h1>
          <p className="text-sm text-white/80">Here's what's happening today.</p>
        </div>
      </motion.div>

      <StoryCarousel />

      <motion.div
        variants={staggerContainer}
        initial="hidden"
        animate="show"
        className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4"
      >
        <PortalStatCard
          icon={CalendarCheck}
          label="Today's Attendance"
          value={todayAttendance.isLoading ? <PortalSkeleton className="h-7 w-16" /> : STATUS_LABEL[todayStatus ?? ""] ?? "Not marked"}
        />
        <PortalStatCard
          icon={ClipboardList}
          label="Attendance This Month"
          value={monthAttendance.isLoading ? <PortalSkeleton className="h-7 w-16" /> : monthAttendance.data?.percentage ?? 0}
          suffix={monthAttendance.isLoading || monthAttendance.data?.percentage == null ? "" : "%"}
        />
        <PortalStatCard
          icon={Wallet}
          label="Pending Fees"
          value={fees.isLoading ? <PortalSkeleton className="h-7 w-16" /> : `₹${Math.max(0, fees.data?.balance ?? 0).toFixed(0)}`}
        />
        <PortalStatCard
          icon={GraduationCap}
          label="Upcoming Exams"
          value={exams.isLoading ? <PortalSkeleton className="h-7 w-10" /> : exams.data?.length ?? 0}
          sublabel={exams.data?.[0] ? exams.data[0].name : undefined}
        />
        <PortalStatCard
          icon={BookOpen}
          label="Homework Today"
          value={homework.isLoading ? <PortalSkeleton className="h-7 w-10" /> : homework.data?.length ?? 0}
        />
        <PortalStatCard
          icon={Bell}
          label="New Announcements"
          value={announcements.isLoading ? <PortalSkeleton className="h-7 w-10" /> : announcements.data?.filter((n) => !n.isRead).length ?? 0}
        />
        <PortalStatCard
          icon={Bus}
          label="Transport Status"
          value={transport.isLoading ? <PortalSkeleton className="h-7 w-20" /> : vehicle ? vehicle.vehicle_number : "Not assigned"}
        />
        <PortalStatCard
          icon={CalendarClock}
          label="Today's Periods"
          value={timetable.isLoading ? <PortalSkeleton className="h-7 w-10" /> : todaysPeriods.length}
        />
      </motion.div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <PortalGlassCard className="space-y-4">
          <h2 className="text-lg font-semibold text-[var(--ink-primary)]">Homework</h2>
          {homework.isLoading ? (
            <PortalSkeleton className="h-24 w-full" />
          ) : !homework.data?.length ? (
            <p className="text-sm text-[var(--ink-muted)]">No homework due today.</p>
          ) : (
            <motion.ul variants={staggerContainer} initial="hidden" animate="show" className="space-y-2.5">
              {homework.data.map((hw) => (
                <motion.li
                  key={hw.id}
                  variants={fadeSlideUp}
                  className="rounded-xl border p-3 text-sm"
                  style={{ borderColor: "var(--portal-glass-border)" }}
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="font-medium text-[var(--ink-primary)]">{hw.title}</span>
                    <span className="text-xs text-[var(--ink-muted)]">Due {hw.due_date}</span>
                  </div>
                  {hw.subjects?.name && <p className="text-xs text-[var(--ink-muted)]">{hw.subjects.name}</p>}
                </motion.li>
              ))}
            </motion.ul>
          )}
        </PortalGlassCard>

        <PortalGlassCard className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-[var(--ink-primary)]">New Announcements</h2>
          </div>
          {announcements.isLoading ? (
            <PortalSkeleton className="h-24 w-full" />
          ) : !announcements.data?.length ? (
            <p className="text-sm text-[var(--ink-muted)]">No announcements yet.</p>
          ) : (
            <motion.ul variants={staggerContainer} initial="hidden" animate="show" className="space-y-2.5">
              {announcements.data.slice(0, 5).map((note) => (
                <motion.li
                  key={note.id}
                  variants={fadeSlideUp}
                  className="rounded-xl border p-3 text-sm"
                  style={{
                    borderColor: note.isRead ? "var(--portal-glass-border)" : "var(--portal-accent)",
                    background: note.isRead ? "transparent" : "var(--portal-accent-soft)",
                  }}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="font-medium text-[var(--ink-primary)]">{note.title}</p>
                      <p className="text-[var(--ink-muted)]">{note.message}</p>
                    </div>
                    {!note.isRead && (
                      <Button variant="ghost" className="!px-2 !py-1 text-xs" onClick={() => markReadMutation.mutate(note.id)} isLoading={markReadMutation.isPending && markReadMutation.variables === note.id}>
                        Mark read
                      </Button>
                    )}
                  </div>
                </motion.li>
              ))}
            </motion.ul>
          )}
        </PortalGlassCard>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <PortalGlassCard className="space-y-4">
          <h2 className="text-lg font-semibold text-[var(--ink-primary)]">Marks</h2>
          {marks.isLoading ? (
            <PortalSkeleton className="h-24 w-full" />
          ) : !marks.data?.latestExam ? (
            <p className="text-sm text-[var(--ink-muted)]">No exam results published yet.</p>
          ) : (
            <div className="space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-sm font-medium text-[var(--ink-secondary)]">{marks.data.latestExam.examName}</p>
                <p className="text-lg font-bold text-[var(--ink-primary)]">
                  {marks.data.latestExam.percentage !== null ? `${marks.data.latestExam.percentage}%` : "—"}
                </p>
              </div>
              <ul className="space-y-1 text-sm">
                {marks.data.latestExam.subjects.map((s) => (
                  <li key={s.subjectId} className="flex justify-between border-b py-1" style={{ borderColor: "var(--portal-glass-border)" }}>
                    <span className="text-[var(--ink-muted)]">{s.subjectName}</span>
                    <span className="text-[var(--ink-primary)]">
                      {s.marksObtained} / {s.maxMarks} {s.grade ? `(${s.grade})` : ""}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </PortalGlassCard>

        <PortalGlassCard className="space-y-4">
          <h2 className="text-lg font-semibold text-[var(--ink-primary)]">Question Papers</h2>
          {questionPapers.isLoading ? (
            <PortalSkeleton className="h-24 w-full" />
          ) : !questionPapers.data?.length ? (
            <p className="text-sm text-[var(--ink-muted)]">No question papers published yet.</p>
          ) : (
            <ul className="space-y-2">
              {questionPapers.data.map((doc) => (
                <li key={doc.id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl border p-3 text-sm" style={{ borderColor: "var(--portal-glass-border)" }}>
                  <div>
                    <p className="font-medium text-[var(--ink-primary)]">{doc.exams?.name ?? "Exam"}</p>
                    <p className="text-xs text-[var(--ink-muted)]">{doc.exams?.subjects?.name ?? "General"}</p>
                  </div>
                  {doc.url && (
                    <a href={doc.url} target="_blank" rel="noreferrer" className="text-xs font-medium hover:underline" style={{ color: "var(--portal-accent)" }}>
                      View
                    </a>
                  )}
                </li>
              ))}
            </ul>
          )}
        </PortalGlassCard>
      </div>

      <PortalGlassCard className="space-y-4">
        <h2 className="text-lg font-semibold text-[var(--ink-primary)]">Today's Timetable — {DAY_NAMES[todayDay]}</h2>
        {timetable.isLoading ? (
          <PortalSkeleton className="h-16 w-full" />
        ) : todaysPeriods.length === 0 ? (
          <p className="text-sm text-[var(--ink-muted)]">No periods scheduled for today.</p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {todaysPeriods.map((p) => (
              <div key={p.id} className="rounded-xl border px-3 py-2 text-sm" style={{ borderColor: "var(--portal-glass-border)" }}>
                <p className="text-xs text-[var(--ink-muted)]">
                  {p.start_time.slice(0, 5)}–{p.end_time.slice(0, 5)}
                </p>
                <p className="font-medium text-[var(--ink-primary)]">{p.subjects?.name ?? "—"}</p>
              </div>
            ))}
          </div>
        )}
      </PortalGlassCard>
    </div>
  );
}

const STATUS_LABEL: Record<string, string> = {
  present: "Present",
  absent: "Absent",
  late: "Late",
  half_day: "Half day",
  leave: "On leave",
  excused: "Excused",
};
