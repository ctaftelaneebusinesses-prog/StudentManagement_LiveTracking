import { ReactNode } from "react";

interface PageHeaderProps {
  title: string;
  subtitle?: string;
  actions?: ReactNode;
}

/** Shared heading for every platform-console page — matches the school console's header rhythm. */
export function PageHeader({ title, subtitle, actions }: PageHeaderProps) {
  return (
    <div className="mb-6 flex flex-wrap items-start justify-between gap-3 border-l-[3px] border-sky-500 pl-3.5">
      <div className="min-w-0">
        <h1 className="text-xl font-semibold leading-tight text-[var(--ink-primary)] sm:text-2xl">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-[var(--ink-muted)]">{subtitle}</p>}
      </div>
      {actions && <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

/** Active/Inactive pill used across Schools, School Admins and the overview. */
export function StatusPill({ isActive, cascaded }: { isActive: boolean; cascaded?: boolean }) {
  if (isActive) {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/10 px-2.5 py-1 text-xs font-semibold text-emerald-600 dark:text-emerald-400">
        <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
        Active
      </span>
    );
  }
  return (
    <span
      title={cascaded ? "Switched off by a cascade — reactivating its School Admin will restore it" : undefined}
      className="inline-flex items-center gap-1.5 rounded-full bg-rose-500/10 px-2.5 py-1 text-xs font-semibold text-rose-600 dark:text-rose-400"
    >
      <span className="h-1.5 w-1.5 rounded-full bg-rose-500" />
      {cascaded ? "Inactive (cascade)" : "Inactive"}
    </span>
  );
}
