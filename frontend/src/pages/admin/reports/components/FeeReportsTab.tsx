import { useQuery } from "@tanstack/react-query";
import { ExportButtons } from "@/components/ui/ExportButtons";
import { StatCard } from "@/pages/admin/dashboard/components/StatCard";
import { ChartCard } from "@/pages/admin/dashboard/components/ChartCard";
import { EmptyState } from "@/components/ui/EmptyState";
import { ErrorState } from "@/pages/admin/dashboard/components/states/ErrorState";
import { ReportsTabSkeleton } from "./ReportsSkeleton";
import { FeeMonthlyChart } from "./charts/FeeMonthlyChart";
import { FeeStatusChart } from "./charts/FeeStatusChart";
import * as reportsService from "@/services/admin/reports.service";
import { useSchool } from "@/hooks/useSchool";
import { StatCardData } from "@/types/adminDashboard.types";

function currency(value: number): string {
  return `₹${value.toLocaleString("en-IN")}`;
}

function flatTrend(good: boolean): StatCardData["trend"] {
  return { direction: "flat", percent: 0, upIsGood: good };
}

export function FeeReportsTab() {
  const { selectedSchool } = useSchool();

  const query = useQuery({
    queryKey: ["admin", "reports", "fees", selectedSchool.id],
    queryFn: reportsService.fetchFeeReport,
  });

  if (query.isLoading) return <ReportsTabSkeleton stats={4} charts={2} table={false} />;
  if (query.isError) {
    return <ErrorState message={query.error instanceof Error ? query.error.message : undefined} onRetry={() => query.refetch()} />;
  }

  const data = query.data;
  if (!data) return <EmptyState title="No fee data yet" description="Fee structures and payments will show up here once recorded." />;

  const { stats, analytics } = data;

  const statCards: StatCardData[] = [
    {
      id: "total-fees",
      label: "Total Fees",
      value: stats.totalFees,
      displayValue: currency(stats.totalFees),
      description: "Total amount due this year",
      trend: flatTrend(true),
      spark: Array.from({ length: 12 }, () => stats.totalFees),
      icon: "fee",
    },
    {
      id: "collected-fees",
      label: "Collected Fees",
      value: stats.collectedFees,
      displayValue: currency(stats.collectedFees),
      description: "Total amount received",
      trend: flatTrend(true),
      spark: analytics.collectionTrend.slice(-12).map((p) => p.value),
      icon: "feeCollected",
    },
    {
      id: "pending-fees",
      label: "Pending Fees",
      value: stats.pendingFees,
      displayValue: currency(stats.pendingFees),
      description: "Outstanding balance",
      trend: flatTrend(false),
      spark: Array.from({ length: 12 }, () => stats.pendingFees),
      icon: "pending",
    },
    {
      id: "todays-collection",
      label: "Today's Collection",
      value: stats.todaysCollection,
      displayValue: currency(stats.todaysCollection),
      description: "Received today",
      trend: flatTrend(true),
      spark: analytics.collectionTrend.slice(-12).map((p) => p.value),
      icon: "feeToday",
    },
  ];

  return (
    <div className="animate-fade-in space-y-6">
      <div className="flex justify-end">
        <ExportButtons
          title="Fee Reports — Monthly Collection"
          filename="fee-reports-monthly-collection"
          rows={analytics.monthlyCollection}
          columns={[
            { header: "Month", accessor: (r) => r.label },
            { header: "Collected", accessor: (r) => r.value },
          ]}
        />
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {statCards.map((s) => (
          <StatCard key={s.id} data={s} />
        ))}
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <ChartCard title="Monthly Fee Collection" subtitle="Last 6 months">
          <FeeMonthlyChart data={analytics.monthlyCollection} />
        </ChartCard>
        <ChartCard title="Fee Status" subtitle="Students by payment status">
          <FeeStatusChart data={analytics.statusBreakdown} />
        </ChartCard>
      </div>
    </div>
  );
}
