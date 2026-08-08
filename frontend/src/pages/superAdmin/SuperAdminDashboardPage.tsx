import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import {
  Bus,
  Building2,
  CircleSlash,
  GraduationCap,
  ShieldCheck,
  Sparkles,
  UserCheck,
  Users,
  Wallet,
  Contact,
  Wrench,
} from "lucide-react";
import * as superAdminService from "@/services/superAdmin.service";
import { ChartCard } from "@/pages/admin/dashboard/components/ChartCard";
import { Skeleton } from "@/components/ui/Skeleton";
import { PlatformStatCard } from "./components/PlatformStatCard";
import { PageHeader } from "./components/PageHeader";
import {
  GrowthAreaChart,
  SchoolsByStatusChart,
  StudentsBySchoolChart,
  UsersByRoleChart,
} from "./components/PlatformCharts";

/**
 * §4 — the platform's high-level dashboard. Deliberately aggregate-only: no
 * student-level rows appear here, only counts and distributions.
 */
export function SuperAdminDashboardPage() {
  const navigate = useNavigate();
  const { data, isLoading, isError, error } = useQuery({
    queryKey: ["super-admin", "dashboard"],
    queryFn: superAdminService.fetchDashboard,
  });

  if (isError) {
    return (
      <div>
        <PageHeader title="Platform Overview" />
        <div className="rounded-2xl border border-rose-500/20 bg-rose-500/5 p-6 text-sm text-rose-600 dark:text-rose-400">
          Couldn&apos;t load platform statistics. {(error as Error)?.message}
        </div>
      </div>
    );
  }

  if (isLoading || !data) return <DashboardSkeleton />;

  const { totals, charts } = data;

  const schoolCards = [
    { label: "Total Schools", value: totals.totalSchools, icon: Building2, tone: "sky" as const },
    {
      label: "Active Schools",
      value: totals.activeSchools,
      icon: ShieldCheck,
      tone: "emerald" as const,
      hint: `${totals.totalSchools} total`,
    },
    {
      label: "Inactive Schools",
      value: totals.inactiveSchools,
      icon: CircleSlash,
      tone: "rose" as const,
      hint: "Data preserved, access off",
    },
    {
      label: "School Admins",
      value: totals.totalSchoolAdmins,
      icon: UserCheck,
      tone: "violet" as const,
      hint: `${totals.activeSchoolAdmins} active`,
    },
  ];

  const peopleCards = [
    { label: "Principals", value: totals.totalPrincipals, icon: UserCheck, tone: "accent" as const },
    { label: "Teachers", value: totals.totalTeachers, icon: Users, tone: "accent" as const },
    { label: "Students", value: totals.totalStudents, icon: GraduationCap, tone: "emerald" as const },
    {
      label: "Parent Contacts",
      value: totals.parentContacts,
      icon: Contact,
      tone: "violet" as const,
      hint: "Guardians on student profiles",
    },
    { label: "Accountants", value: totals.totalAccountants, icon: Wallet, tone: "emerald" as const },
    { label: "Drivers", value: totals.totalDrivers, icon: Bus, tone: "amber" as const },
    {
      label: "Extracurricular Staff",
      value: totals.totalExtracurricularStaff,
      icon: Sparkles,
      tone: "amber" as const,
    },
    { label: "Support Staff", value: totals.totalSupportStaff, icon: Wrench, tone: "sky" as const },
  ];

  return (
    <div>
      <PageHeader
        title="Platform Overview"
        subtitle={`${totals.totalSchools} school${totals.totalSchools === 1 ? "" : "s"} across the platform`}
      />

      <section className="mb-6">
        <h2 className="mb-3 text-[11px] font-semibold uppercase tracking-wider text-[var(--ink-muted)]">Schools</h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {schoolCards.map((card, i) => (
            <PlatformStatCard
              key={card.label}
              {...card}
              entranceDelayMs={i * 45}
              onClick={() => navigate("/dashboard/super-admin/schools")}
            />
          ))}
        </div>
      </section>

      <section className="mb-6">
        <h2 className="mb-3 text-[11px] font-semibold uppercase tracking-wider text-[var(--ink-muted)]">People</h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {peopleCards.map((card, i) => (
            <PlatformStatCard key={card.label} {...card} entranceDelayMs={i * 40} />
          ))}
        </div>
      </section>

      <section className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <ChartCard title="Schools by Status" subtitle="Active vs inactive across the platform">
          <SchoolsByStatusChart data={charts.schoolsByStatus} />
        </ChartCard>

        <ChartCard title="Users by Role" subtitle="Account distribution platform-wide">
          <UsersByRoleChart data={charts.usersByRole} />
        </ChartCard>

        <ChartCard title="Students by School" subtitle="Enrolment spread across tenants">
          <StudentsBySchoolChart data={charts.studentsBySchool} />
        </ChartCard>

        <ChartCard title="School Growth" subtitle="Cumulative schools onboarded">
          <GrowthAreaChart data={charts.schoolGrowth} label="Schools" color="var(--series-1)" />
        </ChartCard>

        <ChartCard title="User Growth" subtitle="Cumulative accounts across all schools" className="lg:col-span-2">
          <GrowthAreaChart data={charts.userGrowth} label="Users" color="var(--series-3)" />
        </ChartCard>
      </section>
    </div>
  );
}

function DashboardSkeleton() {
  return (
    <div>
      <PageHeader title="Platform Overview" subtitle="Loading platform statistics…" />
      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-[124px] rounded-2xl" />
        ))}
      </div>
      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 8 }).map((_, i) => (
          <Skeleton key={i} className="h-[124px] rounded-2xl" />
        ))}
      </div>
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-[280px] rounded-2xl" />
        ))}
      </div>
    </div>
  );
}
