import { useState } from "react";
import { ChevronLeft, ChevronRight, Check } from "lucide-react";
import { Modal } from "@/components/ui/Modal";
import { QUICK_TOUR_SLIDES, QUICK_TOUR_ICON } from "./quickTourContent";

/**
 * A self-contained "what's on this platform" widget: a trigger button plus a
 * paged modal, one slide per role. Dropped next to LanguageSwitcher in every
 * app shell (Navbar, PortalNavbar, AuthSplitLayout) so it's reachable both
 * before and after login. All slide content is plain rendered text, so the
 * Google Translate widget (lib/googleTranslate.ts) picks it up automatically
 * whenever the user switches language — no separate translation step needed.
 */
export function QuickTour() {
  const [isOpen, setOpen] = useState(false);
  const [index, setIndex] = useState(0);

  const slide = QUICK_TOUR_SLIDES[index];
  const isLast = index === QUICK_TOUR_SLIDES.length - 1;

  function openTour() {
    setIndex(0);
    setOpen(true);
  }

  function goNext() {
    setIndex((i) => (i + 1) % QUICK_TOUR_SLIDES.length);
  }

  function goPrev() {
    setIndex((i) => (i - 1 + QUICK_TOUR_SLIDES.length) % QUICK_TOUR_SLIDES.length);
  }

  return (
    <>
      <button
        type="button"
        onClick={openTour}
        aria-label="Quick tour: what's on this platform"
        className="flex items-center gap-1.5 rounded-full px-2.5 py-2 text-sm font-medium text-slate-600 transition-colors hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-white/10 dark:hover:text-white"
      >
        <QUICK_TOUR_ICON size={17} strokeWidth={1.85} />
        <span className="hidden sm:inline">Quick Tour</span>
      </button>

      <Modal isOpen={isOpen} onClose={() => setOpen(false)} title="Quick Tour" size="lg">
        {/* Role chips — jump straight to any role, any number of times. */}
        <div className="mb-5 flex flex-wrap gap-1.5">
          {QUICK_TOUR_SLIDES.map((s, i) => (
            <button
              key={s.role}
              type="button"
              onClick={() => setIndex(i)}
              className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
                i === index
                  ? "border-brand-500 bg-brand-50 text-brand-700 dark:border-brand-400 dark:bg-brand-500/10 dark:text-brand-300"
                  : "border-slate-200 text-slate-600 hover:bg-slate-50 dark:border-white/10 dark:text-slate-400 dark:hover:bg-white/5"
              }`}
            >
              {s.label}
            </button>
          ))}
        </div>

        <div className="flex items-start gap-3">
          <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-slate-100 dark:bg-white/5 ${slide.accent}`}>
            <slide.icon size={22} strokeWidth={1.85} />
          </div>
          <div>
            <h3 className="text-base font-semibold text-slate-900 dark:text-white">{slide.label}</h3>
            <p className="text-sm text-slate-500 dark:text-slate-400">{slide.tagline}</p>
          </div>
        </div>

        <ul className="mt-4 space-y-2">
          {slide.features.map((feature) => (
            <li key={feature} className="flex items-start gap-2 text-sm text-slate-700 dark:text-slate-300">
              <Check size={16} className="mt-0.5 shrink-0 text-brand-600 dark:text-brand-400" />
              <span>{feature}</span>
            </li>
          ))}
        </ul>

        <div className="mt-6 flex items-center justify-between border-t border-slate-100 pt-4 dark:border-white/[0.08]">
          <button
            type="button"
            onClick={goPrev}
            aria-label="Previous role"
            className="flex items-center gap-1 rounded-md px-2.5 py-1.5 text-sm font-medium text-slate-600 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-white/10"
          >
            <ChevronLeft size={16} />
            Back
          </button>
          <span className="text-xs text-slate-400 dark:text-slate-500">
            {index + 1} / {QUICK_TOUR_SLIDES.length}
          </span>
          <button
            type="button"
            onClick={isLast ? () => setOpen(false) : goNext}
            className="flex items-center gap-1 rounded-md bg-brand-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-brand-700"
          >
            {isLast ? "Done" : "Next"}
            {!isLast && <ChevronRight size={16} />}
          </button>
        </div>
      </Modal>
    </>
  );
}
