// Derived view model for the flood map + sidebar, ported from the design's renderVals().
// Pure functions over the live API data + the user's location.

import type { FloodReport, LatLng, RescueRequest, Road, Severity } from '../types';
import { kmBetween } from './geo';
import { RESCUE_STATUS_RANK, ROAD_RANK, roadFromDepth, ROAD_RISKY_CM, SEV_META, SEV_RANK, type SevMeta } from './floodMeta';
import { timeAgo } from './format';
import { roadsWithinRadius, snapToRoad } from './roadSnap';

// Affected-area model — planar ("bathtub") inundation: floodwater of depth h spreads horizontally
// until the ground rises to meet it, so the inundation radius ≈ h / S, where S is the local ground
// slope. Metro Manila's Marikina–Pasig floodplain is very flat (~0.3%), used here as a representative
// default. (This also happens to match the old "~3 m per cm" heuristic, which implied a 1/300 slope.)
export const FLOODPLAIN_SLOPE = 0.003; // 0.3% ground slope (vertical/horizontal), dimensionless
export const AFFECTED_MIN_M = 60; // display floor so shallow reports still show a ring
export const AFFECTED_MAX_M = 2000; // display ceiling so a very deep report doesn't swamp the map

/** Real-world inundation radius (km) for a water depth, via radius = depth / slope (clamped). */
export function affectedRadiusKm(depthCm: number, slope: number = FLOODPLAIN_SLOPE): number {
  const radiusM = (depthCm / 100) / slope; // depth (m) ÷ slope → horizontal reach (m)
  return Math.min(AFFECTED_MAX_M, Math.max(AFFECTED_MIN_M, radiusM)) / 1000;
}

/**
 * Ratio by which a water-level rise widens the affected zone. Diameter grows ∝ depth; flooded area
 * grows ∝ depth². Computed from the (clamped) drawn radii so the figures match the map exactly.
 */
export function affectedRiseRatio(depthCm: number, riseCm: number): { diameter: number; area: number } {
  const r0 = affectedRadiusKm(depthCm);
  const r1 = affectedRadiusKm(depthCm + Math.max(0, riseCm));
  const diameter = r0 > 0 ? r1 / r0 : 1;
  return { diameter, area: diameter * diameter };
}

// Predictive "what if water keeps rising" control: how many cm of extra depth to project. At 0
// the map shows current affected areas; higher values widen each ring to its projected reach.
export const WATER_RISE_MIN = 0; // cm
export const WATER_RISE_MAX = 100; // cm
export const WATER_RISE_STEP = 5; // cm
export const WATER_RISE_DEFAULT = 0;

export const MONITOR_RADIUS_KM = 3; // default "monitoring area" boundary around the user
export const MONITOR_RADIUS_MIN = 1; // 1 km
export const MONITOR_RADIUS_MAX = 20; // 20 km
export const MONITOR_RADIUS_STEP = 1; // 1 km

// A report is considered "live" for this long after its last activity. Past it the report drops
// off the map/feed and the reporter is free to post again. A confirmation or re-report bumps the
// report's `updatedAt`, which resets this window — fresh sightings keep a flood on the map.
export const REPORT_TTL_MIN = 30;

export interface EnrichedReport extends FloodReport {
  sev: SevMeta;
  distKm: number;
  affectedKm: number; // affected-area radius derived from this report's depth
  edgeKm: number;
  time: string;
  mine: boolean;
  ageMin: number;
  expiresInMin: number;
  expired: boolean;
}

export interface SafetyStatus {
  tone: 'danger' | 'warn' | 'ok';
  badge: string;
  title: string;
  line: string;
  sub: string;
  eta: string | null;
}

export function enrichReports(
  reports: FloodReport[],
  userLoc: LatLng,
  authUserId: number | null,
  now: number = Date.now()
): EnrichedReport[] {
  return reports.map((r) => {
    const distKm = kmBetween(userLoc, { lat: r.latitude, lng: r.longitude });
    // Affected radius scales with this report's depth (not a uniform slider).
    const affectedKm = affectedRadiusKm(r.depthCm);
    // Anchor the TTL on the last activity (confirm/re-report bumps `updatedAt`), so confirmations
    // reset the timer. Fall back to createdAt if updatedAt is missing/unparseable.
    const lastActivity = new Date(r.updatedAt ?? r.createdAt).getTime();
    const anchor = Number.isNaN(lastActivity) ? new Date(r.createdAt).getTime() : lastActivity;
    const ageMin = Number.isNaN(anchor) ? 0 : Math.max(0, Math.floor((now - anchor) / 60000));
    const expiresInMin = Math.max(0, REPORT_TTL_MIN - ageMin);
    return {
      ...r,
      sev: SEV_META[r.severity],
      distKm,
      affectedKm,
      edgeKm: distKm - affectedKm,
      time: timeAgo(r.createdAt),
      mine: authUserId != null && r.reporterUserId === authUserId,
      ageMin,
      expiresInMin,
      expired: r.status === 'resolved' || expiresInMin <= 0,
    };
  });
}

/** One road's aggregated condition, rolled up from every report that mentions it. */
export interface RoadEntry {
  key: string;
  name: string;
  district: string;
  road: Road;            // inferred from the deepest report's water depth (roadFromDepth)
  severity: Severity;    // severity of the representative (deepest) report
  depthCm: number;       // depth of the representative (deepest) report
  reportCount: number;   // how many reports contributed
  confirmed: boolean;    // corroborated by ≥2 reports/confirmations (else provisional)
  latitude: number;
  longitude: number;
  reportId: number;      // representative report — clicking opens its detail card
  time: string;          // relative time of the most recent contributing report
  roadId?: number;       // OSM road id when the report snapped to a real road
  path?: LatLng[];       // real road geometry (the affected stretch) when snapped
}

export interface DistrictRoads {
  district: string;
  roads: RoadEntry[];
}

/**
 * Roll up reports into a per-district directory of roads with their current condition.
 * Each report is snapped to the real road it sits on (bundled OSM data via `snapToRoad`); reports
 * on the same road collapse into one entry with that road's canonical name + real geometry. Reports
 * that don't snap (no road within range, or the dataset hasn't loaded) fall back to grouping by
 * district + name. Condition is inferred from the deepest report's water depth; the representative
 * is the worst report (ties broken by most recent). Roads sort worst-first; districts alphabetically.
 */
export function buildRoadDirectory(reports: FloodReport[]): DistrictRoads[] {
  const snaps = new Map<number, ReturnType<typeof snapToRoad>>();
  const groups = new Map<string, FloodReport[]>();
  for (const r of reports) {
    const snap = snapToRoad(r.latitude, r.longitude);
    snaps.set(r.id, snap);
    const key = snap
      ? `road:${snap.roadId}`
      : `${r.district.trim().toLowerCase()}|${r.name.trim().toLowerCase()}`;
    const bucket = groups.get(key);
    if (bucket) bucket.push(r);
    else groups.set(key, [r]);
  }

  const entries: RoadEntry[] = [];
  for (const [key, rs] of groups) {
    // Representative = deepest water (worst inferred passability), then worst severity, then most
    // recently updated. Passability is inferred from depth, not the reporter's manual pick.
    const rep = [...rs].sort(
      (a, b) =>
        b.depthCm - a.depthCm ||
        SEV_RANK[b.severity] - SEV_RANK[a.severity] ||
        new Date(b.updatedAt ?? b.createdAt).getTime() - new Date(a.updatedAt ?? a.createdAt).getTime()
    )[0];
    const newest = rs.reduce((acc, r) =>
      new Date(r.createdAt).getTime() > new Date(acc.createdAt).getTime() ? r : acc
    );
    // Corroborated when ≥2 reports mention this road, or confirmations push the tally to ≥2.
    const totalReports = rs.reduce((n, r) => n + Math.max(1, r.reportsCount), 0);
    // Prefer the snapped road's canonical name + real geometry — the representative's snap, else any
    // snapped report in the group; falls back to the report's own label when nothing snapped.
    const repSnap = snaps.get(rep.id) ?? rs.map((r) => snaps.get(r.id)).find(Boolean) ?? null;
    entries.push({
      key,
      name: repSnap?.name ?? rep.name,
      district: rep.district,
      road: roadFromDepth(rep.depthCm),
      severity: rep.severity,
      depthCm: rep.depthCm,
      reportCount: rs.length,
      confirmed: rs.length >= 2 || totalReports >= 2,
      latitude: rep.latitude,
      longitude: rep.longitude,
      reportId: rep.id,
      time: timeAgo(newest.createdAt),
      roadId: repSnap?.roadId,
      path: repSnap?.path,
    });
  }

  const byDistrict = new Map<string, RoadEntry[]>();
  for (const e of entries) {
    const bucket = byDistrict.get(e.district);
    if (bucket) bucket.push(e);
    else byDistrict.set(e.district, [e]);
  }

  return [...byDistrict.entries()]
    .map(([district, roads]) => ({
      district,
      roads: roads.sort(
        (a, b) => ROAD_RANK[b.road] - ROAD_RANK[a.road] || a.name.localeCompare(b.name)
      ),
    }))
    .sort((a, b) => a.district.localeCompare(b.district));
}

export interface PossibleClosure {
  roadId: number;
  name: string;
  status: Road;        // inferred passability (impassable | risky)
  estDepthCm: number;  // estimated water depth where the flood reaches this road
  path: LatLng[];      // road geometry clipped to the flooded ring
}

/**
 * Infer roads possibly closed inside each report's flooded area. Inverts the inundation model: modeled
 * depth drops by `slope` per metre out from the report, so a road's closest distance implies its likely
 * passability. Each report reaches out to where modeled depth hits the risky threshold; every road in
 * range is graded via roadFromDepth and the worst (deepest) estimate wins across overlapping floods.
 * A report's own directly-snapped road is dropped — that's the high-confidence "reported" overlay,
 * not an inference.
 */
export function buildPossibleClosures(reports: FloodReport[]): PossibleClosure[] {
  const reported = new Set<number>();
  for (const r of reports) {
    const snap = snapToRoad(r.latitude, r.longitude);
    if (snap) reported.add(snap.roadId);
  }
  const worst = new Map<number, PossibleClosure>();
  for (const r of reports) {
    const rMaxM = (r.depthCm - ROAD_RISKY_CM) / (FLOODPLAIN_SLOPE * 100); // reach out to risky-depth
    if (rMaxM <= 0) continue;
    for (const nr of roadsWithinRadius(r.latitude, r.longitude, rMaxM / 1000)) {
      if (reported.has(nr.roadId)) continue;
      const estDepthCm = r.depthCm - nr.nearestM * FLOODPLAIN_SLOPE * 100;
      const status = roadFromDepth(estDepthCm);
      if (status === 'passable') continue;
      const prev = worst.get(nr.roadId);
      if (!prev || estDepthCm > prev.estDepthCm) {
        worst.set(nr.roadId, { roadId: nr.roadId, name: nr.name, status, estDepthCm, path: nr.path });
      }
    }
  }
  return [...worst.values()];
}

export interface RescueDistrictCount {
  district: string;
  count: number;
}

/** Tally rescue requests per district, busiest first (ties broken alphabetically). */
export function rescueCountsByDistrict(rescues: RescueRequest[]): RescueDistrictCount[] {
  const counts = new Map<string, number>();
  for (const r of rescues) {
    const d = r.district?.trim() || 'Unknown area';
    counts.set(d, (counts.get(d) ?? 0) + 1);
  }
  return [...counts.entries()]
    .map(([district, count]) => ({ district, count }))
    .sort((a, b) => b.count - a.count || a.district.localeCompare(b.district));
}

/** Local-timezone calendar day of an ISO timestamp as `YYYY-MM-DD` (so "today" matches the user's clock). */
export function localDateKey(iso: string | Date): string {
  const d = iso instanceof Date ? iso : new Date(iso);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/** Rescue requests created on the given local day (`YYYY-MM-DD`), newest first. */
export function rescuesOnLocalDate(rescues: RescueRequest[], ymd: string): RescueRequest[] {
  return rescues
    .filter((r) => localDateKey(r.createdAt) === ymd)
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
}

// ── Response-team view model: rescue triage, district hotspots and surge trend ──────────────

export interface EnrichedRescue extends RescueRequest {
  waitMin: number;        // minutes since the request was first created
  sinceUpdateMin: number; // minutes since the last (re-)request
  reRequested: boolean;   // the sender pinged again after the first request — still waiting
  place: string;          // "barangay · city · district"
  urgency: number;        // higher = triage sooner (within a status)
}

/**
 * Enrich rescue requests for the response console: time waiting, a place label and an urgency
 * score. Requests in a district with severe or rising active flooding are boosted, as are ones
 * the sender re-pinged. `reports` should be the currently-active reports.
 */
export function enrichRescues(
  rescues: RescueRequest[],
  reports: FloodReport[],
  now: number = Date.now()
): EnrichedRescue[] {
  const hotDistricts = new Set<string>();
  for (const r of reports) {
    if (r.severity === 'high' || r.trend === 'rising') hotDistricts.add(r.district.trim().toLowerCase());
  }
  return rescues.map((r) => {
    const created = new Date(r.createdAt).getTime();
    const last = new Date(r.lastRequestedAt ?? r.createdAt).getTime();
    const waitMin = Number.isNaN(created) ? 0 : Math.max(0, Math.floor((now - created) / 60000));
    const sinceUpdateMin = Number.isNaN(last) ? waitMin : Math.max(0, Math.floor((now - last) / 60000));
    const reRequested = !Number.isNaN(created) && !Number.isNaN(last) && last - created > 60000;
    const place = [r.barangay, r.city, r.district].map((s) => s?.trim()).filter(Boolean).join(' · ') || 'Unknown area';
    const hot = hotDistricts.has((r.district ?? '').trim().toLowerCase());
    const urgency = waitMin + (reRequested ? 120 : 0) + (hot ? 60 : 0);
    return { ...r, waitMin, sinceUpdateMin, reRequested, place, urgency };
  });
}

/** Triage order for the queue: open work first (pending → dispatched → resolved), then urgency. */
export function rescueQueue(enriched: EnrichedRescue[]): EnrichedRescue[] {
  return [...enriched].sort(
    (a, b) => RESCUE_STATUS_RANK[b.status] - RESCUE_STATUS_RANK[a.status] || b.urgency - a.urgency
  );
}

export interface DistrictHotspot {
  district: string;
  rescueCount: number;   // open (unresolved) rescue requests
  highCount: number;     // high-severity active reports
  risingCount: number;   // rising active reports
  reportCount: number;
  worstSeverity: Severity | null;
  score: number;         // combined response load — higher = prioritize
}

/**
 * Rank districts by combined response load: open rescue requests weigh heaviest (people waiting),
 * then severe and rising flooding. `reports` should be the currently-active reports.
 */
export function districtHotspots(reports: FloodReport[], rescues: RescueRequest[]): DistrictHotspot[] {
  const map = new Map<string, DistrictHotspot>();
  const bucket = (district: string | null | undefined): DistrictHotspot => {
    const key = district?.trim() || 'Unknown area';
    let h = map.get(key);
    if (!h) {
      h = { district: key, rescueCount: 0, highCount: 0, risingCount: 0, reportCount: 0, worstSeverity: null, score: 0 };
      map.set(key, h);
    }
    return h;
  };
  for (const r of reports) {
    const h = bucket(r.district);
    h.reportCount++;
    if (r.severity === 'high') h.highCount++;
    if (r.trend === 'rising') h.risingCount++;
    if (!h.worstSeverity || SEV_RANK[r.severity] > SEV_RANK[h.worstSeverity]) h.worstSeverity = r.severity;
  }
  for (const r of rescues) {
    if (r.status === 'resolved') continue;
    bucket(r.district).rescueCount++;
  }
  const list = [...map.values()];
  for (const h of list) h.score = h.rescueCount * 5 + h.highCount * 3 + h.risingCount * 2 + h.reportCount;
  return list
    .filter((h) => h.score > 0)
    .sort((a, b) => b.score - a.score || a.district.localeCompare(b.district));
}

export interface SurgeBucket {
  label: string;   // hour label, e.g. "3 PM"
  start: number;   // epoch ms at the top of the hour
  rescues: number;
  reports: number;
}

/** Rescues & reports bucketed by hour over the trailing `hours` window — surfaces a surge. */
export function hourlySurge(
  reports: FloodReport[],
  rescues: RescueRequest[],
  hours: number = 12,
  now: number = Date.now()
): SurgeBucket[] {
  const top = new Date(now);
  top.setMinutes(0, 0, 0);
  const buckets: SurgeBucket[] = [];
  for (let i = hours - 1; i >= 0; i--) {
    const start = top.getTime() - i * 3600000;
    buckets.push({ label: new Date(start).toLocaleTimeString([], { hour: 'numeric' }), start, rescues: 0, reports: 0 });
  }
  const base = buckets[0].start;
  const idxOf = (iso: string): number => {
    const t = new Date(iso).getTime();
    if (Number.isNaN(t)) return -1;
    const i = Math.floor((t - base) / 3600000);
    return i >= 0 && i < buckets.length ? i : -1;
  };
  for (const r of reports) { const i = idxOf(r.createdAt); if (i >= 0) buckets[i].reports++; }
  for (const r of rescues) { const i = idxOf(r.createdAt); if (i >= 0) buckets[i].rescues++; }
  return buckets;
}

const RANK: Record<Severity, number> = { high: 3, medium: 2, low: 1 };

export function computeStatus(enriched: EnrichedReport[]): SafetyStatus {
  const inside = enriched
    .filter((r) => r.edgeKm <= 0)
    .sort((a, b) => RANK[b.severity] - RANK[a.severity]);

  let status: SafetyStatus;
  if (inside.length) {
    const w = inside[0];
    status = {
      tone: 'danger',
      badge: 'IN FLOOD ZONE',
      title: 'You are in a flood-affected area',
      line: `${w.sev.label} flooding at ${w.name} — about ${w.depthCm} cm.`,
      sub: 'Move to higher ground and never wade through fast-moving water.',
      eta: null,
    };
  } else {
    const near = enriched.filter((r) => r.edgeKm <= 2.5).sort((a, b) => a.edgeKm - b.edgeKm);
    if (near.length) {
      const ne = near[0];
      status = {
        tone: 'warn',
        badge: 'STAY ALERT',
        title: 'Flooding is close by',
        line: `Nearest flooding is ~${ne.edgeKm.toFixed(1)} km away at ${ne.name} (${ne.sev.label.toLowerCase()}${ne.trend === 'rising' ? ', rising' : ''}).`,
        sub: 'Plan an alternate route and keep checking before you travel.',
        eta: null,
      };
    } else {
      status = {
        tone: 'ok',
        badge: 'CLEAR',
        title: 'No flooding near you',
        line: 'There are no reports within 2.5 km of your location.',
        sub: 'Conditions change fast in heavy rain — keep this open to stay updated.',
        eta: null,
      };
    }
  }

  // Spread ETA for nearby rising water.
  const risingNear = enriched
    .filter((r) => r.severity !== 'low' && r.trend === 'rising' && r.edgeKm <= 3)
    .sort((a, b) => a.edgeKm - b.edgeKm)[0];
  if (risingNear) {
    if (risingNear.edgeKm <= 0) {
      status.eta = `Water from ${risingNear.name} is at your area and still rising.`;
    } else {
      const lo = Math.max(1, Math.round(risingNear.edgeKm / 0.98));
      const hi = Math.max(lo + 1, Math.round(risingNear.edgeKm / 0.49));
      status.eta = `At the current rate, flooding from ${risingNear.name} could reach you in ~${lo}–${hi} hr (rough estimate).`;
    }
  }
  return status;
}
