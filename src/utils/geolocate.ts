// Browser geolocation that actually converges. A single `getCurrentPosition` returns whatever
// fix the OS has *right now* — almost always a coarse cell/WiFi estimate (±50–2000 m), because
// the GPS radio hasn't locked yet. `watchPosition` instead streams successive fixes that sharpen
// over a few seconds; we keep the best (lowest `accuracy` value) reading and report progress so
// the UI can live-update the "You" marker and its accuracy ring as the fix tightens.

export interface Fix {
  lat: number;
  lng: number;
  /** Radius of the 68% confidence circle, in meters (smaller = better). */
  accuracyM: number;
}

/**
 * Accuracy radius (m) above which an auto-placed pin is likely off enough that the reporter
 * should drop it manually instead. Intentionally looser than the locate button's 100 m "approx"
 * toast: a report can still be filed at this accuracy, we just nudge tap/search placement.
 */
export const WEAK_FIX_M = 200;

export interface LocateOptions {
  /** Resolve early once a fix is at least this good. Default 40 m. */
  desiredAccuracyM?: number;
  /** Overall budget; when it elapses we resolve with the best fix seen so far. Default 12 s. */
  totalTimeoutMs?: number;
  /** Called for each new *best* fix, so callers can recenter/redraw as accuracy improves. */
  onProgress?: (fix: Fix) => void;
}

/**
 * Resolve with the best {@link Fix} seen within the time budget. Rejects with the underlying
 * `GeolocationPositionError` only when *no* fix arrives at all (permission denied, unavailable,
 * or per-fix timeout). Always tears down the watch + timer on settle, and settles exactly once.
 */
export function locateWithAccuracy(opts: LocateOptions = {}): Promise<Fix> {
  const { desiredAccuracyM = 40, totalTimeoutMs = 12000, onProgress } = opts;

  return new Promise<Fix>((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error('Geolocation unavailable'));
      return;
    }

    let best: Fix | null = null;
    let settled = false;
    let watchId: number | null = null;
    let timer: number | undefined;

    const cleanup = (): void => {
      if (watchId !== null) navigator.geolocation.clearWatch(watchId);
      window.clearTimeout(timer);
    };

    const finish = (): void => {
      if (settled) return;
      settled = true;
      cleanup();
      // `best` is non-null here: finish() only runs from the success path or the budget timer,
      // and the timer rejects below when nothing has arrived yet.
      if (best) resolve(best);
    };

    watchId = navigator.geolocation.watchPosition(
      (pos) => {
        const fix: Fix = {
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          accuracyM: pos.coords.accuracy,
        };
        if (!best || fix.accuracyM < best.accuracyM) {
          best = fix;
          onProgress?.(fix);
        }
        if (best.accuracyM <= desiredAccuracyM) finish();
      },
      (err) => {
        // Keep waiting if we already have a usable fix; a later error shouldn't discard it.
        if (best) return;
        if (settled) return;
        settled = true;
        cleanup();
        reject(err);
      },
      { enableHighAccuracy: true, maximumAge: 0, timeout: totalTimeoutMs }
    );

    timer = window.setTimeout(() => {
      if (best) finish();
      else if (!settled) {
        settled = true;
        cleanup();
        reject(new Error('Location timed out'));
      }
    }, totalTimeoutMs);
  });
}

/**
 * Continuously stream position fixes until the returned cleanup function is called. Unlike
 * {@link locateWithAccuracy} (a one-shot converge that tears the watch down on settle), this keeps
 * the watch alive so a moving reporter's location stays fresh — used by the in-transit quick-report
 * mode, where each tap posts at wherever the vehicle currently is. Emits every fix (not just
 * improvements), so callers see the location move. No-ops (returns a no-op cleanup) when geolocation
 * is unavailable.
 */
export function watchLocation(onFix: (fix: Fix) => void): () => void {
  if (!navigator.geolocation) return () => {};
  const watchId = navigator.geolocation.watchPosition(
    (pos) => onFix({ lat: pos.coords.latitude, lng: pos.coords.longitude, accuracyM: pos.coords.accuracy }),
    () => { /* transient errors: keep watching, hold the last good fix */ },
    { enableHighAccuracy: true, maximumAge: 0, timeout: 15000 }
  );
  return () => navigator.geolocation.clearWatch(watchId);
}
