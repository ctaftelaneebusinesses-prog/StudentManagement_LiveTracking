import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Sparkles, Layers, Users, CalendarClock, Clock, MapPin, type LucideIcon } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { Card } from "@/components/ui/Card";
import { Skeleton } from "@/components/ui/Skeleton";
import { EmptyState } from "@/components/ui/EmptyState";
import * as portalService from "@/services/extracurricularPortal.service";
import { formatTime } from "./utils";

interface SummaryCardDef {
  label: string;
  value: number;
  icon: LucideIcon;
  accent: string;
  to?: string;
}

export function ExtracurricularDashboardPage() {
  const { user } = useAuth();

  const { data, isLoading } = useQuery({
    queryKey: ["extracurricular", "dashboard"],
    queryFn: portalService.fetchPortalDashboard,
  });

  const scheduleQuery = useQuery({
    queryKey: ["extracurricular", "schedule", "today"],
    queryFn: portalService.fetchTodaySchedule,
  });

  const cards: SummaryCardDef[] = [
    { label: "My Activities", value: data?.activitiesCount ?? 0, icon: Sparkles, accent: "from-amber-500 to-amber-700", to: "/dashboard/extracurricular/activities" },
    { label: "My Batches", value: data?.batchesCount ?? 0, icon: Layers, accent: "from-brand-500 to-brand-700", to: "/dashboard/extracurricular/students" },
    { label: "Total Students", value: data?.totalStudents ?? 0, icon: Users, accent: "from-emerald-500 to-emerald-700", to: "/dashboard/extracurricular/students" },
    { label: "Today's Sessions", value: data?.todaySessionCount ?? 0, icon: CalendarClock, accent: "from-sky-500 to-sky-700", to: "/dashboard/extracurricular/schedule" },
  ];

  return (
    <div className="animate-fade-in space-y-6">
      <div className="border-l-4 border-amber-500 pl-4">
        <h1 className="text-2xl font-semibold text-[var(--ink-primary)]">Welcome, {user?.full_name ?? "there"}</h1>
        <p className="text-sm text-[var(--ink-muted)]">Here's what's happening across your activities today.</p>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 gap-4 min-[420px]:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
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
          <h2 className="text-lg font-semibold text-[var(--ink-primary)]">Today's schedule</h2>
          <Link to="/dashboard/extracurricular/schedule" className="text-sm font-medium text-brand-600 hover:underline">
            View full week →
          </Link>
        </div>
        {scheduleQuery.isLoading ? (
          <Skeleton className="h-32 w-full" />
        ) : !scheduleQuery.data || scheduleQuery.data.length === 0 ? (
          <EmptyState title="No sessions today" description="Your recurring schedule slots for today will appear here." />
        ) : (
          <ul className="space-y-3">
            {scheduleQuery.data.map((slot) => {
              const batch = slot.extracurricular_batches;
              return (
                <li key={slot.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-black/[0.06] p-4 dark:border-white/[0.08]">
                  <div>
                    <p className="text-sm font-semibold text-[var(--ink-primary)]">
                      {batch?.activities?.name ?? "Activity"}
                      {batch?.classes && (
                        <span className="ml-2 text-xs font-normal text-[var(--ink-muted)]">
                          {batch.classes.name} - {batch.classes.section}
                        </span>
                      )}
                    </p>
                    {batch?.name && <p className="mt-0.5 text-xs text-[var(--ink-muted)]">{batch.name}</p>}
                  </div>
                  <div className="flex items-center gap-4 text-xs text-[var(--ink-secondary)]">
                    <span className="inline-flex items-center gap-1">
                      <Clock size={13} strokeWidth={1.75} className="text-[var(--ink-muted)]" />
                      {formatTime(slot.start_time)} – {formatTime(slot.end_time)}
                    </span>
                    {slot.venue && (
                      <span className="inline-flex items-center gap-1">
                        <MapPin size={13} strokeWidth={1.75} className="text-[var(--ink-muted)]" />
                        {slot.venue}
                      </span>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </Card>
    </div>
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
