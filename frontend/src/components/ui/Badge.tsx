import { ReactNode } from "react";

export type BadgeVariant = "neutral" | "success" | "warning" | "danger" | "info";

const VARIANT_STYLES: Record<BadgeVariant, string> = {
  neutral: "bg-black/[0.05] text-[var(--ink-secondary)] dark:bg-white/[0.08]",
  success: "bg-[var(--status-good)]/10 text-[var(--status-good)]",
  warning: "bg-[var(--status-warning)]/10 text-[var(--status-warning)]",
  danger: "bg-[var(--status-serious)]/10 text-[var(--status-serious)]",
  info: "bg-accent-500/10 text-accent-600 dark:text-accent-400",
};

interface BadgeProps {
  variant?: BadgeVariant;
  children: ReactNode;
  className?: string;
}

export function Badge({ variant = "neutral", children, className = "" }: BadgeProps) {
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold ${VARIANT_STYLES[variant]} ${className}`}
    >
      {children}
    </span>
  );
}
