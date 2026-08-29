// Severity / trend / road metadata and water-level math, ported from the FloodedArea design.

import type { FloodReport, RescueStatus, Road, Severity, Trend } from '../types';

export interface SevMeta {
  label: string;
  color: string;
  soft: string;
  soft2: string;
  depthLabel: string;
}

export const SEV_META: Record<Severity, SevMeta> = {
  high: { label: 'High', color: 'var(--bw-danger)', soft: 'rgba(239,68,68,0.16)', soft2: 'rgba(239,68,68,0.34)', depthLabel: 'chest-deep+' },
  medium: { label: 'Medium', color: 'var(--bw-warn)', soft: 'rgba(245,158,11,0.16)', soft2: 'rgba(245,158,11,0.34)', depthLabel: 'knee–waist' },
  low: { label: 'Low', color: 'var(--bw-ok)', soft: 'rgba(22,163,74,0.15)', soft2: 'rgba(22,163,74,0.32)', depthLabel: 'ankle-deep' },
};

export const TREND_META: Record<Trend, { label: string; sym: string; color: string }> = {
  rising: { label: 'Rising', sym: '▲', color: 'var(--bw-danger)' },
  receding: { label: 'Receding', sym: '▼', color: 'var(--bw-ok)' },
  steady: { label: 'Steady', sym: '■', color: 'var(--bw-muted)' },
};

export const ROAD_META: Record<Road, { label: string; short: string; glyph: string; color: string; soft: string }> = {
  impassable: { label: 'Impassable', short: 'Impassable', glyph: '✕', color: 'var(--bw-road-impassable)', soft: 'rgba(239,68,68,0.12)' },
  risky: { label: 'Risky for cars', short: 'Risky', glyph: '△', color: 'var(--bw-road-risky)', soft: 'rgba(245,158,11,0.12)' },
  passable: { label: 'Passable', short: 'Passable', glyph: '✓', color: 'var(--bw-road-passable)', soft: 'rgba(22,163,74,0.12)' },
};

/** Display order for road filters/legend: best → worst. */
export const ROAD_ORDER: Road[] = ['passable', 'risky', 'impassable'];

export const SEV_RANK: Record<Severity, number> = { high: 3, medium: 2, low: 1 };

/**
 * Rescue-request status palette — single source for the status pill (bg/fg) and the map pin
 * (color), in the app's amber→blue→green hues. Used by the response console, the map's rescue
 * layer and the rescue chart.
 */
export const RESCUE_STATUS_META: Record<RescueStatus, { label: string; color: string; bg: string; fg: string }> = {
  pending: { label: 'Pending', color: 'var(--bw-warn)', bg: 'var(--bw-tint-warn)', fg: 'var(--bw-on-tint-warn)' },
  dispatched: { label: 'Dispatched', color: '#3B82F6', bg: 'var(--bw-tint-info)', fg: 'var(--bw-on-tint-info)' },
  resolved: { label: 'Resolved', color: 'var(--bw-ok)', bg: 'var(--bw-tint-ok)', fg: 'var(--bw-on-tint-ok)' },
};

/** Triage rank for rescue statuses (open work floats to the top): pending → dispatched → resolved. */
export const RESCUE_STATUS_RANK: Record<RescueStatus, number> = { pending: 3, dispatched: 2, resolved: 1 };

/** Passability rank, worst → best. Used to pick a road's overall condition from its reports. */
export const ROAD_RANK: Record<Road, number> = { impassable: 3, risky: 2, passable: 1 };

/**
 * Water-depth thresholds (cm) for road passability, aligned with the DEPTH_TICKS body references
 * (knee ≈ 50, waist ≈ 100): at/above waist-ish water vehicles can't pass; knee-to-waist is risky.
 */
export const ROAD_IMPASSABLE_CM = 90;
export const ROAD_RISKY_CM = 50;

/** Infer a road's passability from observed water depth. */
export function roadFromDepth(depthCm: number): Road {
  if (depthCm >= ROAD_IMPASSABLE_CM) return 'impassable';
  if (depthCm >= ROAD_RISKY_CM) return 'risky';
  return 'passable';
}

/**
 * The severity band a raw water depth falls in — the inverse of SEVERITY_PRESET's depthCm, and the
 * companion to `roadFromDepth` above. Thresholds are DEPTH_RANGE's own boundaries (low tops out at
 * 30, medium at 90), so a depth dialled in on any severity's slider classifies back to that same
 * severity. Used wherever depth is the input and severity has to follow it rather than the other
 * way round — the bulk hotspot report, where every row carries its own depth.
 */
export function severityFromDepth(depthCm: number): Severity {
  if (depthCm >= DEPTH_RANGE.high.min) return 'high';
  if (depthCm >= DEPTH_RANGE.medium.min) return 'medium';
  return 'low';
}

/** Recession while NO rain is falling — cm/hr, by severity. Deeper floods sit in low-lying catch
 *  basins with more head, so they shed more cm/hr in absolute terms yet still take longer overall
 *  to clear (108 cm ≈ 4.3 h, 46 cm ≈ 2.6 h, 8 cm ≈ 0.8 h). Mirrors REPORT_TTL_MIN's rationale. */
export const DRAIN_CM_PER_HR: Record<Severity, number> = { low: 10, medium: 18, high: 25 };

/** Change while rain IS falling — cm/hr, by the report's observed trend. Rain doesn't stop
 *  drainage, it outpaces it: a rising flood keeps climbing, a steady one creeps up, and a
 *  receding one still recedes, only slower. */
export const RAIN_CM_PER_HR: Record<Trend, number> = { rising: 12, steady: 3, receding: -6 };

export const PROJECT_MAX_CM = 250;      // absolute ceiling
export const PROJECT_MAX_FACTOR = 2;    // never model past 2× the observed depth
export const DRAINED_CM = 2;            // at/below this the flood is treated as gone
export const PROJECT_HOURS = 6;         // how far forward the predictive curve runs

export function projectDepth(r: FloodReport, rainActive: boolean, hours: number): number {
  const rate = rainActive ? RAIN_CM_PER_HR[r.trend] : -DRAIN_CM_PER_HR[r.severity];
  const cap = Math.min(PROJECT_MAX_CM, r.depthCm * PROJECT_MAX_FACTOR);
  return Math.max(0, Math.min(cap, Math.round(r.depthCm + rate * hours)));
}

/** The signed cm/hr rate `projectDepth` is applying right now — the same formula, exposed
 *  separately so copy (trendNote's ETA) can quote the real number instead of re-deriving it. */
export function projectionRateCmPerHr(r: FloodReport, rainActive: boolean): number {
  return rainActive ? RAIN_CM_PER_HR[r.trend] : -DRAIN_CM_PER_HR[r.severity];
}

/** When this report's depthCm was last actually observed — the moment both the TTL countdown and
 *  the predictive curve anchor on. System reports carry the source's observation time in
 *  `reportedAt` (possibly hours before an admin logged it); for everyone else the last activity IS
 *  the last sighting — a confirm or an admin depth override bumps `updatedAt` and correctly
 *  re-anchors both. Lives here rather than in viewModel because the projection math below needs it
 *  and floodMeta is the lower layer (viewModel imports from floodMeta, never the reverse). */
export function observationAnchorMs(r: FloodReport): number {
  const src = r.reporterTrust === 'system' ? (r.reportedAt ?? r.createdAt) : (r.updatedAt ?? r.createdAt);
  const ms = new Date(src).getTime();
  return Number.isNaN(ms) ? new Date(r.createdAt).getTime() : ms;
}

/**
 * The observed point plus one projected point per hour through PROJECT_HOURS, for the detail
 * card's "observed → projected" chart. `nowIndex` is which point in the array is "now" — the
 * split between the solid observed segment and the dashed predictive tail. Clamped to the last
 * point when more than PROJECT_HOURS have already elapsed (the curve simply has no further tail).
 */
export function projectedSeries(
  report: FloodReport,
  rainActive: boolean,
  now: number
): { points: { t: number; depthCm: number }[]; nowIndex: number } {
  const anchor = observationAnchorMs(report);
  const points: { t: number; depthCm: number }[] = [{ t: anchor, depthCm: report.depthCm }];
  for (let h = 1; h <= PROJECT_HOURS; h++) {
    points.push({ t: anchor + h * 3_600_000, depthCm: projectDepth(report, rainActive, h) });
  }
  const elapsedHours = Number.isNaN(anchor) ? 0 : Math.max(0, Math.floor((now - anchor) / 3_600_000));
  const nowIndex = Math.min(PROJECT_HOURS, elapsedHours);
  return { points, nowIndex };
}

/** Categorical line colors for the per-district water-level chart, assigned by district index. */
export const DISTRICT_COLORS: string[] = ['#0EA5E9', '#8B5CF6', '#F59E0B', '#16A34A', '#EC4899', '#14B8A6', '#EF4444', '#6366F1'];

/** Depth reference bands (cm) shared by the detail card and the water-level chart axis. */
export const DEPTH_TICKS: { label: string; cm: number }[] = [
  { label: 'Ankle', cm: 15 },
  { label: 'Knee', cm: 50 },
  { label: 'Waist', cm: 100 },
  { label: 'Chest', cm: 140 },
];

/** Body-scale band a flood depth reaches on an average adult. Matches i18n keys `depthRef.<band>`. */
export type DepthBand = 'soles' | 'ankle' | 'shin' | 'knee' | 'thigh' | 'waist' | 'chest' | 'neck' | 'overhead';
/** Vehicle cue for a flood depth. Matches i18n keys `depthVeh.<cue>`. */
export type VehicleCue = 'curb' | 'halfTire' | 'stall' | 'float';

/** Height (cm) of the reference adult used to fill the depth silhouette. */
const ADULT_HEIGHT_CM = 170;

/**
 * Turn a raw water depth (cm) into a real-world reference a reporter/viewer can relate to: which
 * body part it reaches on an average adult, how far to fill the silhouette (0..1), and a vehicle cue.
 * Pure — the label text is localized by the caller via the `depthRef.*` / `depthVeh.*` i18n keys.
 * Vehicle thresholds mirror ROAD_RISKY_CM (50) / ROAD_IMPASSABLE_CM (90) so cues agree with road status.
 */
export function depthReference(cm: number): { band: DepthBand; fill: number; vehicle: VehicleCue | null } {
  const band: DepthBand =
    cm < 8   ? 'soles'  : cm < 22  ? 'ankle' : cm < 38  ? 'shin'  :
    cm < 58  ? 'knee'   : cm < 80  ? 'thigh' : cm < 105 ? 'waist' :
    cm < 135 ? 'chest'  : cm < 165 ? 'neck'  : 'overhead';
  const vehicle: VehicleCue | null =
    cm >= ROAD_IMPASSABLE_CM ? 'float' :
    cm >= ROAD_RISKY_CM      ? 'stall' :
    cm >= 30                 ? 'halfTire' :
    cm >= 15                 ? 'curb' : null;
  return { band, fill: Math.min(cm / ADULT_HEIGHT_CM, 1), vehicle };
}

export const ADVICE: Record<Road, { txt: string; bg: string; col: string }> = {
  impassable: { txt: 'Do not attempt to cross — water is too deep for vehicles and pedestrians.', bg: 'var(--bw-tint-danger)', col: 'var(--bw-on-tint-danger)' },
  risky: { txt: 'Cross only if necessary and on foot with caution. Avoid low cars and motorbikes.', bg: 'var(--bw-tint-warn)', col: 'var(--bw-on-tint-warn)' },
  passable: { txt: 'Generally passable with care. Watch for hidden debris and slippery surfaces.', bg: 'var(--bw-tint-ok)', col: 'var(--bw-on-tint-ok)' },
};

/** Defaults the report-flood quick-pick uses for each severity. */
export const SEVERITY_PRESET: Record<Severity, { depthCm: number; road: Road; trend: Trend }> = {
  high: { depthCm: 108, road: 'impassable', trend: 'rising' },
  medium: { depthCm: 46, road: 'risky', trend: 'steady' },
  low: { depthCm: 8, road: 'passable', trend: 'receding' },
};

/** Depth range (cm) a reporter can dial in for each severity; defaults to SEVERITY_PRESET.depthCm. */
export const DEPTH_RANGE: Record<Severity, { min: number; max: number; step: number }> = {
  high: { min: 90, max: 250, step: 5 },
  medium: { min: 30, max: 90, step: 1 },
  low: { min: 5, max: 30, step: 1 },
};

/** Bounds for a severity-agnostic depth slider. `DEPTH_RANGE` above is per-severity and so can't
 *  span them; where depth is the input that DERIVES severity (the admin Quick report page) the
 *  slider needs one continuous track across every band. */
export const DEPTH_SLIDER_MIN_CM = DEPTH_RANGE.low.min;
export const DEPTH_SLIDER_MAX_CM = DEPTH_RANGE.high.max;

/**
 * Durations a TTL slider can land on, in minutes. Deliberately not a linear track: real floods
 * clear in the 1–6 hour band, which a linear 30 min–48 h slider would squeeze into its first
 * eighth. Dense through that band, coarse above it.
 */
export const TTL_STOPS_MIN: number[] = [30, 45, 60, 90, 120, 150, 180, 240, 300, 360, 480, 600, 720, 1080, 1440, 2160, 2880];

/** The TTL_STOPS_MIN entry closest to `min` — keeps a slider's thumb and its label in agreement. */
export function nearestTtlStop(min: number): number {
  return TTL_STOPS_MIN.reduce((best, s) => (Math.abs(s - min) < Math.abs(best - min) ? s : best), TTL_STOPS_MIN[0]);
}

/** Flat allowance added to a drain estimate while rain is still falling. Drainage can't begin until
 *  the rain stops and the app carries no forecast, so this is an honest constant rather than a
 *  precise-looking number derived from data we don't have. */
export const RAIN_HOLD_MIN = 120;

/**
 * How long water this deep should stay on the map, in minutes — the observed depth run down to
 * `DRAINED_CM` at this severity's `DRAIN_CM_PER_HR`, which is the same recession model the
 * predictive water-level curve uses, integrated instead of stepped. Snapped to a TTL_STOPS_MIN
 * entry so the estimate is always a value the slider can actually show.
 *
 * This is why a batch of hotspots gets DIFFERENT lifetimes without the admin setting each one:
 * 23 cm of gutter water on an arterial drains in ~2 h, 152 cm in a riverside barangay sits for ~6 h.
 */
export function drainMinutes(depthCm: number, rainActive: boolean): number {
  const hours = Math.max(0, depthCm - DRAINED_CM) / DRAIN_CM_PER_HR[severityFromDepth(depthCm)];
  return nearestTtlStop(Math.round(hours * 60) + (rainActive ? RAIN_HOLD_MIN : 0));
}

/** How long an admin-authored system report stays live. '' = fall back to the severity-scaled
 *  default; else minutes. Shared by AdminReportIncidentModal (single incident) and
 *  ZoneReportModal (bulk/per-zone) so both "Keep live for" selects offer the same choices. */
export const TTL_OPTIONS: { value: string; label: string }[] = [
  { value: '', label: 'Default (by severity)' },
  { value: '60', label: '1 hour' },
  { value: '180', label: '3 hours' },
  { value: '360', label: '6 hours' },
  { value: '720', label: '12 hours' },
  { value: '1440', label: '24 hours' },
  { value: '2880', label: '48 hours' },
];

/** Minimum map zoom at which flood-prone zone name bubbles render — below it only the dashed
 *  radius circles show, so zoomed-out views don't drown in labels. */
export const ZONE_LABEL_MIN_ZOOM = 13;

/** Synthesizes a plausible 6-hour water-level series for the detail sparkline. */
export function waterSeries(depth: number, trend: Trend, seed: number): number[] {
  const n = 7;
  const out: number[] = [];
  for (let i = 0; i < n; i++) {
    const t = i / (n - 1);
    let v: number;
    if (trend === 'rising') v = depth * (0.42 + 0.58 * t);
    else if (trend === 'receding') v = depth * (1.6 - 0.6 * t);
    else v = depth * (0.9 + 0.12 * Math.sin(t * 3 + (seed % 5)));
    out.push(Math.max(2, Math.round(v)));
  }
  out[n - 1] = depth;
  return out;
}

/**
 * SVG path strings (line + filled area) for the sparkline, on a 100×36 viewBox. `splitIndex`
 * (default: the last point, i.e. no split) marks where the solid observed segment ends and the
 * dashed predictive tail begins; both share the same x/y scale so they align as one continuous
 * line. `line` covers points [0, splitIndex]; `dashedLine` covers [splitIndex, end] and is '' when
 * there's nothing beyond the split.
 */
export function sparkPaths(series: number[], splitIndex: number = series.length - 1): { line: string; area: string; dashedLine: string } {
  const mx = Math.max(...series) * 1.12 || 1;
  const n = series.length;
  const pts = series.map((v, i) => ({ x: (i / (n - 1)) * 100, y: 34 - (v / mx) * 30 }));
  const path = (slice: typeof pts): string => slice.map((p, i) => (i ? 'L' : 'M') + p.x.toFixed(1) + ' ' + p.y.toFixed(1)).join(' ');
  const line = path(pts.slice(0, splitIndex + 1));
  const dashedLine = splitIndex < n - 1 ? path(pts.slice(splitIndex)) : '';
  const area = 'M0 36 ' + pts.map((p) => 'L' + p.x.toFixed(1) + ' ' + p.y.toFixed(1)).join(' ') + ' L100 36 Z';
  return { line, area, dashedLine };
}

/** Human-readable trend note with a rough rate / ETA. `rateCmPerHr` is the real signed model rate
 *  (from projectionRateCmPerHr) rather than a synthetic series — so this copy always agrees with
 *  the chart it sits under. */
export function trendNote(depthCm: number, trend: Trend, rateCmPerHr: number): string {
  if (trend === 'rising') {
    const r = Math.max(1, Math.round(rateCmPerHr));
    let eta: string;
    if (depthCm < 100) {
      const h = (100 - depthCm) / Math.max(1, r);
      eta = ` — could reach waist depth (~100 cm) in about ${h < 1 ? '<1' : Math.round(h)} hr`;
    } else {
      eta = ' — already above waist level';
    }
    return `▲ Rising ~${r} cm/hr${eta}.`;
  }
  if (trend === 'receding') {
    const r = Math.max(1, Math.round(-rateCmPerHr));
    let eta = '';
    if (depthCm > 20) {
      const h = (depthCm - 20) / Math.max(1, r);
      eta = ` — roads may clear in ~${h < 1 ? '<1' : Math.round(h)} hr`;
    }
    return `▼ Receding ~${r} cm/hr${eta}.`;
  }
  return '■ Holding roughly steady over the last few hours.';
}
