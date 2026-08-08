import { useAuth } from "@/hooks/useAuth";
import { useSchool } from "@/hooks/useSchool";
import { ROLE_HEADER_ACCENT } from "@/utils/roles";
import { useAdminOverview } from "./hooks/useAdminOverview";
import { StatCard } from "./components/StatCard";
import { ChartCard } from "./components/ChartCard";
import { RecentActivityFeed } from "./components/RecentActivityFeed";
import { DashboardSkeleton } from "./components/states/DashboardSkeleton";
import { EmptyState } from "@/components/ui/EmptyState";
import { ErrorState } from "./components/states/ErrorState";
import { MonthlyFeeBarChart } from "./components/charts/MonthlyFeeBarChart";
import { AttendanceLineChart } from "./components/charts/AttendanceLineChart";
import { TeacherAttendanceBarChart } from "./components/charts/TeacherAttendanceBarChart";
import { ClassDistributionPieChart } from "./components/charts/ClassDistributionPieChart";
import { FeeTrendAreaChart } from "./components/charts/FeeTrendAreaChart";
import { TransportUsageDoughnutChart } from "./components/charts/TransportUsageDoughnutChart";
import { CalendarClock } from "lucide-react";

export function AdminDashboardPage() {
  const { user } = useAuth();
  const { selectedSchool } = useSchool();
  const { data, isLoading, isError, error, refetch, isFetching } = useAdminOverview();

  if (isLoading) return <DashboardSkeleton />;

  if (isError) {
    return <ErrorState message={error instanceof Error ? error.message : undefined} onRetry={() => refetch()} />;
  }

  if (!data) {
    return <EmptyState title="No dashboard data" description="Metrics for this school aren't available yet." />;
  }

  return (
    <div className="animate-fade-in space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className={`border-l-4 pl-4 ${ROLE_HEADER_ACCENT[user?.roles.name ?? "school_admin"]}`}>
          <h1 className="text-2xl font-semibold text-[var(--ink-primary)]">
            Welcome back, {user?.full_name?.split(" ")[0] ?? "Admin"}
          </h1>
          <p className="mt-1 text-sm text-[var(--ink-muted)]">
            Here's what's happening at {selectedSchool.name} today.
          </p>
        </div>
        {isFetching && (
          <span className="text-xs text-[var(--ink-muted)]">Refreshing…</span>
        )}
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5">
        {data.stats.map((stat, index) => (
          <StatCard key={stat.id} data={stat} entranceDelayMs={index * 50} />
        ))}
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 xl:grid-cols-3">
        <ChartCard title="Monthly Fee Collection" subtitle="Last 6 months">
          <MonthlyFeeBarChart data={data.charts.monthlyFeeCollection} />
        </ChartCard>

        <ChartCard title="Student Attendance" subtitle="Daily attendance rate, last 14 days">
          <AttendanceLineChart data={data.charts.studentAttendance} />
        </ChartCard>

        <ChartCard title="Fee Trend" subtitle="Daily collection, last 30 days">
          <FeeTrendAreaChart data={data.charts.feeTrend} />
        </ChartCard>

        <ChartCard title="Teacher Attendance" subtitle="This week, by day">
          <TeacherAttendanceBarChart data={data.charts.teacherAttendance} />
        </ChartCard>

        <ChartCard title="Class Distribution" subtitle="Students by grade band">
          <ClassDistributionPieChart data={data.charts.classDistribution} />
        </ChartCard>

        <ChartCard title="Transport Usage" subtitle="Fleet status right now">
          <TransportUsageDoughnutChart data={data.charts.transportUsage} />
        </ChartCard>
      </div>

      <ChartCard title="Recent Activity" subtitle="Latest updates across the school">
        {data.activity.length === 0 ? (
          <EmptyState
            icon={CalendarClock}
            title="Nothing new yet"
            description="Admissions, payments, and staff updates will show up here as they happen."
          />
        ) : (
          <RecentActivityFeed items={data.activity} />
        )}
      </ChartCard>
    </div>
  );
}
