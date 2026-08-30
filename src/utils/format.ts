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

// ── Water depth ───────────────────────────────────────────────────────────────────────────────
//
//  UNIT RULE — centimetres are the only unit this app stores, projects and compares. baha-api
//  returns cm and every threshold in floodMeta.ts is cm. Inches are strictly a presentation layer
//  for readers who think in imperial: never feed an inch value back into a calculation, because
//  round-tripping through it stops the cm thresholds lining up.
//
//  Every user-visible water level goes through one of these, so no surface can drift back to a
//  single unit. Which one to reach for:
//
//    formatDepth            prose, cards, tooltips, table cells, notifications   65 cm (26 in)
//    formatDepthShort       width-constrained badges and map bubbles             65 cm · 26"
//    formatDepthDelta       projected-rise readouts (a change, not a depth)      +20 cm (8 in)
//    formatDepthDeltaShort  the sidebar's collapsed "Area" strip chip            +20cm · 8"
//    formatDepthRange       a span across several reports                        30–90 cm (12–35 in)
//    formatRate             rise/fall rates                                      5 cm/hr (2 in/hr)
//    formatDepthAxis        SVG chart Y ticks, where every pixel counts          100 / 39"
//    formatDepthCompact     share/digest copy on a character budget              65cm (26in)
//
//  All of them round their cm input: estDepthCm and projectedDepthCm are floats, and an unrounded
//  value would surface as "64.7 cm (25 in)".

/** Centimetres → whole inches (1 in = 2.54 cm), rounded. */
export function cmToIn(cm: number): number {
  return Math.round(cm / 2.54);
}

/** Inches as display text, keeping a decimal below 10 in. Rates are the reason this exists: a
 *  1 cm/hr rise rounds to a flat 0 in/hr, which reads as "not rising at all". Trailing ".0" trimmed. */
function inchesText(cm: number): string {
  const inches = cm / 2.54;
  if (Math.abs(inches) >= 10) return String(Math.round(inches));
  const oneDp = Math.round(inches * 10) / 10;
  return Number.isInteger(oneDp) ? String(oneDp) : oneDp.toFixed(1);
}

/** Water depth in both units — "65 cm (26 in)". The default; use it unless width forces otherwise. */
export function formatDepth(cm: number): string {
  const v = Math.round(cm);
  return `${v} cm (${cmToIn(v)} in)`;
}

/** Tight variant for badges and list rows where the parenthesised form is too wide: `65 cm · 26"`. */
export function formatDepthShort(cm: number): string {
  const v = Math.round(cm);
  return `${v} cm · ${cmToIn(v)}"`;
}

/** A signed *change* in depth — "+20 cm (8 in)". For the predictive water-rise controls, where the
 *  number is how much higher the water could get rather than how deep it is now. */
export function formatDepthDelta(cm: number): string {
  const v = Math.round(cm);
  return `${v >= 0 ? '+' : ''}${v} cm (${cmToIn(v)} in)`;
}

/** Tight signed variant for the sidebar's collapsed "Area" chip: `+20cm · 8"`. */
export function formatDepthDeltaShort(cm: number): string {
  const v = Math.round(cm);
  return `${v >= 0 ? '+' : ''}${v}cm · ${cmToIn(v)}"`;
}

/** A depth span across several reports — "30–90 cm (12–35 in)". */
export function formatDepthRange(minCm: number, maxCm: number): string {
  const lo = Math.round(minCm);
  const hi = Math.round(maxCm);
  return `${lo}–${hi} cm (${cmToIn(lo)}–${cmToIn(hi)} in)`;
}

/** A rise/fall rate — "5 cm/hr (2 in/hr)". Keeps a decimal inch for slow rates (see inchesText). */
export function formatRate(cmPerHr: number): string {
  const v = Math.round(cmPerHr);
  return `${v} cm/hr (${inchesText(v)} in/hr)`;
}

/** Chart Y-axis tick, where every pixel counts — `100 / 39"`. The axis title carries the units. */
export function formatDepthAxis(cm: number): string {
  const v = Math.round(cm);
  return `${v} / ${cmToIn(v)}"`;
}

/** Share/digest copy on a character budget — `65cm (26in)`, no space before either unit. */
export function formatDepthCompact(cm: number): string {
  const v = Math.round(cm);
  return `${v}cm (${cmToIn(v)}in)`;
}

/** Compact elapsed duration from whole minutes: "just now" / "45m" / "2h 5m". */
export function formatDuration(min: number): string {
  if (min < 1) return 'just now';
  if (min < 60) return `${min}m`;
  const h = Math.floor(min / 60);
  const m = min % 60;
  return m ? `${h}h ${m}m` : `${h}h`;
}
