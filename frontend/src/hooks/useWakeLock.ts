import { useCallback, useEffect, useRef } from "react";

/**
 * Keeps the screen awake while `active` is true, using the Wake Lock API.
 * The OS releases a wake lock automatically whenever the tab is hidden
 * (backgrounded, phone locked) — the visibilitychange listener re-acquires
 * it the moment the tab becomes visible again, so a driver who briefly
 * switches apps and comes back doesn't have to re-trigger anything.
 * Unsupported browsers (no Wake Lock API) silently no-op.
 */
export function useWakeLock(active: boolean) {
  const lockRef = useRef<WakeLockSentinel | null>(null);

  const acquire = useCallback(async () => {
    if (!active || !("wakeLock" in navigator) || lockRef.current) return;
    try {
      lockRef.current = await navigator.wakeLock.request("screen");
      lockRef.current.addEventListener("release", () => {
        lockRef.current = null;
      });
    } catch {
      // Permission denied or unsupported in this context — nothing to do.
    }
  }, [active]);

  useEffect(() => {
    if (!active) return;
    void acquire();
    const onVisibilityChange = () => {
      if (document.visibilityState === "visible") void acquire();
    };
    document.addEventListener("visibilitychange", onVisibilityChange);
    return () => {
      document.removeEventListener("visibilitychange", onVisibilityChange);
      void lockRef.current?.release();
      lockRef.current = null;
    };
  }, [active, acquire]);
}
