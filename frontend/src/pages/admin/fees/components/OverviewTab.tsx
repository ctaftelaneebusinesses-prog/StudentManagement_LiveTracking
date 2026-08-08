import { useFeeDashboard } from "../hooks/useFeeDashboard";
import { useFeeAnalytics } from "../hooks/useFeeAnalytics";
import { StatCard } from "@/pages/admin/dashboard/components/StatCard";
import { ChartCard } from "@/pages/admin/dashboard/components/ChartCard";
import { EmptyState } from "@/components/ui/EmptyState";
import { ErrorState } from "@/pages/admin/dashboard/components/states/ErrorState";
import { FeesOverviewSkeleton } from "./FeesSkeleton";
import { FeeCollectionBarChart } from "./charts/FeeCollectionBarChart";
import { FeeCollectionTrendLineChart } from "./charts/FeeCollectionTrendLineChart";
import { FeeStatusPieChart } from "./charts/FeeStatusPieChart";
import { FeeDashboardStats } from "@/types/fees.types";
import { StatCardData } from "@/types/adminDashboard.types";

function currency(value: number): string {
  return `₹${value.toLocaleString("en-IN")}`;
}

function buildStatCards(stats: FeeDashboardStats, moneySpark: number[]): StatCardData[] {
  const flat = (value: number) => Array.from({ length: 12 }, () => value);
  const trendUp = { direction: "flat" as const, percent: 0, upIsGood: true };
  const trendDown = { direction: "flat" as const, percent: 0, upIsGood: false };

  return [
    {
      id: "total-fees",
      label: "Total Fees",
      value: stats.totalFees,
      displayValue: currency(stats.totalFees),
      description: "Total amount due this year",
      trend: trendUp,
      spark: flat(stats.totalFees),
      icon: "fee",
    },
    {
      id: "collected-fees",
      label: "Collected Fees",
      value: stats.collectedFees,
      displayValue: currency(stats.collectedFees),
      description: "Total amount received",
      trend: trendUp,
      spark: moneySpark.length > 0 ? moneySpark : flat(stats.collectedFees),
      icon: "feeCollected",
    },
    {
      id: "pending-fees",
      label: "Pending Fees",
      value: stats.pendingFees,
      displayValue: currency(stats.pendingFees),
      description: "Outstanding balance",
      trend: trendDown,
      spark: flat(stats.pendingFees),
      icon: "pending",
    },
    {
      id: "todays-collection",
      label: "Today's Collection",
      value: stats.todaysCollection,
      displayValue: currency(stats.todaysCollection),
      description: "Received today",
      trend: trendUp,
      spark: moneySpark.length > 0 ? moneySpark : flat(stats.todaysCollection),
      icon: "feeToday",
    },
    {
      id: "paid-students",
      label: "Paid Students",
      value: stats.paidStudentsCount,
      description: "Fully paid up",
      trend: trendUp,
      spark: flat(stats.paidStudentsCount),
      icon: "studentsPaid",
    },
    {
      id: "pending-students",
      label: "Pending Students",
      value: stats.pendingStudentsCount,
      description: "Have an outstanding balance",
      trend: trendDown,
      spark: flat(stats.pendingStudentsCount),
      icon: "studentsPending",
    },
  ];
}

export function OverviewTab() {
  const dashboardQuery = useFeeDashboard();
  const analyticsQuery = useFeeAnalytics();

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

  return (
    <div className="animate-fade-in space-y-6">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {statCards.map((s) => (
          <StatCard key={s.id} data={s} />
        ))}
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 xl:grid-cols-3">
        <ChartCard title="Monthly Fee Collection" subtitle="Last 6 months">
          <FeeCollectionBarChart data={analytics.monthlyCollection} />
        </ChartCard>
        <ChartCard title="Collection Trend" subtitle="Last 30 days">
          <FeeCollectionTrendLineChart data={analytics.collectionTrend} />
        </ChartCard>
        <ChartCard title="Fee Status" subtitle="Students by payment status">
          <FeeStatusPieChart data={analytics.statusBreakdown} />
        </ChartCard>
      </div>
    </div>
  );
}
