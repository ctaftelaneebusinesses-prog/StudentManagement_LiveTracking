import { ReactNode, useEffect } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { X } from "lucide-react";

interface PortalModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  size?: "md" | "lg" | "xl";
}

const SIZE_CLASSES = { md: "max-w-md", lg: "max-w-lg", xl: "max-w-2xl" };

/**
 * Portal-only replacement for components/ui/Modal — same API/behavior
 * (escape-to-close, backdrop click, sizes) but with an actual open/close
 * transition via framer-motion's AnimatePresence, since the base Modal pops
 * in/out instantly. Kept scoped to portal pages so the base Modal (used by
 * every other role) is untouched.
 */
export function PortalModal({ isOpen, onClose, title, children, size = "lg" }: PortalModalProps) {
  useEffect(() => {
    function handleEscape(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }
    if (isOpen) document.addEventListener("keydown", handleEscape);
    return () => document.removeEventListener("keydown", handleEscape);
  }, [isOpen, onClose]);

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
          aria-label={title}
          onClick={onClose}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.15 }}
        >
          <motion.div
            className={`max-h-[90vh] w-full ${SIZE_CLASSES[size]} overflow-y-auto rounded-2xl border p-6 shadow-2xl backdrop-blur-xl`}
            style={{ background: "var(--surface)", borderColor: "var(--portal-glass-border)" }}
            onClick={(e) => e.stopPropagation()}
            initial={{ opacity: 0, scale: 0.95, y: 12 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.97, y: 8 }}
            transition={{ type: "spring", stiffness: 340, damping: 28 }}
          >
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-[var(--ink-primary)]">{title}</h2>
              <button
                type="button"
                onClick={onClose}
                aria-label="Close"
                className="rounded-full p-1.5 text-[var(--ink-muted)] transition-colors hover:bg-black/5 hover:text-[var(--ink-primary)] dark:hover:bg-white/10"
              >
                <X size={16} strokeWidth={2} />
              </button>
            </div>
            {children}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
