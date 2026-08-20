import { ChevronLeft, ChevronRight, X } from "lucide-react";

interface TourSpotlightProps {
  /** Viewport-relative rect of the nav item to highlight, or null if it isn't currently visible (e.g. mobile). */
  rect: DOMRect | null;
  title: string;
  description: string;
  index: number;
  total: number;
  onNext: () => void;
  onBack: () => void;
  onClose: () => void;
}

const PAD = 6;
const TOOLTIP_WIDTH = 320;

/**
 * One box, transparent fill, its own box-shadow spread far past the
 * viewport — that shadow *is* the dimmed backdrop everywhere outside the
 * box, with the box itself left untouched as the "cutout". The classic
 * spotlight technique: robust to any rect (no separate rects to keep in
 * sync with each other, so nothing can misalign into a stray filled box).
 */
function Spotlight({ rect }: { rect: DOMRect }) {
  return (
    <div
      className="pointer-events-none fixed z-[9998] rounded-lg border-2 border-brand-400 bg-transparent transition-all duration-200 ease-out"
      style={{
        top: rect.top - PAD,
        left: rect.left - PAD,
        width: rect.width + PAD * 2,
        height: rect.height + PAD * 2,
        boxShadow: "0 0 0 9999px rgba(15, 23, 42, 0.7)",
      }}
    />
  );
}

function tooltipPosition(rect: DOMRect | null) {
  if (!rect) return null;
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const fitsRight = rect.right + PAD + 12 + TOOLTIP_WIDTH < vw;

  if (fitsRight) {
    return { left: rect.right + PAD + 12, top: Math.min(Math.max(rect.top, 12), vh - 260) };
  }
  return {
    left: Math.min(Math.max(rect.left, 12), vw - TOOLTIP_WIDTH - 12),
    top: Math.min(rect.bottom + PAD + 12, vh - 260),
  };
}

export function TourSpotlight({ rect, title, description, index, total, onNext, onBack, onClose }: TourSpotlightProps) {
  const isLast = index === total - 1;
  const pos = tooltipPosition(rect);

  return (
    <>
      {/* Full-screen click-catcher, behind the spotlight box — the box's own box-shadow provides all the visual dimming. */}
      <div className="fixed inset-0 z-[9997]" onClick={onClose} />
      {rect ? <Spotlight rect={rect} /> : <div className="fixed inset-0 z-[9997] bg-slate-900/70" />}

      <div
        className="fixed z-[9999] w-80 rounded-xl border border-slate-200 bg-white p-4 shadow-2xl dark:border-white/10 dark:bg-[#1c1c1f]"
        style={
          pos
            ? { left: pos.left, top: pos.top }
            : { left: "50%", top: "50%", transform: "translate(-50%, -50%)" }
        }
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-2 flex items-start justify-between gap-2">
          <h3 className="text-sm font-semibold text-slate-900 dark:text-white">{title}</h3>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close tour"
            className="shrink-0 rounded-md p-0.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-white/10 dark:hover:text-slate-300"
          >
            <X size={15} />
          </button>
        </div>
        <p className="text-sm text-slate-600 dark:text-slate-300">{description}</p>

        <div className="mt-4 flex items-center justify-between border-t border-slate-100 pt-3 dark:border-white/[0.08]">
          <button
            type="button"
            onClick={onBack}
            disabled={index === 0}
            className="flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium text-slate-600 hover:bg-slate-100 disabled:opacity-30 disabled:hover:bg-transparent dark:text-slate-400 dark:hover:bg-white/10"
          >
            <ChevronLeft size={14} />
            Back
          </button>
          <span className="text-xs text-slate-400 dark:text-slate-500">
            {index + 1} / {total}
          </span>
          <button
            type="button"
            onClick={isLast ? onClose : onNext}
            className="flex items-center gap-1 rounded-md bg-brand-600 px-2.5 py-1 text-xs font-medium text-white hover:bg-brand-700"
          >
            {isLast ? "Done" : "Next"}
            {!isLast && <ChevronRight size={14} />}
          </button>
        </div>
      </div>
    </>
  );
}
