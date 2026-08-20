import { useEffect, useState } from "react";
import { QUICK_TOUR_ICON } from "./quickTourContent";
import { TOUR_STEP_COPY, fallbackTourDescription } from "./tourCopy";
import { TourSpotlight } from "./TourSpotlight";

interface TourStep {
  id: string;
  label: string;
}

function isVisible(el: HTMLElement): boolean {
  const r = el.getBoundingClientRect();
  return r.width > 0 && r.height > 0;
}

/** Every currently-rendered nav item, in sidebar order, deduped (mobile drawer + desktop rail share ids when both exist). */
function collectSteps(): TourStep[] {
  const nodes = Array.from(document.querySelectorAll<HTMLElement>("[data-tour-id]"));
  const byId = new Map<string, HTMLElement>();
  for (const el of nodes) {
    const id = el.dataset.tourId!;
    const current = byId.get(id);
    if (!current || (!isVisible(current) && isVisible(el))) byId.set(id, el);
  }
  return Array.from(byId.entries()).map(([id, el]) => ({ id, label: el.dataset.tourLabel ?? id }));
}

/**
 * Walks the sidebar the user is actually looking at, one real nav item at a
 * time — spotlighting it and explaining what's there — instead of a generic
 * feature list. Requires the target elements to carry `data-tour-id`
 * (route path) and `data-tour-label` (visible label), added on the NavLinks
 * in layouts/components/Sidebar.tsx, pages/admin/dashboard/shell/AdminSidebar.tsx,
 * and .../SuperAdminMergedSidebar.tsx. Used post-login only — pre-login
 * (AuthSplitLayout) there's no real sidebar to point at, so that still uses
 * the static role-overview QuickTour modal.
 */
export function SidebarTour() {
  const [steps, setSteps] = useState<TourStep[] | null>(null);
  const [index, setIndex] = useState(0);
  const [rect, setRect] = useState<DOMRect | null>(null);

  const isOpen = steps !== null;

  function openTour() {
    const collected = collectSteps();
    if (collected.length === 0) return;
    setSteps(collected);
    setIndex(0);
  }

  function closeTour() {
    setSteps(null);
  }

  useEffect(() => {
    if (!isOpen || !steps) return;
    const step = steps[index];
    const el = document.querySelector<HTMLElement>(`[data-tour-id="${step.id}"]`);
    if (!el) {
      setRect(null);
      return;
    }
    el.scrollIntoView({ block: "nearest", behavior: "smooth" });
    const measure = () => setRect(el.getBoundingClientRect());
    measure();
    const settle = setTimeout(measure, 300);
    window.addEventListener("resize", measure);
    window.addEventListener("scroll", measure, true);
    return () => {
      clearTimeout(settle);
      window.removeEventListener("resize", measure);
      window.removeEventListener("scroll", measure, true);
    };
  }, [isOpen, index, steps]);

  useEffect(() => {
    if (!isOpen) return;
    function handleEscape(e: KeyboardEvent) {
      if (e.key === "Escape") closeTour();
    }
    document.addEventListener("keydown", handleEscape);
    return () => document.removeEventListener("keydown", handleEscape);
  }, [isOpen]);

  return (
    <>
      <button
        type="button"
        onClick={openTour}
        aria-label="Quick tour: what's on this dashboard"
        className="flex items-center gap-1.5 rounded-full px-2.5 py-2 text-sm font-medium text-slate-600 transition-colors hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-white/10 dark:hover:text-white"
      >
        <QUICK_TOUR_ICON size={17} strokeWidth={1.85} />
        <span className="hidden sm:inline">Quick Tour</span>
      </button>

      {isOpen && steps && (
        <TourSpotlight
          rect={rect}
          title={steps[index].label}
          description={TOUR_STEP_COPY[steps[index].id] ?? fallbackTourDescription(steps[index].label)}
          index={index}
          total={steps.length}
          onNext={() => setIndex((i) => Math.min(i + 1, steps.length - 1))}
          onBack={() => setIndex((i) => Math.max(i - 1, 0))}
          onClose={closeTour}
        />
      )}
    </>
  );
}
