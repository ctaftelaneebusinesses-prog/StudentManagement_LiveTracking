import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import { CalendarRange, Layers, Ruler, UserCheck, Users2 } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { ChartCard } from "@/pages/admin/dashboard/components/ChartCard";
import { ClassRoom } from "@/types/admin.types";

function InfoCard({ icon: Icon, label, value }: { icon: LucideIcon; label: string; value: ReactNode }) {
  return (
    <div className="flex items-start gap-3 rounded-2xl border border-black/[0.06] bg-white p-5 dark:border-white/[0.08] dark:bg-[#17171a]">
      <span className="flex h-10 w-10 flex-none items-center justify-center rounded-xl bg-accent-50 text-accent-600 dark:bg-accent-900/40 dark:text-accent-300">
        <Icon size={18} strokeWidth={1.75} />
      </span>
      <div className="min-w-0">
        <p className="text-xs font-medium text-[var(--ink-muted)]">{label}</p>
        <p className="mt-0.5 truncate text-sm font-semibold text-[var(--ink-primary)]">{value}</p>
      </div>
    </div>
  );
}

export function ClassOverviewTab({ klass }: { klass: ClassRoom | undefined }) {
  if (!klass) {
    return (
      <ChartCard title="Overview">
        <div className="h-24 animate-pulse rounded-xl bg-black/[0.04] dark:bg-white/[0.04]" />
      </ChartCard>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
      <InfoCard icon={CalendarRange} label="Academic Year" value={klass.academic_years?.name ?? "—"} />
      <InfoCard icon={UserCheck} label="Class Teacher" value={klass.class_teacher?.full_name ?? "Unassigned"} />
      <InfoCard icon={Layers} label="Section" value={klass.section} />
      <InfoCard icon={Ruler} label="Capacity" value={klass.capacity ?? "Not set"} />
      <InfoCard
        icon={Users2}
        label="Status"
        value={<Badge variant={klass.status === "active" ? "success" : "neutral"}>{klass.status === "active" ? "Active" : "Inactive"}</Badge>}
      />
      <InfoCard icon={Users2} label="Total Students" value={klass.student_count ?? 0} />
    </div>
  );
}
