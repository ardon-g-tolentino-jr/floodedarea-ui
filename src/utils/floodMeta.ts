// Severity / trend / road metadata and water-level math, ported from the FloodedArea design.

import type { RescueStatus, Road, Severity, Trend } from '../types';

export interface SevMeta {
  label: string;
  color: string;
  soft: string;
  soft2: string;
  depthLabel: string;
}

export const SEV_META: Record<Severity, SevMeta> = {
  high: { label: 'High', color: '#EF4444', soft: 'rgba(239,68,68,0.16)', soft2: 'rgba(239,68,68,0.34)', depthLabel: 'chest-deep+' },
  medium: { label: 'Medium', color: '#F59E0B', soft: 'rgba(245,158,11,0.16)', soft2: 'rgba(245,158,11,0.34)', depthLabel: 'knee–waist' },
  low: { label: 'Low', color: '#16A34A', soft: 'rgba(22,163,74,0.15)', soft2: 'rgba(22,163,74,0.32)', depthLabel: 'ankle-deep' },
};

export const TREND_META: Record<Trend, { label: string; sym: string; color: string }> = {
  rising: { label: 'Rising', sym: '▲', color: '#EF4444' },
  receding: { label: 'Receding', sym: '▼', color: '#16A34A' },
  steady: { label: 'Steady', sym: '■', color: '#64748B' },
};

export const ROAD_META: Record<Road, { label: string; short: string; glyph: string; color: string; soft: string }> = {
  impassable: { label: 'Impassable', short: 'Impassable', glyph: '✕', color: '#EF4444', soft: 'rgba(239,68,68,0.12)' },
  risky: { label: 'Risky for cars', short: 'Risky', glyph: '△', color: '#F59E0B', soft: 'rgba(245,158,11,0.12)' },
  passable: { label: 'Passable', short: 'Passable', glyph: '✓', color: '#16A34A', soft: 'rgba(22,163,74,0.12)' },
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
  pending: { label: 'Pending', color: '#F59E0B', bg: '#FEF3C7', fg: '#B45309' },
  dispatched: { label: 'Dispatched', color: '#3B82F6', bg: '#DBEAFE', fg: '#1D4ED8' },
  resolved: { label: 'Resolved', color: '#16A34A', bg: '#DCFCE7', fg: '#15803D' },
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
  impassable: { txt: 'Do not attempt to cross — water is too deep for vehicles and pedestrians.', bg: '#FEF2F2', col: '#B91C1C' },
  risky: { txt: 'Cross only if necessary and on foot with caution. Avoid low cars and motorbikes.', bg: '#FFFBEB', col: '#B45309' },
  passable: { txt: 'Generally passable with care. Watch for hidden debris and slippery surfaces.', bg: '#F0FDF4', col: '#15803D' },
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

/** SVG path strings (line + filled area) for the sparkline, on a 100×36 viewBox. */
export function sparkPaths(series: number[]): { line: string; area: string } {
  const mx = Math.max(...series) * 1.12 || 1;
  const n = series.length;
  const pts = series.map((v, i) => ({ x: (i / (n - 1)) * 100, y: 34 - (v / mx) * 30 }));
  const line = pts.map((p, i) => (i ? 'L' : 'M') + p.x.toFixed(1) + ' ' + p.y.toFixed(1)).join(' ');
  const area = 'M0 36 ' + pts.map((p) => 'L' + p.x.toFixed(1) + ' ' + p.y.toFixed(1)).join(' ') + ' L100 36 Z';
  return { line, area };
}

/** Human-readable trend note with a rough rate / ETA, from the design. */
export function trendNote(depthCm: number, trend: Trend, series: number[]): string {
  const n = series.length;
  const rate = (series[n - 1] - series[0]) / 6;
  if (trend === 'rising') {
    const r = Math.max(1, Math.round(rate));
    let eta: string;
    if (depthCm < 100) {
      const h = (100 - depthCm) / Math.max(1, rate);
      eta = ` — could reach waist depth (~100 cm) in about ${h < 1 ? '<1' : Math.round(h)} hr`;
    } else {
      eta = ' — already above waist level';
    }
    return `▲ Rising ~${r} cm/hr${eta}.`;
  }
  if (trend === 'receding') {
    const r = Math.max(1, Math.round(-rate));
    let eta = '';
    if (depthCm > 20) {
      const h = (depthCm - 20) / Math.max(1, -rate);
      eta = ` — roads may clear in ~${h < 1 ? '<1' : Math.round(h)} hr`;
    }
    return `▼ Receding ~${r} cm/hr${eta}.`;
  }
  return '■ Holding roughly steady over the last few hours.';
}
