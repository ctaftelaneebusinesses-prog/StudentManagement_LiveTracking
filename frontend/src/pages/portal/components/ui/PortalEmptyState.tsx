import type { LucideIcon } from "lucide-react";
import { Inbox } from "lucide-react";
import { motion } from "framer-motion";

interface PortalEmptyStateProps {
  title: string;
  description?: string;
  icon?: LucideIcon;
}

/**
 * Themed replacement for components/ui/EmptyState inside the Student/Parent
 * Portal — an animated gradient icon (float + soft pulse rings) instead of a
 * flat grey circle, so "no data yet" screens read as a designed state rather
 * than a placeholder. Deliberately not wired to lottie-react: hand-authored
 * Lottie JSON is fragile to get right and real illustration assets aren't
 * available in this environment, so a framer-motion-animated icon fills the
 * same "premium empty state" brief without an unreliable external asset.
 */
export function PortalEmptyState({ title, description, icon: Icon = Inbox }: PortalEmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-12 text-center">
      <div className="relative flex h-16 w-16 items-center justify-center">
        <motion.span
          className="absolute inset-0 rounded-full"
          style={{ background: "var(--portal-accent-soft)" }}
          animate={{ scale: [1, 1.15, 1], opacity: [0.7, 0.3, 0.7] }}
          transition={{ duration: 2.6, repeat: Infinity, ease: "easeInOut" }}
        />
        <motion.span
          className="relative flex h-12 w-12 items-center justify-center rounded-2xl text-white shadow-md"
          style={{ background: "linear-gradient(135deg, var(--portal-grad-from), var(--portal-grad-to))" }}
          animate={{ y: [0, -5, 0] }}
          transition={{ duration: 3.2, repeat: Infinity, ease: "easeInOut" }}
        >
          <Icon size={20} strokeWidth={1.75} />
        </motion.span>
      </div>
      <p className="text-sm font-semibold text-[var(--ink-primary)]">{title}</p>
      {description && <p className="max-w-[260px] text-xs text-[var(--ink-muted)]">{description}</p>}
    </div>
  );
}
