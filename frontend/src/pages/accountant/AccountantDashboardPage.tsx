import { Receipt, Wallet } from "lucide-react";
import { useFeeDashboard } from "@/pages/admin/fees/hooks/useFeeDashboard";
import { useFeeAnalytics } from "@/pages/admin/fees/hooks/useFeeAnalytics";
import { useRecentActivity } from "./hooks/useRecentActivity";
import { StatCard } from "@/pages/admin/dashboard/components/StatCard";
import { ChartCard } from "@/pages/admin/dashboard/components/ChartCard";
import { ErrorState } from "@/pages/admin/dashboard/components/states/ErrorState";
import { FeesOverviewSkeleton } from "@/pages/admin/fees/components/FeesSkeleton";
import { FeeCollectionBarChart } from "@/pages/admin/fees/components/charts/FeeCollectionBarChart";
import { FeeCollectionTrendLineChart } from "@/pages/admin/fees/components/charts/FeeCollectionTrendLineChart";
import { FeeStatusPieChart } from "@/pages/admin/fees/components/charts/FeeStatusPieChart";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { FeeDashboardStats } from "@/types/fees.types";
import { StatCardData } from "@/types/adminDashboard.types";

function currency(value: number): string {
  return `₹${value.toLocaleString("en-IN")}`;
}

function buildStatCards(stats: FeeDashboardStats, moneySpark: number[]): StatCardData[] {
  const flat = (value: number) => Array.from({ length: 12 }, () => value);
  const flatTrend = { direction: "flat" as const, percent: 0, upIsGood: true };
  const flatTrendBad = { direction: "flat" as const, percent: 0, upIsGood: false };
  const spark = moneySpark.length > 0 ? moneySpark : flat(stats.collectedFees);

  return [
    {
      id: "acct-total-collection",
      label: "Total Fee Collection",
      value: stats.collectedFees,
      displayValue: currency(stats.collectedFees),
      description: "Collected so far",
      trend: flatTrend,
      spark,
      icon: "feeCollected",
    },
    {
      id: "acct-today-collection",
      label: "Today's Collection",
      value: stats.todaysCollection,
      displayValue: currency(stats.todaysCollection),
      description: "Received today",
      trend: flatTrend,
      spark: flat(stats.todaysCollection),
      icon: "feeToday",
    },
    {
      id: "acct-week-collection",
      label: "This Week's Collection",
      value: stats.weekCollection,
      displayValue: currency(stats.weekCollection),
      description: "Received since Sunday",
      trend: flatTrend,
      spark: flat(stats.weekCollection),
      icon: "feeWeek",
    },
    {
      id: "acct-month-collection",
      label: "This Month's Collection",
      value: stats.monthCollection,
      displayValue: currency(stats.monthCollection),
      description: "Received this calendar month",
      trend: flatTrend,
      spark: flat(stats.monthCollection),
      icon: "feeMonth",
    },
    {
      id: "acct-year-collection",
      label: "This Year's Collection",
      value: stats.yearCollection,
      displayValue: currency(stats.yearCollection),
      description: "Received this calendar year",
      trend: flatTrend,
      spark: flat(stats.yearCollection),
      icon: "feeYear",
    },
    {
      id: "acct-pending-fees",
      label: "Total Pending Fees",
      value: stats.pendingFees,
      displayValue: currency(stats.pendingFees),
      description: "Outstanding balance school-wide",
      trend: flatTrendBad,
      spark: flat(stats.pendingFees),
      icon: "pending",
    },
    {
      id: "acct-paid-students",
      label: "Total Paid Students",
      value: stats.paidStudentsCount,
      description: "Fully paid up",
      trend: flatTrend,
      spark: flat(stats.paidStudentsCount),
      icon: "studentsPaid",
    },
    {
      id: "acct-due-students",
      label: "Total Due Students",
      value: stats.pendingStudentsCount,
      description: "Have an outstanding balance",
      trend: flatTrendBad,
      spark: flat(stats.pendingStudentsCount),
      icon: "studentsPending",
    },
  ];
}

export function AccountantDashboardPage() {
  const dashboardQuery = useFeeDashboard();
  const analyticsQuery = useFeeAnalytics();
  const activityQuery = useRecentActivity();

  if (dashboardQuery.isLoading || analyticsQuery.isLoading) return <FeesOverviewSkeleton />;

  if (dashboardQuery.isError || analyticsQuery.isError) {
    const err = dashboardQuery.error ?? analyticsQuery.error;
    return (
      <ErrorState
        message={err instanceof Error ? err.message : undefined}
        onRetry={() => {
          dashboardQuery.refetch();
          analyticsQuery.refetch();
        }}
      />
    );
  }

  const stats = dashboardQuery.data;
  const analytics = analyticsQuery.data;
  if (!stats || !analytics) {
    return <EmptyState title="No fee data yet" description="Fee structures and payments will show up here once recorded." />;
  }

  const moneySpark = analytics.collectionTrend.slice(-12).map((p) => p.value);
  const statCards = buildStatCards(stats, moneySpark);
  const activity = activityQuery.data;

  return (
    <div className="animate-fade-in space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-[var(--ink-primary)]">Finance Dashboard</h1>
        <p className="mt-1 text-sm text-[var(--ink-muted)]">Collections, balances, and recent fee activity at a glance.</p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {statCards.map((s, i) => (
          <StatCard key={s.id} data={s} entranceDelayMs={i * 40} />
        ))}
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 xl:grid-cols-3">
        <ChartCard title="Monthly Fee Collection" subtitle="Last 6 months">
          <FeeCollectionBarChart data={analytics.monthlyCollection} />
        </ChartCard>
        <ChartCard title="Paid vs Pending Fees" subtitle="Students by payment status">
          <FeeStatusPieChart data={analytics.statusBreakdown} />
        </ChartCard>
        <ChartCard title="Daily Collection Trend" subtitle="Last 30 days">
          <FeeCollectionTrendLineChart data={analytics.collectionTrend} />
        </ChartCard>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card>
          <div className="mb-3 flex items-center gap-2">
            <Wallet size={16} className="text-accent-600" strokeWidth={1.75} />
            <h3 className="text-sm font-semibold text-[var(--ink-primary)]">Recent Fee Payments</h3>
          </div>
          {!activity || activity.recentPayments.length === 0 ? (
            <EmptyState title="No payments yet" description="Recorded payments will show up here." />
          ) : (
            <ul className="divide-y divide-black/[0.06] dark:divide-white/[0.08]">
              {activity.recentPayments.map((p) => (
                <li key={p.id} className="flex items-center justify-between py-2.5 text-sm">
                  <div className="min-w-0">
                    <p className="truncate font-medium text-[var(--ink-primary)]">{p.studentName || p.admissionNo}</p>
                    <p className="text-xs text-[var(--ink-muted)]">
                      {p.receiptNo} · {new Date(p.paymentDate).toLocaleDateString("en-IN")}
                    </p>
                  </div>
                  <span className="shrink-0 font-semibold text-[var(--status-good)]">{currency(p.amount)}</span>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card>
          <div className="mb-3 flex items-center gap-2">
            <Receipt size={16} className="text-accent-600" strokeWidth={1.75} />
            <h3 className="text-sm font-semibold text-[var(--ink-primary)]">Recently Updated Fee Records</h3>
          </div>
          {!activity || activity.recentFeeUpdates.length === 0 ? (
            <EmptyState title="No fee records yet" description="Newly added or updated fees will show up here." />
          ) : (
            <ul className="divide-y divide-black/[0.06] dark:divide-white/[0.08]">
              {activity.recentFeeUpdates.map((f) => (
                <li key={f.id} className="flex items-center justify-between py-2.5 text-sm">
                  <div className="min-w-0">
                    <p className="truncate font-medium text-[var(--ink-primary)]">{f.target}</p>
                    <p className="text-xs text-[var(--ink-muted)]">
                      {f.term} · {new Date(f.createdAt).toLocaleDateString("en-IN")}
                    </p>
                  </div>
                  <span className="shrink-0 font-semibold text-[var(--ink-primary)]">{currency(f.amount)}</span>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </div>
  );
}
