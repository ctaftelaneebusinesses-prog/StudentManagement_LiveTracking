interface PoweredByCraftLaneeProps {
  className?: string;
}

/**
 * Platform attribution mark — shown top-right on every dashboard navbar and
 * every auth page (login/register/registration-status, via AuthSplitLayout),
 * one shared component so there's exactly one place to swap in the real
 * asset later: replace the <span> below with
 * <img src="/craftlanee-logo.svg" alt="CraftLanee" className="h-4 w-auto" />
 * once that file exists in frontend/public.
 *
 * Unstyled for color/size on purpose — callers set both via `className` to
 * match their own surface (dashboard chrome vs. the dark auth gradient).
 */
export function PoweredByCraftLanee({ className = "" }: PoweredByCraftLaneeProps) {
  return (
    <span className={`whitespace-nowrap text-xs font-medium uppercase tracking-[0.15em] opacity-70 ${className}`}>
      Powered by CraftLanee
    </span>
  );
}
