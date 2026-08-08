import { ReactNode } from "react";
import { motion } from "framer-motion";
import { fadeSlideUp } from "./portalMotion";

interface PortalGlassCardProps {
  className?: string;
  children: ReactNode;
  /** Skips the hover-lift affordance for cards that aren't interactive surfaces (e.g. a stats-only panel). */
  noHover?: boolean;
  onClick?: () => void;
}

/** Themed replacement for components/ui/Card inside the Student/Parent Portal only — glass background + soft gradient border driven by the --portal-* tokens (see PortalThemeContext), with a mount-in animation. */
export function PortalGlassCard({ className = "", children, noHover, onClick }: PortalGlassCardProps) {
  return (
    <motion.div
      variants={fadeSlideUp}
      initial="hidden"
      animate="show"
      onClick={onClick}
      whileHover={noHover ? undefined : { y: -3 }}
      transition={{ type: "spring", stiffness: 300, damping: 24 }}
      className={`rounded-2xl border p-5 shadow-sm backdrop-blur-xl sm:p-6 ${
        noHover ? "" : "hover:shadow-portal-glow"
      } ${className}`}
      style={{
        background: "var(--portal-glass-bg)",
        borderColor: "var(--portal-glass-border)",
      }}
    >
      {children}
    </motion.div>
  );
}
