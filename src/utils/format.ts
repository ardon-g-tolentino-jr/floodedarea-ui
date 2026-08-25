/** Whole minutes since an ISO timestamp (clamped to >= 0). */
export function minutesSince(iso: string): number {
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return 0;
  return Math.max(0, Math.floor((Date.now() - then) / 60000));
}

/** "just now" / "12 min ago" / "3 hrs ago" — matches the FloodedArea design. */
export function timeAgo(iso: string): string {
  const m = minutesSince(iso);
  if (m < 1) return 'just now';
  if (m < 60) return `${m} min ago`;
  const h = Math.floor(m / 60);
  return `${h} hr${h > 1 ? 's' : ''} ago`;
}

/** Centimetres → whole inches (1 in = 2.54 cm), rounded. */
export function cmToIn(cm: number): number {
  return Math.round(cm / 2.54);
}

/** Water depth in both units — "65 cm (26 in)".
 *
 *  The app stores, projects and compares depth in centimetres everywhere (baha-api returns cm,
 *  and every threshold in floodMeta.ts is cm), so inches are strictly a presentation layer for
 *  readers who think in imperial. Never feed the inch value back into any calculation — round-trip
 *  through it and the cm thresholds stop lining up.
 */
export function formatDepth(cm: number): string {
  return `${cm} cm (${cmToIn(cm)} in)`;
}

/** Tight variant for badges and list rows where the parenthesised form is too wide: `65 cm · 26"`. */
export function formatDepthShort(cm: number): string {
  return `${cm} cm · ${cmToIn(cm)}"`;
}

/** Compact elapsed duration from whole minutes: "just now" / "45m" / "2h 5m". */
export function formatDuration(min: number): string {
  if (min < 1) return 'just now';
  if (min < 60) return `${min}m`;
  const h = Math.floor(min / 60);
  const m = min % 60;
  return m ? `${h}h ${m}m` : `${h}h`;
}
