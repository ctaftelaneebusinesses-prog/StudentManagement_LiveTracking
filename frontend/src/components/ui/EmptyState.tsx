import { Inbox } from "lucide-react";
import type { LucideIcon } from "lucide-react";

interface EmptyStateProps {
  title: string;
  description?: string;
  icon?: LucideIcon;
}

export function EmptyState({ title, description, icon: Icon = Inbox }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 py-10 text-center">
      <span className="flex h-11 w-11 items-center justify-center rounded-full bg-black/[0.04] text-[var(--ink-muted)] dark:bg-white/[0.06]">
        <Icon size={20} strokeWidth={1.5} />
      </span>
      <p className="text-sm font-medium text-[var(--ink-secondary)]">{title}</p>
      {description && <p className="max-w-[220px] text-xs text-[var(--ink-muted)]">{description}</p>}
    </div>
  );
}
