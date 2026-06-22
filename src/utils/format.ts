/** Whole minutes since an ISO timestamp (clamped to >= 0). */
export function minutesSince(iso: string): number {
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return 0;
  return Math.max(0, Math.floor((Date.now() - then) / 60000));
}

/** "just now" / "12 min ago" / "3 hrs ago" — matches the BahaWatch design. */
export function timeAgo(iso: string): string {
  const m = minutesSince(iso);
  if (m < 1) return 'just now';
  if (m < 60) return `${m} min ago`;
  const h = Math.floor(m / 60);
  return `${h} hr${h > 1 ? 's' : ''} ago`;
}

/** Compact elapsed duration from whole minutes: "just now" / "45m" / "2h 5m". */
export function formatDuration(min: number): string {
  if (min < 1) return 'just now';
  if (min < 60) return `${min}m`;
  const h = Math.floor(min / 60);
  const m = min % 60;
  return m ? `${h}h ${m}m` : `${h}h`;
}
