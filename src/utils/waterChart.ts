// Pure builder for the per-district water-level-over-time chart.
//
// The data has no stored history — each report is a single snapshot (depthCm + createdAt).
// So per district we plot the *real* report depths as markers at their timestamps and draw a
// *synthesized* trend line through/around them: with one report we fall back to waterSeries()
// (the same 6-hour synthesis the detail sparkline uses); with several we connect the real points.
// Keep this layer side-effect-free.

import type { FloodReport, Trend } from '../types';
import { waterSeries } from './floodMeta';

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
