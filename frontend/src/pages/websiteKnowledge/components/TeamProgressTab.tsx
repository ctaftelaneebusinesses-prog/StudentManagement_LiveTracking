import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";
import * as wkService from "@/services/websiteKnowledge.service";
import { useAuth } from "@/hooks/useAuth";
import { EmptyState } from "@/components/ui/EmptyState";
import { ChartCard } from "@/pages/admin/dashboard/components/ChartCard";
import { ChartTooltip } from "@/pages/admin/dashboard/components/ChartTooltip";
import { ChartLegend } from "@/pages/admin/dashboard/components/ChartLegend";
import { GenericProgressRow, ProgressTable } from "./ProgressTable";
import { HistoryDrawer } from "./HistoryDrawer";
import { SummaryStatCards } from "./SummaryStatCards";
import { summarizeRows } from "../utils";
import { SummaryCounts } from "@/types/websiteKnowledge.types";

type Scope = "class_teacher" | "principal" | "school_admin" | "super_admin" | "none";

const COLORS = ["var(--series-2)", "var(--series-4)", "var(--series-1)", "var(--series-3)"];

function DistributionChart({ counts }: { counts: SummaryCounts }) {
  const data = [
    { label: "Passed", value: counts.passed },
    { label: "Failed", value: counts.failed },
    { label: "In Progress", value: counts.in_progress },
    { label: "Not Attempted", value: counts.not_attempted },
  ].filter((d) => d.value > 0);

  if (data.length === 0) return <EmptyState title="No data yet" description="Results will appear here once attempts start coming in." />;

  return (
    <div>
      <ResponsiveContainer width="100%" height={200}>
        <PieChart>
          <Tooltip content={<ChartTooltip formatValue={(v) => String(v)} />} />
          <Pie data={data} dataKey="value" nameKey="label" innerRadius={44} outerRadius={80} paddingAngle={2} isAnimationActive={false}>
            {data.map((entry, i) => (
              <Cell key={entry.label} fill={COLORS[i % COLORS.length]} stroke="var(--surface)" strokeWidth={2} />
            ))}
          </Pie>
        </PieChart>
      </ResponsiveContainer>
      <div className="mt-2">
        <ChartLegend items={data.map((d, i) => ({ label: d.label, color: COLORS[i % COLORS.length] }))} />
      </div>
    </div>
  );
}

export function TeamProgressTab() {
  const { hasRole } = useAuth();
  const [selected, setSelected] = useState<string | null>(null);

  const scope: Scope = hasRole("super_admin")
    ? "super_admin"
    : hasRole("school_admin")
      ? "school_admin"
      : hasRole("principal")
        ? "principal"
        : hasRole("teacher")
          ? "class_teacher"
          : "none";

  const studentsQuery = useQuery({
    queryKey: ["website-knowledge", "monitoring", "students"],
    queryFn: wkService.listStudentsProgress,
    enabled: scope === "class_teacher",
  });
  const teachersQuery = useQuery({
    queryKey: ["website-knowledge", "monitoring", "teachers"],
    queryFn: wkService.listTeachersProgress,
    enabled: scope === "principal",
  });
  const principalsQuery = useQuery({
    queryKey: ["website-knowledge", "monitoring", "principals"],
    queryFn: wkService.listPrincipalsProgress,
    enabled: scope === "school_admin",
  });
  const schoolAdminsQuery = useQuery({
    queryKey: ["website-knowledge", "monitoring", "school-admins"],
    queryFn: wkService.listSchoolAdminsProgress,
    enabled: scope === "super_admin",
  });
  const globalStatsQuery = useQuery({
    queryKey: ["website-knowledge", "monitoring", "global-stats"],
    queryFn: wkService.getGlobalStats,
    enabled: scope === "super_admin",
  });

  const rows: GenericProgressRow[] = useMemo(() => {
    if (scope === "class_teacher") {
      return (studentsQuery.data ?? []).map((s) => ({
        ...s,
        id: s.student_id,
        name: s.full_name,
        subtitle: s.class_name ? `${s.class_name} ${s.section ?? ""}`.trim() : null,
      }));
    }
    if (scope === "principal") {
      return (teachersQuery.data ?? []).map((t) => ({ ...t, id: t.teacher_id, name: t.full_name, subtitle: "Teacher" }));
    }
    if (scope === "school_admin") {
      return (principalsQuery.data ?? []).map((p) => ({ ...p, id: p.principal_id, name: p.full_name, subtitle: p.school_name }));
    }
    if (scope === "super_admin") {
      return (schoolAdminsQuery.data ?? []).map((sa) => ({ ...sa, id: sa.school_admin_id, name: sa.full_name, subtitle: sa.school_name }));
    }
    return [];
  }, [scope, studentsQuery.data, teachersQuery.data, principalsQuery.data, schoolAdminsQuery.data]);

  const isLoading = studentsQuery.isLoading || teachersQuery.isLoading || principalsQuery.isLoading || schoolAdminsQuery.isLoading;
  const counts = scope === "super_admin" && globalStatsQuery.data
    ? {
        total: globalStatsQuery.data.total_users,
        completed: globalStatsQuery.data.total_completed,
        not_attempted: globalStatsQuery.data.total_not_attempted,
        in_progress: rows.filter((r) => r.status === "in_progress").length,
        passed: globalStatsQuery.data.total_passed,
        failed: globalStatsQuery.data.total_failed,
        certified: globalStatsQuery.data.total_certified,
      }
    : summarizeRows(rows);

  const titleByScope: Record<Scope, string> = {
    class_teacher: "Student Assessment Progress",
    principal: "Teacher Progress",
    school_admin: "Principal Progress",
    super_admin: "School Admin Progress",
    none: "",
  };
  const subtitleLabelByScope: Record<Scope, string> = {
    class_teacher: "Class",
    principal: "Role",
    school_admin: "School",
    super_admin: "School",
    none: "",
  };

  function fetchHistory() {
    if (!selected) return Promise.reject(new Error("no selection"));
    if (scope === "class_teacher") return wkService.getStudentHistory(selected);
    if (scope === "principal") return wkService.getTeacherHistory(selected);
    if (scope === "school_admin") return wkService.getPrincipalHistory(selected);
    return wkService.getSchoolAdminHistory(selected);
  }

  if (scope === "none") {
    return <EmptyState title="No team to monitor" description="This view is available to class teachers, principals, school admins, and super admins." />;
  }

  const selectedRow = rows.find((r) => r.id === selected);

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold text-[var(--ink-primary)]">{titleByScope[scope]}</h3>
        <p className="text-sm text-[var(--ink-muted)]">Website Knowledge Assessment results for the people you oversee.</p>
      </div>

      <SummaryStatCards counts={counts} />

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <ProgressTable rows={rows} subtitleLabel={subtitleLabelByScope[scope]} isLoading={isLoading} onView={setSelected} />
        </div>
        <ChartCard title="Pass / Fail Distribution">
          <DistributionChart counts={counts} />
        </ChartCard>
      </div>

      <HistoryDrawer
        isOpen={!!selected}
        onClose={() => setSelected(null)}
        title={selectedRow?.name ?? "Attempt History"}
        description={selectedRow?.subtitle ?? undefined}
        queryKey={["website-knowledge", "monitoring", "history", scope, selected]}
        fetchHistory={fetchHistory}
        enabled={!!selected}
      />
    </div>
  );
}
