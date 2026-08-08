import type { LucideIcon } from "lucide-react";
import { ReactNode } from "react";
import { motion } from "framer-motion";
import { useCountUp } from "@/hooks/useCountUp";
import { fadeSlideUp } from "./portalMotion";

interface PortalStatCardProps {
  icon: LucideIcon;
  label: string;
  /** A number animates via useCountUp; anything else (loading skeletons, formatted strings) renders as-is. */
  value: number | ReactNode;
  /** Appended after an animated numeric value, e.g. "%" or " / 30". Ignored when `value` isn't a number. */
  suffix?: string;
  sublabel?: ReactNode;
  onClick?: () => void;
}

/**
 * Consolidates pages/portal/components/StatCard.tsx and the richer
 * pages/admin/dashboard/components/StatCard.tsx into one portal-themed stat
 * tile: animated counter (useCountUp) for numeric values, gradient icon chip
 * driven by the active --portal-* theme, glass card base shared with
 * PortalGlassCard's mount animation.
 */
export function PortalStatCard({ icon: Icon, label, value, suffix, sublabel, onClick }: PortalStatCardProps) {
  const isNumeric = typeof value === "number";
  const animated = useCountUp(isNumeric ? value : 0);

  return (
    <motion.div
      variants={fadeSlideUp}
      initial="hidden"
      animate="show"
      whileHover={{ y: -3 }}
      transition={{ type: "spring", stiffness: 300, damping: 24 }}
      onClick={onClick}
      role={onClick ? "button" : undefined}
      tabIndex={onClick ? 0 : undefined}
      className={`rounded-2xl border p-5 shadow-sm backdrop-blur-xl hover:shadow-portal-glow ${onClick ? "cursor-pointer" : ""}`}
      style={{ background: "var(--portal-glass-bg)", borderColor: "var(--portal-glass-border)" }}
    >
      <div className="flex items-center gap-2.5">
        <span
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-white shadow-sm"
          style={{ background: "linear-gradient(135deg, var(--portal-grad-from), var(--portal-grad-to))" }}
        >
          <Icon size={18} strokeWidth={1.85} />
        </span>
        <p className="truncate text-[13px] font-medium leading-tight text-[var(--ink-secondary)]">{label}</p>
      </div>
      <div className="mt-3 text-[26px] font-semibold leading-none text-[var(--ink-primary)]">
        {isNumeric ? `${animated}${suffix ?? ""}` : value}
      </div>
      {sublabel && <p className="mt-1.5 text-xs text-[var(--ink-muted)]">{sublabel}</p>}
    </motion.div>
  );
}
