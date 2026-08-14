// Pure builder for the per-district water-level-over-time chart.
//
// The data has no stored history — each report is a single snapshot (depthCm + createdAt).
// So per district we plot the *real* report depths as markers at their timestamps and draw a
// *synthesized* trend line through/around them: with one report we fall back to waterSeries()
// (the same 6-hour synthesis the detail sparkline uses); with several we connect the real points.
// Keep this layer side-effect-free.

import type { FloodReport, Severity, Trend } from '../types';
import { observationAnchorMs, projectDepth, waterSeries } from './floodMeta';
import { localDateKey } from './viewModel';

export interface TimedDepth {
  t: number; // epoch ms
  depthCm: number;
}

export interface DistrictSeries {
  district: string;
  color: string;
  points: TimedDepth[]; // real reports, sorted by time
  curve: TimedDepth[]; // synthesized smooth line across the window
  latestDepthCm: number;
  trend: Trend;
}

export interface WaterChart {
  series: DistrictSeries[];
  tMin: number; // window start (epoch ms)
  tMax: number; // window end (epoch ms)
  depthMax: number; // Y scale (cm), padded
}

const HOUR_MS = 3_600_000;
const MIN_DEPTH_AXIS = 80; // keep the Y axis from going flat when depths are small

/**
 * Build the overlaid per-district chart from raw reports.
 * @param now epoch ms for "now" (the right edge of the window)
 * @param colors categorical palette; assigned by district index, wrapping if needed
 */
export function buildWaterChart(
  reports: FloodReport[],
  now: number,
  colors: string[],
  windowHours = 6,
): WaterChart {
  const active = reports.filter((r) => r.status === 'active');

  // Group reports by district.
  const byDistrict = new Map<string, FloodReport[]>();
  for (const r of active) {
    const list = byDistrict.get(r.district);
    if (list) list.push(r);
    else byDistrict.set(r.district, [r]);
  }

  // Window: last `windowHours`, extended back if the earliest report is older.
  let earliest = now;
  for (const r of active) earliest = Math.min(earliest, Date.parse(r.createdAt));
  const tMax = now;
  const tMin = Math.min(now - windowHours * HOUR_MS, earliest);

  let depthMax = MIN_DEPTH_AXIS;
  const series: DistrictSeries[] = [];
  let i = 0;

  for (const [district, list] of byDistrict) {
    const points: TimedDepth[] = list
      .map((r) => ({ t: Date.parse(r.createdAt), depthCm: r.depthCm }))
      .sort((a, b) => a.t - b.t);

    // Aggregate trend/latest from the most recent report.
    const latest = list.reduce((a, b) => (Date.parse(a.createdAt) >= Date.parse(b.createdAt) ? a : b));

    let curve: TimedDepth[];
    if (points.length >= 2) {
      // Connect the real points directly (they already span time).
      curve = points;
    } else {
      // Single report → synthesize a plausible 6-hour curve ending at the report.
      const anchor = points[0];
      const series6 = waterSeries(latest.depthCm, latest.trend, latest.id);
      const span = windowHours * HOUR_MS;
      const n = series6.length;
      curve = series6.map((depthCm, k) => ({
        t: anchor.t - span + (k / (n - 1)) * span,
        depthCm,
      }));
    }

    for (const p of points) depthMax = Math.max(depthMax, p.depthCm);
    for (const c of curve) depthMax = Math.max(depthMax, c.depthCm);

    series.push({
      district,
      color: colors[i % colors.length],
      points,
      curve,
      latestDepthCm: latest.depthCm,
      trend: latest.trend,
    });
    i++;
  }

  return { series, tMin, tMax, depthMax: depthMax * 1.12 };
}

// ── Daily bar chart: water level (cm) by hour-of-day for one district ───────────────────────

export interface HourBucket {
  hour: number; // 0–23 (local)
  depthCm: number; // peak depth observed (or projected) that hour (0 if no reports)
  severity: Severity | null; // severity of the peak report (drives bar color)
  /** true when this bar comes from the predictive model (an hour later today with no report yet
   *  of its own), rather than an actually-reported depth. Rendered dashed, never solid. */
  projected: boolean;
}

export interface DailyWaterBars {
  bars: HourBucket[]; // always length 24
  depthMax: number; // Y scale (cm), padded
}

/** Only supplied when the browsed day is today — projects the hours after "now" forward from each
 *  currently-active report, so the chart's remaining-today bars aren't just empty. */
export interface FutureProjection {
  now: number;
  rainActive: boolean;
  activeReports: FloodReport[];
}

/**
 * Bucket reports for one local day (`ymd`, YYYY-MM-DD) into 24 hourly bars, keeping only those
 * the `keep` predicate accepts (e.g. matching a searched street or district). Each bar's height is
 * the peak depth reported that hour; its color follows that report's severity.
 *
 * When `future` is given (the browsed day is today), hours after the current one have no real
 * report yet — instead of leaving them empty, project every matching active report forward to that
 * hour via the predictive water-level model and take the peak, marking the bar `projected`. Past
 * days never get projected bars (the caller simply omits `future`). Pure — no side effects.
 */
export function buildDailyWaterBars(
  reports: FloodReport[],
  ymd: string,
  keep: (r: FloodReport) => boolean,
  future?: FutureProjection
): DailyWaterBars {
  const bars: HourBucket[] = Array.from({ length: 24 }, (_, hour) => ({ hour, depthCm: 0, severity: null, projected: false }));

  for (const r of reports) {
    if (!keep(r)) continue;
    if (localDateKey(r.createdAt) !== ymd) continue;
    const hour = new Date(r.createdAt).getHours();
    if (r.depthCm > bars[hour].depthCm) {
      bars[hour] = { hour, depthCm: r.depthCm, severity: r.severity, projected: false };
    }
  }

  if (future && localDateKey(new Date(future.now)) === ymd) {
    const dayStart = new Date(future.now);
    dayStart.setHours(0, 0, 0, 0);
    const currentHour = new Date(future.now).getHours();
    for (const r of future.activeReports) {
      if (!keep(r)) continue;
      const anchor = observationAnchorMs(r);
      for (let hour = currentHour + 1; hour < 24; hour++) {
        const bucketMs = dayStart.getTime() + hour * 3_600_000;
        const hoursSinceAnchor = Number.isNaN(anchor) ? 0 : Math.max(0, Math.floor((bucketMs - anchor) / 3_600_000));
        const depthCm = projectDepth(r, future.rainActive, hoursSinceAnchor);
        if (depthCm > bars[hour].depthCm) {
          bars[hour] = { hour, depthCm, severity: r.severity, projected: true };
        }
      }
    }
  }

  let depthMax = MIN_DEPTH_AXIS;
  for (const b of bars) depthMax = Math.max(depthMax, b.depthCm);
  return { bars, depthMax: depthMax * 1.12 };
}
