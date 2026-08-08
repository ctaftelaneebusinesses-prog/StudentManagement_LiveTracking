import { useState } from "react";
import { Link } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Layers,
  BookOpen,
  Users,
  CalendarClock,
  ClipboardList,
  GraduationCap,
  CalendarCheck,
  CalendarX,
  ChevronRight,
  FilePlus2,
  ClipboardCheck,
  CalendarPlus,
  LogIn,
  LogOut,
  type LucideIcon,
} from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useNotifications } from "@/hooks/useNotifications";
import { Card } from "@/components/ui/Card";
import { Skeleton } from "@/components/ui/Skeleton";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { DataTable } from "@/components/ui/DataTable";
import { EmptyState } from "@/components/ui/EmptyState";
import { useToast } from "@/components/ui/Toast";
import { getApiErrorMessage } from "@/lib/axios";
import * as portalService from "@/services/teacher/portal.service";
import * as selfAttendanceService from "@/services/teacher/selfAttendance.service";
import { TeacherClassSummary } from "@/types/teacher.types";
import { NOTIFICATION_TYPE_LABEL } from "@/types/notification.types";
import { ClassSizeChart } from "./components/ClassSizeChart";

interface QuickAction {
  label: string;
  to: string;
  icon: LucideIcon;
}

const QUICK_ACTIONS: QuickAction[] = [
  { label: "Create homework", to: "/dashboard/teacher/homework", icon: FilePlus2 },
  { label: "Mark attendance", to: "/dashboard/teacher/attendance", icon: ClipboardCheck },
  { label: "Apply for leave", to: "/dashboard/teacher/leave", icon: CalendarPlus },
  { label: "View timetable", to: "/dashboard/teacher/timetable", icon: CalendarClock },
];

function timeAgo(isoDate: string): string {
  const seconds = Math.floor((Date.now() - new Date(isoDate).getTime()) / 1000);
  if (seconds < 60) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

interface SummaryCardDef {
  label: string;
  value: number;
  icon: LucideIcon;
  accent: string;
  to?: string;
}

export function TeacherDashboardPage() {
  const { user } = useAuth();
  const [expandedClassId, setExpandedClassId] = useState<string | null>(null);
  const { notifications } = useNotifications();

  const { data, isLoading } = useQuery({
    queryKey: ["teacher", "dashboard"],
    queryFn: portalService.fetchDashboard,
  });

  const rosterQuery = useQuery({
    queryKey: ["teacher", "roster", expandedClassId],
    queryFn: () => portalService.fetchRoster(expandedClassId!),
    enabled: !!expandedClassId,
  });

  const cards: SummaryCardDef[] = [
    { label: "My Classes", value: data?.totalClasses ?? 0, icon: Layers, accent: "from-brand-500 to-brand-700", to: "/dashboard/teacher/students" },
    { label: "My Subjects", value: data?.totalSubjects ?? 0, icon: BookOpen, accent: "from-violet-500 to-violet-700" },
    { label: "Total Students", value: data?.totalStudents ?? 0, icon: Users, accent: "from-emerald-500 to-emerald-700", to: "/dashboard/teacher/students" },
    { label: "Today's Classes", value: data?.todayClassesCount ?? 0, icon: CalendarClock, accent: "from-amber-500 to-amber-700", to: "/dashboard/teacher/timetable" },
    { label: "Pending Homework", value: data?.pendingHomeworkCount ?? 0, icon: ClipboardList, accent: "from-sky-500 to-sky-700", to: "/dashboard/teacher/homework" },
    { label: "Upcoming Assessments", value: data?.upcomingAssessmentsCount ?? 0, icon: GraduationCap, accent: "from-rose-500 to-rose-700", to: "/dashboard/teacher/assessments" },
    { label: "Leave Balance", value: data?.leaveBalance ?? 0, icon: CalendarCheck, accent: "from-teal-500 to-teal-700", to: "/dashboard/teacher/leave" },
    { label: "Pending Leave Requests", value: data?.pendingLeaveRequestsCount ?? 0, icon: CalendarX, accent: "from-orange-500 to-orange-700", to: "/dashboard/teacher/leave" },
  ];

  return (
    <div className="animate-fade-in space-y-6">
      <div className="border-l-4 border-teal-500 pl-4">
        <h1 className="text-2xl font-semibold text-[var(--ink-primary)]">Welcome, {user?.full_name ?? "there"}</h1>
        <p className="text-sm text-[var(--ink-muted)]">Here's what's happening across your classes today.</p>
      </div>

      <SelfAttendanceCard />

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {QUICK_ACTIONS.map((action) => (
          <Link
            key={action.to}
            to={action.to}
            className="group flex flex-col items-center gap-2 rounded-2xl border border-black/[0.06] bg-white p-4 text-center shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md dark:border-white/[0.08] dark:bg-[#17171a]"
          >
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand-50 text-brand-600 transition-colors group-hover:bg-brand-100 dark:bg-brand-500/15 dark:text-brand-300">
              <action.icon size={17} strokeWidth={1.85} />
            </span>
            <span className="text-xs font-medium text-[var(--ink-secondary)]">{action.label}</span>
          </Link>
        ))}
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 gap-4 min-[420px]:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <Skeleton key={i} className="h-28 w-full" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 min-[420px]:grid-cols-2 lg:grid-cols-4">
          {cards.map((card) => (
            <SummaryCard key={card.label} {...card} />
          ))}
        </div>
      )}

      <Card className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-[var(--ink-primary)]">My classes</h2>
          <Link to="/dashboard/teacher/students" className="text-sm font-medium text-brand-600 hover:underline">
            View all students →
          </Link>
        </div>
        {isLoading ? (
          <Skeleton className="h-32 w-full" />
        ) : !data || data.classes.length === 0 ? (
          <EmptyState title="No classes assigned yet" description="Once the admin assigns you to a class or subject, it will appear here." />
        ) : (
          <ul className="space-y-3">
            {data.classes.map((klass) => (
              <ClassRow
                key={klass.id}
                klass={klass}
                isExpanded={expandedClassId === klass.id}
                onToggle={() => setExpandedClassId(expandedClassId === klass.id ? null : klass.id)}
                roster={expandedClassId === klass.id ? rosterQuery.data : undefined}
                isRosterLoading={expandedClassId === klass.id && rosterQuery.isLoading}
              />
            ))}
          </ul>
        )}
      </Card>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card className="space-y-3">
          <h2 className="text-lg font-semibold text-[var(--ink-primary)]">Class sizes</h2>
          {isLoading ? (
            <Skeleton className="h-44 w-full" />
          ) : !data || data.classes.length === 0 ? (
            <EmptyState title="No classes yet" />
          ) : (
            <ClassSizeChart classes={data.classes} />
          )}
        </Card>

        <Card className="space-y-3">
          <h2 className="text-lg font-semibold text-[var(--ink-primary)]">Recent activity</h2>
          {notifications.length === 0 ? (
            <EmptyState title="Nothing yet" description="Updates about your leave requests and school announcements will show up here." />
          ) : (
            <ul className="divide-y divide-black/[0.04] dark:divide-white/[0.05]">
              {notifications.slice(0, 6).map((n) => (
                <li key={n.id} className="py-2.5 first:pt-0 last:pb-0">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[11px] font-medium uppercase tracking-wide text-brand-600 dark:text-brand-300">
                      {NOTIFICATION_TYPE_LABEL[n.type]}
                    </span>
                    <span className="shrink-0 text-[11px] text-[var(--ink-muted)]">{timeAgo(n.created_at)}</span>
                  </div>
                  <p className="mt-0.5 text-sm font-medium text-[var(--ink-primary)]">{n.title}</p>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </div>
  );
}

function SelfAttendanceCard() {
  const queryClient = useQueryClient();
  const toast = useToast();

  const { data, isLoading } = useQuery({
    queryKey: ["teacher", "attendance", "today"],
    queryFn: selfAttendanceService.fetchTodayStatus,
  });

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["teacher", "attendance", "today"] });

  const checkInMutation = useMutation({
    mutationFn: selfAttendanceService.checkIn,
    onSuccess: () => {
      toast.success("Checked in for today");
      invalidate();
    },
    onError: (err) => toast.error(getApiErrorMessage(err, "Failed to check in.")),
  });

  const checkOutMutation = useMutation({
    mutationFn: selfAttendanceService.checkOut,
    onSuccess: () => {
      toast.success("Checked out for today");
      invalidate();
    },
    onError: (err) => toast.error(getApiErrorMessage(err, "Failed to check out.")),
  });

  if (isLoading || !data) {
    return <Skeleton className="h-20 w-full" />;
  }

  const hasCheckedIn = !!data.check_in_at;
  const hasCheckedOut = !!data.check_out_at;

  return (
    <Card className="flex flex-wrap items-center justify-between gap-4">
      <div>
        <div className="flex items-center gap-2">
          <h2 className="text-sm font-semibold text-[var(--ink-primary)]">Today's attendance</h2>
          {data.status && (
            <Badge variant={data.status === "present" ? "success" : data.status === "absent" ? "danger" : "neutral"}>
              {data.status.replace("_", " ")}
            </Badge>
          )}
        </div>
        <p className="mt-1 text-xs text-[var(--ink-muted)]">
          {hasCheckedIn ? `Checked in at ${new Date(data.check_in_at!).toLocaleTimeString()}` : "Not checked in yet"}
          {hasCheckedOut ? ` · Checked out at ${new Date(data.check_out_at!).toLocaleTimeString()}` : ""}
          {data.checkin_cutoff && !hasCheckedIn ? ` · Cutoff ${data.checkin_cutoff}` : ""}
        </p>
      </div>
      <div className="flex gap-2">
        {!hasCheckedIn ? (
          <Button onClick={() => checkInMutation.mutate()} isLoading={checkInMutation.isPending}>
            <LogIn size={16} /> Check In
          </Button>
        ) : !hasCheckedOut ? (
          <Button variant="secondary" onClick={() => checkOutMutation.mutate()} isLoading={checkOutMutation.isPending}>
            <LogOut size={16} /> Check Out
          </Button>
        ) : null}
      </div>
    </Card>
  );
}

function SummaryCard({ label, value, icon: Icon, accent, to }: SummaryCardDef) {
  const content = (
    <Card className="group relative min-w-0 overflow-hidden transition-shadow hover:shadow-md">
      <div className={`absolute -right-4 -top-4 h-20 w-20 rounded-full bg-gradient-to-br opacity-10 ${accent}`} />
      <div className="flex items-start justify-between">
        <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br text-white shadow-sm ${accent}`}>
          <Icon size={18} strokeWidth={1.75} />
        </span>
        {to && <ChevronRight size={16} className="mt-1 shrink-0 text-[var(--ink-muted)] opacity-0 transition-opacity group-hover:opacity-100" />}
      </div>
      <p className="mt-4 text-3xl font-semibold tracking-tight text-[var(--ink-primary)]">{value}</p>
      <p className="mt-0.5 break-words text-sm text-[var(--ink-muted)]">{label}</p>
    </Card>
  );

  return to ? (
    <Link to={to} className="block min-w-0">
      {content}
    </Link>
  ) : (
    content
  );
}

function ClassRow({
  klass,
  isExpanded,
  onToggle,
  roster,
  isRosterLoading,
}: {
  klass: TeacherClassSummary;
  isExpanded: boolean;
  onToggle: () => void;
  roster: Awaited<ReturnType<typeof portalService.fetchRoster>> | undefined;
  isRosterLoading: boolean;
}) {
  return (
    <li className="rounded-xl border border-black/[0.06] p-4 dark:border-white/[0.08]">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-[var(--ink-primary)]">
            {klass.name} - {klass.section}
            {klass.isHomeroom && (
              <span className="ml-2 rounded-full bg-brand-50 px-2 py-0.5 text-xs font-medium text-brand-700 dark:bg-brand-500/15 dark:text-brand-300">
                Homeroom
              </span>
            )}
          </p>
          <p className="mt-1 text-xs text-[var(--ink-muted)]">
            {klass.subjects.length === 0 ? "No subjects assigned" : klass.subjects.map((s) => s.name).join(", ")}
          </p>
          <p className="mt-1 text-xs text-[var(--ink-muted)]">{klass.studentCount} student(s)</p>
        </div>
        <Button variant="secondary" className="!px-3 !py-1.5 text-xs" onClick={onToggle}>
          {isExpanded ? "Hide students" : "View students"}
        </Button>
      </div>

      {isExpanded && (
        <div className="mt-4 border-t border-black/[0.06] pt-4 dark:border-white/[0.08]">
          <DataTable
            isLoading={isRosterLoading}
            rows={roster ?? []}
            rowKey={(s) => s.id}
            emptyMessage="No students in this class yet."
            columns={[
              { header: "Admission No", cell: (s) => s.admission_no },
              { header: "Roll No", cell: (s) => s.roll_no ?? "—" },
              { header: "Name", cell: (s) => s.users.full_name },
              { header: "Email", cell: (s) => s.users.email },
            ]}
          />
        </div>
      )}
    </li>
  );
}
