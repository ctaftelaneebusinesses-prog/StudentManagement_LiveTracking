import { motion } from "framer-motion";

interface PortalProgressBarProps {
  /** 0-100. Values outside that range are clamped. */
  percent: number;
  label?: string;
  className?: string;
}

/** Animated fill bar (attendance %, fee-collection %) for the Student/Parent Portal — fills from 0 to `percent` on mount/update instead of appearing statically. */
export function PortalProgressBar({ percent, label, className = "" }: PortalProgressBarProps) {
  const clamped = Math.min(100, Math.max(0, percent));

  return (
    <div className={className}>
      {label && (
        <div className="mb-1.5 flex items-center justify-between text-xs font-medium text-[var(--ink-secondary)]">
          <span>{label}</span>
          <span>{clamped}%</span>
        </div>
      )}
      <div className="h-2.5 w-full overflow-hidden rounded-full bg-[color-mix(in_srgb,var(--portal-accent)_12%,transparent)]">
        <motion.div
          className="h-full rounded-full"
          style={{ background: "linear-gradient(90deg, var(--portal-grad-from), var(--portal-grad-to))" }}
          initial={{ width: 0 }}
          animate={{ width: `${clamped}%` }}
          transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
        />
      </div>
    </div>
  );
}
