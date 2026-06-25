import React from 'react';
import { mutations, rawApi } from '../api/queries';

// One visit is counted per browser tab session: the first load records a visit (POST), and any
// later loads in the same session (refresh / HMR) only read the total (GET). This keeps refreshes
// from inflating the count while still tallying genuinely new visits.
const SESSION_KEY = 'baha_visit_v1';

/**
 * Tracks the public all-time visit count. Records this session's visit once, then exposes the
 * running total for display. Returns `null` until the count loads (or if the stats endpoint is
 * unavailable) so the caller can hide the chip rather than show a wrong/zero value.
 */
export function useVisitCounter(): number | null {
  const [count, setCount] = React.useState<number | null>(null);
  const did = React.useRef(false);

  React.useEffect(() => {
    // Guard against React 18 StrictMode's double-invoked effect double-counting.
    if (did.current) return;
    did.current = true;

    let counted = false;
    try {
      counted = sessionStorage.getItem(SESSION_KEY) === '1';
      if (!counted) sessionStorage.setItem(SESSION_KEY, '1');
    } catch {
      /* sessionStorage blocked (private mode) — fall through and just read */
    }

    const load = counted ? rawApi.visitCount() : mutations.recordVisit();
    load
      .then((s) => setCount(typeof s.total === 'number' ? s.total : null))
      .catch(() => setCount(null));
  }, []);

  return count;
}
