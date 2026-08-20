import { PointerEvent, useCallback, useEffect, useRef, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { ChevronLeft, ChevronRight, Pause, Play } from "lucide-react";
import { useSchool } from "@/hooks/useSchool";
import { STORY_SCENES } from "./storyScenes";

const SWIPE_THRESHOLD = 45;
const SCENE_COUNT = STORY_SCENES.length;

/**
 * Auto-playing "story" banner for the top of the Student/Parent dashboard —
 * six short illustrated scenes (school morning through exam success) that
 * cross-fade on a timer, Instagram-style segmented progress bar, manual
 * prev/next, swipe, and a pause toggle. Purely additive UI: it renders
 * nothing that reads from or writes to any dashboard query, so it can't
 * affect existing dashboard functionality.
 */
export function StoryCarousel() {
  const prefersReducedMotion = useReducedMotion();
  const { selectedSchool } = useSchool();
  const [index, setIndex] = useState(0);
  const [cycle, setCycle] = useState(0);
  const [userPaused, setUserPaused] = useState(false);
  const [hovering, setHovering] = useState(false);
  const touchStartX = useRef<number | null>(null);

  const playing = !userPaused && !hovering && !prefersReducedMotion;
  const scene = STORY_SCENES[index];

  const goTo = useCallback((next: number) => {
    setIndex(((next % SCENE_COUNT) + SCENE_COUNT) % SCENE_COUNT);
    setCycle((c) => c + 1);
  }, []);

  const goNext = useCallback(() => goTo(index + 1), [goTo, index]);
  const goPrev = useCallback(() => goTo(index - 1), [goTo, index]);

  useEffect(() => {
    if (!playing) return;
    const timer = window.setTimeout(() => goTo(index + 1), scene.duration);
    return () => window.clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [index, playing, cycle]);

  useEffect(() => {
    if (scene.id !== "congratulations" || prefersReducedMotion) return;
    let cancelled = false;
    const colors = ["#ff6b8b", "#4fa1ff", "#ffd166", "#63c78a", "#9b8cff"];
    import("canvas-confetti").then(({ default: confetti }) => {
      if (cancelled) return;
      // Two cannons from the bottom corners, angled up and inward, instead of one center burst.
      confetti({ particleCount: 45, angle: 60, spread: 65, startVelocity: 42, origin: { x: 0.08, y: 0.92 }, colors });
      confetti({ particleCount: 45, angle: 120, spread: 65, startVelocity: 42, origin: { x: 0.92, y: 0.92 }, colors });
    });
    return () => {
      cancelled = true;
    };
  }, [scene.id, cycle, prefersReducedMotion]);

  const handlePointerDown = (e: PointerEvent<HTMLElement>) => {
    touchStartX.current = e.clientX;
  };
  const handlePointerUp = (e: PointerEvent<HTMLElement>) => {
    if (touchStartX.current == null) return;
    const delta = e.clientX - touchStartX.current;
    touchStartX.current = null;
    if (delta > SWIPE_THRESHOLD) goPrev();
    else if (delta < -SWIPE_THRESHOLD) goNext();
  };

  const Illustration = scene.Illustration;

  return (
    <motion.section
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
      aria-roledescription="carousel"
      aria-label="Your child's school story"
      onMouseEnter={() => setHovering(true)}
      onMouseLeave={() => setHovering(false)}
      onPointerDown={handlePointerDown}
      onPointerUp={handlePointerUp}
      className="group relative select-none overflow-hidden rounded-2xl border shadow-sm backdrop-blur-xl"
      style={{ background: "var(--portal-glass-bg)", borderColor: "var(--portal-glass-border)" }}
    >
      <div className="relative h-[220px] w-full sm:h-[260px] lg:h-[300px]">
        <AnimatePresence initial={false}>
          <motion.div
            key={scene.id}
            className="absolute inset-0"
            initial={{ opacity: 0, scale: 1.02 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.99 }}
            transition={{ duration: 0.55, ease: [0.16, 1, 0.3, 1] }}
          >
            <Illustration active={playing} schoolName={selectedSchool.name} />
          </motion.div>
        </AnimatePresence>

        <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/55 via-black/0 to-black/10" />

        <div className="absolute inset-x-3 top-3 z-20 flex gap-1.5 sm:inset-x-4 sm:top-4">
          {STORY_SCENES.map((s, i) => (
            <div key={s.id} className="h-1 flex-1 overflow-hidden rounded-full bg-white/30">
              {i === index ? (
                <div
                  key={`${scene.id}-${cycle}`}
                  className="h-full origin-left rounded-full bg-white"
                  style={{
                    animation: prefersReducedMotion ? "none" : `story-progress-fill ${scene.duration}ms linear forwards`,
                    animationPlayState: playing ? "running" : "paused",
                    transform: prefersReducedMotion || !playing ? undefined : "scaleX(0)",
                  }}
                />
              ) : (
                <div className="h-full origin-left rounded-full bg-white" style={{ transform: i < index ? "scaleX(1)" : "scaleX(0)" }} />
              )}
            </div>
          ))}
        </div>

        <button
          type="button"
          onClick={goPrev}
          aria-label="Previous scene"
          className="absolute left-1.5 top-1/2 z-20 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full bg-black/25 text-white opacity-0 backdrop-blur-sm transition-opacity duration-200 hover:bg-black/40 focus-visible:opacity-100 group-hover:opacity-100 sm:left-2"
        >
          <ChevronLeft size={20} strokeWidth={2} />
        </button>
        <button
          type="button"
          onClick={goNext}
          aria-label="Next scene"
          className="absolute right-1.5 top-1/2 z-20 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full bg-black/25 text-white opacity-0 backdrop-blur-sm transition-opacity duration-200 hover:bg-black/40 focus-visible:opacity-100 group-hover:opacity-100 sm:right-2"
        >
          <ChevronRight size={20} strokeWidth={2} />
        </button>

        <button
          type="button"
          onClick={() => setUserPaused((p) => !p)}
          aria-label={userPaused ? "Play story" : "Pause story"}
          className="absolute right-3 top-8 z-20 flex h-7 w-7 items-center justify-center rounded-full bg-black/25 text-white backdrop-blur-sm transition-opacity duration-200 hover:bg-black/40 sm:right-4 sm:top-9"
        >
          {userPaused || (prefersReducedMotion && !hovering) ? <Play size={13} strokeWidth={2.4} /> : <Pause size={13} strokeWidth={2.4} />}
        </button>

        <div className="pointer-events-none absolute inset-x-0 bottom-0 z-10 flex flex-col gap-1 p-4 sm:p-5">
          {scene.id === "congratulations" ? (
            <motion.span
              key={`${scene.id}-badge-${cycle}`}
              className="origin-left text-xs font-medium tracking-wide text-white/85"
              initial={{ opacity: 0, scale: 0.4 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.6, delay: 0.15, ease: [0.175, 0.885, 0.32, 1.275] }}
            >
              {scene.emoji} {scene.title}
            </motion.span>
          ) : (
            <span className="text-xs font-medium tracking-wide text-white/85">
              {scene.emoji} {scene.title}
            </span>
          )}
          {scene.id === "keep-learning" ? (
            <motion.span
              key={`${scene.id}-${cycle}`}
              aria-live="polite"
              className="origin-left text-sm font-semibold text-white sm:text-base"
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ type: "spring", stiffness: 220, damping: 16, delay: 0.2 }}
            >
              {scene.caption}
            </motion.span>
          ) : (
            <span aria-live="polite" className="text-sm font-semibold text-white sm:text-base">
              {scene.caption}
            </span>
          )}
        </div>
      </div>
    </motion.section>
  );
}
