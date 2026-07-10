import React from 'react';
import { API_BASE } from '../api/client';

/**
 * Subscribes to the public SSE live-activity stream and invokes `onActivity` with the event
 * name whenever a report/confirmation/rescue/alert event arrives. The caller typically refetches
 * the affected collection. EventSource auto-reconnects; we just clean up on unmount.
 *
 * Pass `enabled = false` to keep the stream closed (admins can switch live updates off). Flipping
 * `enabled` opens/closes the connection without reconnecting on every `onActivity` identity change.
 */
export function useActivityStream(onActivity: (event: string) => void, enabled = true): void {
  const cbRef = React.useRef(onActivity);
  React.useEffect(() => {
    cbRef.current = onActivity;
  });

  React.useEffect(() => {
    if (!enabled) return;
    let source: EventSource | null = null;
    try {
      source = new EventSource(`${API_BASE}/sse/activity`);
    } catch {
      return;
    }

    const handle = (name: string) => (): void => cbRef.current(name);
    const events = [
      'report-created', 'report-confirmed', 'report-updated', 'report-deleted', 'rescue-created',
      'alert-created', 'alert-updated', 'alert-deactivated',
      'incident-drafted',
    ];
    events.forEach((name) => source?.addEventListener(name, handle(name)));

    return () => source?.close();
  }, [enabled]);
}
