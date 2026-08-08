import { ReactNode } from "react";

interface ChartCardProps {
  title: string;
  subtitle?: string;
  legend?: ReactNode;
  children: ReactNode;
  className?: string;
}

export function ChartCard({ title, subtitle, legend, children, className = "" }: ChartCardProps) {
  return (
    <div
      className={`rounded-2xl border border-black/[0.06] bg-white p-5 shadow-sm transition-shadow duration-200
        hover:shadow-md dark:border-white/[0.08] dark:bg-[#17171a] ${className}`}
    >
      <div className="mb-4 flex flex-wrap items-start justify-between gap-2">
        <div>
          <h3 className="text-sm font-semibold text-[var(--ink-primary)]">{title}</h3>
          {subtitle && <p className="mt-0.5 text-xs text-[var(--ink-muted)]">{subtitle}</p>}
        </div>
        {legend}
      </div>
      {children}
    </div>
  );
}
