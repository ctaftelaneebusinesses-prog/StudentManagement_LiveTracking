interface PoweredByCraftLaneeProps {
  className?: string;
  /**
   * Which surface this sits on, so the correct logo color variant is used —
   * the source mark's "raftLanee" wordmark only ever shipped in white (built
   * for a black background), so craftlanee-logo-dark.png exists for light
   * surfaces: same file, same "C" icon gradient untouched, but the wordmark
   * recolored black (columns right of the icon's own pixels) instead of a
   * flat single-color recolor of the whole mark:
   *   - "auto" (default): follows the app's own light/dark mode toggle via
   *     Tailwind's `dark:` variant — correct for the three dashboard
   *     navbars, whose background does the exact same toggle.
   *   - "light": always the dark-slate variant — for a surface that never
   *     goes dark regardless of the app's theme (the certificate's fixed
   *     ivory paper).
   *   - "dark": always the original light/white variant — for a surface
   *     that's always dark regardless of the app's theme (AuthSplitLayout's
   *     fixed slate-950 gradient, which has no `dark:` variant of its own).
   */
  surface?: "auto" | "light" | "dark";
}

const LOGO_LIGHT_SURFACE = "/craftlanee-logo-dark.png"; // original icon color + black wordmark, for light backgrounds
const LOGO_DARK_SURFACE = "/craftlanee-logo.png"; // original light/white mark, for dark backgrounds

/**
 * Platform attribution mark — shown top-right on every dashboard navbar and
 * every auth page (login/register/registration-status, via AuthSplitLayout),
 * one shared component so there's exactly one place this lives. Sits flat on
 * the host surface, no chip/pill — see `surface` above for how it stays
 * legible without one.
 */
export function PoweredByCraftLanee({ className = "", surface = "auto" }: PoweredByCraftLaneeProps) {
  return (
    <span className={`items-center gap-1.5 ${className}`}>
      <span className="text-[10px] font-medium uppercase tracking-wider text-slate-500 dark:text-slate-400">Powered by</span>
      {surface === "light" && <img src={LOGO_LIGHT_SURFACE} alt="CraftLanee" className="h-3.5 w-auto" />}
      {surface === "dark" && <img src={LOGO_DARK_SURFACE} alt="CraftLanee" className="h-3.5 w-auto" />}
      {surface === "auto" && (
        <>
          <img src={LOGO_LIGHT_SURFACE} alt="CraftLanee" className="h-3.5 w-auto dark:hidden" />
          <img src={LOGO_DARK_SURFACE} alt="CraftLanee" className="hidden h-3.5 w-auto dark:block" />
        </>
      )}
    </span>
  );
}
