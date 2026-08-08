import { Bus, GraduationCap, Megaphone, UserCog, UserRoundPlus, Wallet } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { ActivityItem, ActivityKind } from "@/types/adminDashboard.types";
import { EmptyState } from "@/components/ui/EmptyState";

const KIND_META: Record<ActivityKind, { icon: LucideIcon; color: string }> = {
  student: { icon: UserRoundPlus, color: "var(--series-1)" },
  teacher: { icon: GraduationCap, color: "var(--series-7)" },
  fee: { icon: Wallet, color: "var(--status-good)" },
  announcement: { icon: Megaphone, color: "var(--series-4)" },
  leave: { icon: UserCog, color: "var(--status-warning)" },
  transport: { icon: Bus, color: "var(--series-2)" },
};

function timeAgo(isoDate: string): string {
  const minutes = Math.max(1, Math.floor((Date.now() - new Date(isoDate).getTime()) / 60_000));
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

export function RecentActivityFeed({ items }: { items: ActivityItem[] }) {
  if (items.length === 0) {
    return <EmptyState title="No recent activity" description="New admissions, payments, and updates will appear here." />;
  }

  return (
    <ul className="space-y-1">
      {items.map((item) => {
        const meta = KIND_META[item.kind];
        const Icon = meta.icon;
        return (
          <li
            key={item.id}
            className="flex items-start gap-3 rounded-lg px-2 py-2.5 transition-colors hover:bg-black/[0.03] dark:hover:bg-white/[0.04]"
          >
            <span
              className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg"
              style={{ backgroundColor: "color-mix(in srgb, " + meta.color + " 14%, transparent)", color: meta.color }}
            >
              <Icon size={15} strokeWidth={1.85} />
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-[var(--ink-primary)]">{item.title}</p>
              <p className="truncate text-xs text-[var(--ink-muted)]">{item.subtitle}</p>
            </div>
            <span className="shrink-0 whitespace-nowrap pt-0.5 text-xs text-[var(--ink-muted)]">
              {timeAgo(item.timestamp)}
            </span>
          </li>
        );
      })}
    </ul>
  );
}
