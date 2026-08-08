import { ReactNode, useEffect, useState } from "react";
import { X } from "lucide-react";

interface DrawerProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children: ReactNode;
  width?: "md" | "lg" | "xl";
}

const WIDTH_CLASSES = {
  md: "max-w-md",
  lg: "max-w-lg",
  xl: "max-w-2xl",
};

/**
 * Slide-over panel from the right, for detail/edit views that want more room
 * than Modal's centered dialog without leaving the current page context (the
 * Users Module's profile view). Stays mounted through the close transition
 * (unmounts on transitionend) so it animates out instead of vanishing.
 */
export function Drawer({ isOpen, onClose, title, description, children, width = "lg" }: DrawerProps) {
  const [shouldRender, setShouldRender] = useState(isOpen);

  useEffect(() => {
    if (isOpen) setShouldRender(true);
  }, [isOpen]);

  useEffect(() => {
    function handleEscape(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }
    if (isOpen) document.addEventListener("keydown", handleEscape);
    return () => document.removeEventListener("keydown", handleEscape);
  }, [isOpen, onClose]);

  if (!shouldRender) return null;

  return (
    <div className="fixed inset-0 z-50" role="dialog" aria-modal="true" aria-label={title}>
      <div
        className={`absolute inset-0 bg-black/40 transition-opacity duration-300 ${isOpen ? "opacity-100" : "opacity-0"}`}
        onClick={onClose}
      />
      <div
        className={`absolute inset-y-0 right-0 flex w-full ${WIDTH_CLASSES[width]} flex-col bg-white shadow-2xl transition-transform duration-300 ease-out dark:bg-[#17171a] ${
          isOpen ? "translate-x-0" : "translate-x-full"
        }`}
        onTransitionEnd={() => {
          if (!isOpen) setShouldRender(false);
        }}
      >
        <div className="flex items-start justify-between border-b border-black/[0.06] px-6 py-4 dark:border-white/[0.08]">
          <div>
            <h2 className="text-lg font-semibold text-[var(--ink-primary)]">{title}</h2>
            {description && <p className="mt-0.5 text-sm text-[var(--ink-muted)]">{description}</p>}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="rounded-md p-1.5 text-[var(--ink-muted)] transition-colors hover:bg-black/[0.04] dark:hover:bg-white/[0.06]"
          >
            <X size={18} />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto px-6 py-5">{children}</div>
      </div>
    </div>
  );
}
