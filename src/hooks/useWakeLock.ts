import React from 'react';

/**
 * Holds a Screen Wake Lock while `enabled` is true, so a running trip keeps the tab alive (and
 * therefore keeps its alerts firing) as long as the screen stays on. No-ops silently where the
 * Wake Lock API is unsupported (Safari < 16.4, most in-app browsers) — there is no service worker
 * in this app, so this is a best-effort mitigation, not a guarantee of background delivery.
 */
export function useWakeLock(enabled: boolean): void {
  const sentinel = React.useRef<WakeLockSentinel | null>(null);

  React.useEffect(() => {
    if (!enabled) return;
    if (typeof navigator === 'undefined' || !('wakeLock' in navigator)) return;
    let cancelled = false;

    const acquire = async (): Promise<void> => {
      try {
        const lock = await navigator.wakeLock.request('screen');
        if (cancelled) { void lock.release(); return; }
        sentinel.current = lock;
        lock.addEventListener('release', () => { sentinel.current = null; });
      } catch {
        // Denied (e.g. low battery) or the tab isn't visible yet — visibilitychange retries below.
      }
    };

    void acquire();
    const onVisibility = (): void => {
      if (document.visibilityState === 'visible' && !sentinel.current) void acquire();
    };
    document.addEventListener('visibilitychange', onVisibility);

    return () => {
      cancelled = true;
      document.removeEventListener('visibilitychange', onVisibility);
      void sentinel.current?.release();
      sentinel.current = null;
    };
  }, [enabled]);
}
