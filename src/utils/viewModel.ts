// Derived view model for the flood map + sidebar, ported from the design's renderVals().
// Pure functions over the live API data + the user's location.

import type { FloodAlert, FloodProneArea, FloodReport, LatLng, RescueRequest, Road, Severity, Trend } from '../types';
import { kmBetween } from './geo';
import { RESCUE_STATUS_RANK, ROAD_RANK, roadFromDepth, ROAD_RISKY_CM, SEV_META, SEV_RANK, type SevMeta } from './floodMeta';
import { timeAgo } from './format';
import { roadsWithinRadius, snapToRoad } from './roadSnap';
import { translate, tFormat, sevLabel, getLang, type Lang } from '../i18n';

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
//
// The window scales with severity because deeper floods physically persist longer: in Metro
// Manila's pluvial flooding, ankle-deep water on streets with working drainage clears within
// ~15–30 min of the rain easing, knee-to-waist water lingers roughly half an hour to a couple of
// hours, and chest-deep+ water in low-lying catch basins (Marikina/Pasig floodplain) stays for
// hours. So a shallow sighting goes stale fast while a severe one stays trustworthy longer.
export const REPORT_TTL_MIN: Record<Severity, number> = {
  low: 20, // ankle-deep — drains quickly once rain lets up
  medium: 45, // knee–waist — persists tens of minutes to a couple of hours
  high: 90, // chest-deep+ — low-lying water lingers for hours
};

/** Default/fallback freshness window (medium), for callers without a specific severity. */
export const REPORT_TTL_DEFAULT_MIN = REPORT_TTL_MIN.medium;

// Two active reports by the same person must be at least this far apart. Closer than this is
// treated as the SAME flood (Confirm/update the existing report instead of posting a duplicate);
// farther — e.g. driven down the road to a new flooded street — is a distinct sighting, so a
// second report is allowed. This replaces the old blanket "one active report per person" gate.
export const REPORT_DISTINCT_M = 250; // metres

// ── Flood-prone zone proximity gate ─────────────────────────────────────────────────
// A geo-stamped FloodAlert (warned from a flood-prone area) only matters to people near that
// area; a global alert (no geometry — every alert before this feature, and any admin still
// posts one that way) must keep applying to everyone exactly as it always has.

// Extra slack (km) added on top of the zone's own radius before a geo alert stops applying —
// covers GPS drift and lets someone just outside the drawn circle still get the warning.
export const PROXIMITY_MARGIN_KM = 0.3;

/**
 * Filter alerts to the ones that apply to `userLoc`. Global alerts (no lat/lng) always pass —
 * that's the pre-existing, non-negotiable behavior. Geo-stamped alerts pass only when the user is
 * within `radiusM/1000 + PROXIMITY_MARGIN_KM` of the alert's point.
 *
 * Fails OPEN when `userLoc` is null (location unknown/denied): a geo alert is shown rather than
 * hidden. A missed flood warning is worse than a spurious one — the cost of a false positive here
 * (someone sees a warning that turns out not to apply to them) is far lower than the cost of a
 * false negative (someone never finds out their area is being actively warned about).
 */
export function alertsForUser(alerts: FloodAlert[], userLoc: LatLng | null): FloodAlert[] {
  return alerts.filter((a) => {
    if (a.latitude == null || a.longitude == null) return true; // global — always applies
    if (!userLoc) return true; // fail open — see doc comment above
    const radiusKm = (a.radiusM ?? 0) / 1000;
    return kmBetween(userLoc, { lat: a.latitude, lng: a.longitude }) <= radiusKm + PROXIMITY_MARGIN_KM;
  });
}

/**
 * Active geo-stamped warnings whose warned circle **overlaps the user's "My area" circle** — two
 * circles intersect when the distance between their centers is at most the sum of their radii.
 *
 * This is a deliberately WIDER net than `alertsForUser` above, and answers a different question.
 * That one asks "does this warning apply to where I am standing?" (zone radius + a 300 m GPS
 * margin) and drives the ribbon, the alarm and the OS notification. This one asks "has anything
 * been warned inside the area I said I care about?", which is the whole point of the My-area
 * slider. A 500 m zone 2 km away fails the first test and passes this one at the default 3 km
 * radius — so callers must feed this the RAW alert list, never `alertsForUser`'s output, or the
 * narrower gate would have already discarded exactly the warnings this is meant to surface.
 *
 * Unlike `alertsForUser` this fails CLOSED when `userLoc` is null: with no location there is no
 * monitoring area, so "a warning was issued inside your area" would be a claim we cannot make.
 * Nothing is lost by staying quiet — the ribbon's fail-open still surfaces every geo warning to a
 * user whose location is unknown.
 *
 * Sorted nearest-first so the caller can lead with the closest one.
 */
export function alertsInMonitorArea(
  alerts: FloodAlert[],
  userLoc: LatLng | null,
  monitorRadiusKm: number
): FloodAlert[] {
  if (!userLoc) return [];
  return alerts
    .filter((a) => a.active && a.latitude != null && a.longitude != null)
    .map((a) => ({ a, km: kmBetween(userLoc, { lat: Number(a.latitude), lng: Number(a.longitude) }) }))
    .filter(({ a, km }) => km <= (a.radiusM ?? 0) / 1000 + monitorRadiusKm)
    .sort((x, y) => x.km - y.km)
    .map(({ a }) => a);
}

/** A flood-prone zone augmented with its current live status, for the map's name-bubble labels. */
export interface ZoneStatus extends FloodProneArea {
  /** Whether an active report's center currently lies within this zone's own radiusM. */
  flooded: boolean;
  /** Deepest depth among the reports inside, or null when `flooded` is false. */
  worstDepthCm: number | null;
}

/**
 * Zones augmented with their live "is it actually flooded right now" status — drives FloodMap's
 * bubble color (quiet vs. red-pulse) and sub-line. Same proximity-gate idiom as `alertsForUser`,
 * but scoped to each zone's own `radiusM` rather than a fixed margin (unlike the App-level
 * "already reported nearby" check ZoneReportModal uses, which is a fixed ~150 m dedup gate, not
 * this zone-radius "is it flooded" signal). `reports` should be the currently-visible/active set.
 */
export function zonesWithStatus(zones: FloodProneArea[], reports: FloodReport[]): ZoneStatus[] {
  return zones.map((z) => {
    const inside = reports.filter(
      (r) => kmBetween({ lat: z.latitude, lng: z.longitude }, { lat: r.latitude, lng: r.longitude }) * 1000 <= z.radiusM
    );
    return {
      ...z,
      flooded: inside.length > 0,
      worstDepthCm: inside.length ? Math.max(...inside.map((r) => r.depthCm)) : null,
    };
  });
}

/** Floor on the match radius so a tight-radius zone still absorbs a pin dropped a block away. */
export const ZONE_MATCH_MIN_M = 150;

/**
 * The existing zone a new pin at `loc` would duplicate — the nearest whose circle (or the
 * ZONE_MATCH_MIN_M floor, whichever is larger) contains the pin — or undefined when `loc` is a
 * genuinely new place. Pass `excludeId` when re-checking a zone against its own row on edit.
 *
 * Why: a place that already sits inside an advisory circle IS that advisory; minting a second row
 * for it just splits one place across two records (two markers, two edit histories, two things an
 * admin has to remember to keep in sync) with nothing gained. This is the create-time counterpart
 * to `zonesWithStatus`'s live-flooded check above, applied to zone-vs-zone instead of zone-vs-report.
 */
export function matchingProneZone(
  zones: FloodProneArea[],
  loc: LatLng,
  excludeId?: number
): FloodProneArea | undefined {
  return zones
    .filter((z) => z.id !== excludeId)
    .map((z) => ({ z, m: kmBetween({ lat: z.latitude, lng: z.longitude }, loc) * 1000 }))
    .filter((x) => x.m <= Math.max(x.z.radiusM, ZONE_MATCH_MIN_M))
    .sort((a, b) => a.m - b.m)[0]?.z;
}

export interface EnrichedReport extends FloodReport {
  sev: SevMeta;
  distKm: number;
  affectedKm: number; // affected-area radius derived from this report's depth
  edgeKm: number;
  time: string;
  mine: boolean;
  /** Authored by a no-login guest/device session — surfaced as lower-trust until corroborated. */
  guest: boolean;
  /** An authoritative report an admin logged from news/other sources. */
  system: boolean;
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
    // Anchor the TTL on when the flood was reported. Admin "system" reports carry a `reportedAt`
    // (the source's report time, possibly hours ago) — that anchors the countdown so stale external
    // reports drop off correctly. Citizen reports have no reportedAt, so they anchor on the last
    // activity (confirm/re-report bumps `updatedAt`, resetting the timer). Fall back to createdAt if
    // the chosen anchor is missing/unparseable.
    const anchorSource = r.reportedAt ?? r.updatedAt ?? r.createdAt;
    const anchorMs = new Date(anchorSource).getTime();
    const anchor = Number.isNaN(anchorMs) ? new Date(r.createdAt).getTime() : anchorMs;
    const ageMin = Number.isNaN(anchor) ? 0 : Math.max(0, Math.floor((now - anchor) / 60000));
    // A per-report TTL override (admin-defined, minutes) wins over the severity-scaled default.
    const ttlMin = r.ttlMinutes && r.ttlMinutes > 0 ? r.ttlMinutes : (REPORT_TTL_MIN[r.severity] ?? REPORT_TTL_DEFAULT_MIN);
    const expiresInMin = Math.max(0, ttlMin - ageMin);
    return {
      ...r,
      sev: SEV_META[r.severity],
      distKm,
      affectedKm,
      edgeKm: distKm - affectedKm,
      time: timeAgo(r.createdAt),
      mine: authUserId != null && r.reporterUserId === authUserId,
      guest: r.reporterTrust === 'guest',
      system: r.reporterTrust === 'system',
      ageMin,
      expiresInMin,
      expired: r.status === 'resolved' || expiresInMin <= 0,
    };
  });
}

/**
 * The user's nearest still-active report within `withinM` of `loc`, if any — i.e. the report a new
 * pin at `loc` would duplicate. Returns undefined when `loc` is a distinct area, which is the signal
 * that a second report is allowed (the "drove to a new flooded street" case). Pure over `enriched`.
 */
export function nearbyOwnActiveReport(
  enriched: EnrichedReport[],
  loc: LatLng,
  withinM: number = REPORT_DISTINCT_M
): EnrichedReport | undefined {
  return enriched
    .filter((r) => r.mine && !r.expired)
    .map((r) => ({ r, m: kmBetween(loc, { lat: r.latitude, lng: r.longitude }) * 1000 }))
    .filter((x) => x.m <= withinM)
    .sort((a, b) => a.m - b.m)[0]?.r;
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
    // Guest-only clusters need a higher bar (≥3 reports) so one no-login device can't self-"confirm";
    // a single verified reporter in the mix restores the normal ≥2 threshold. (reporterTrust absent
    // on older payloads counts as verified, preserving prior behavior.)
    const totalReports = rs.reduce((n, r) => n + Math.max(1, r.reportsCount), 0);
    const hasVerified = rs.some((r) => r.reporterTrust !== 'guest');
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
      confirmed: hasVerified ? rs.length >= 2 || totalReports >= 2 : rs.length >= 3,
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

// ── Public dashboard view model: closures near a searched place + a recent-reports table ──────

/**
 * Split a stored report `district` label into its locality ("city/area") and the wider
 * district/region. Reports record district as "Area, Region" (e.g. "Batasan Hills, Metro Manila")
 * — geocode.ts joins the locality and state. Falls back gracefully for blank/single-part labels.
 */
export function localityParts(district: string | null | undefined): { city: string; district: string } {
  const parts = (district ?? '').split(',').map((s) => s.trim()).filter(Boolean);
  if (parts.length === 0) return { city: 'Unknown area', district: '—' };
  if (parts.length === 1) return { city: parts[0], district: parts[0] };
  return { city: parts[0], district: parts.slice(1).join(', ') };
}

/** A road that may be closed within a searched location's impact radius. */
export interface NearbyClosure {
  key: string;
  name: string;
  status: Road;        // risky | impassable (passable roads aren't "closures")
  depthCm: number;     // observed depth (reported) or estimated depth (inferred)
  reportCount: number; // contributing reports — 0 for inferred closures
  inferred: boolean;   // true = derived from a nearby flooded area, not directly reported
  distanceKm: number;  // distance from the searched location
  latitude: number;
  longitude: number;
}

/**
 * Every road that may be closed within `radiusKm` of `center`, worst-condition first. Combines two
 * sources: directly-reported impassable/risky roads (from the road directory) and inferred possible
 * closures (roads inside a nearby flood's modeled reach). An inferred closure is dropped when the
 * same road is already directly reported, so it isn't listed twice. Pure over the precomputed inputs.
 */
export function closuresNearLocation(
  directory: DistrictRoads[],
  closures: PossibleClosure[],
  center: LatLng,
  radiusKm: number
): NearbyClosure[] {
  const out: NearbyClosure[] = [];
  const reportedRoadIds = new Set<number>();
  for (const d of directory) {
    for (const r of d.roads) {
      if (r.roadId != null) reportedRoadIds.add(r.roadId);
      if (r.road === 'passable') continue; // only risky/impassable count as a closure
      const distanceKm = kmBetween(center, { lat: r.latitude, lng: r.longitude });
      if (distanceKm > radiusKm) continue;
      out.push({
        key: `reported:${r.key}`,
        name: r.name,
        status: r.road,
        depthCm: r.depthCm,
        reportCount: r.reportCount,
        inferred: false,
        distanceKm,
        latitude: r.latitude,
        longitude: r.longitude,
      });
    }
  }
  for (const c of closures) {
    if (reportedRoadIds.has(c.roadId)) continue; // already shown as a reported road
    const mid = c.path[Math.floor(c.path.length / 2)] ?? c.path[0];
    if (!mid) continue;
    const distanceKm = kmBetween(center, mid);
    if (distanceKm > radiusKm) continue;
    out.push({
      key: `inferred:${c.roadId}`,
      name: c.name,
      status: c.status,
      depthCm: Math.round(c.estDepthCm),
      reportCount: 0,
      inferred: true,
      distanceKm,
      latitude: mid.lat,
      longitude: mid.lng,
    });
  }
  return out.sort(
    (a, b) => ROAD_RANK[b.status] - ROAD_RANK[a.status] || a.distanceKm - b.distanceKm || a.name.localeCompare(b.name)
  );
}

/** One row of the recent-reports table: a user flood report with its locality split out. */
export interface RecentReportRow {
  id: number;
  name: string;
  city: string;
  district: string;
  depthCm: number;
  severity: Severity;
  trend: Trend;
  reportsCount: number;
  createdAt: string;
  time: string; // relative ("12 min ago")
  latitude: number;
  longitude: number;
}

/**
 * Active user reports from the trailing `hours` window (default 12 h), deepest water first
 * (ties broken newest-first). Resolved reports are excluded. Drives the dashboard table — note it
 * uses the raw reports, not the short TTL-filtered "active" set, so the full 12-hour history shows.
 */
export function recentReportRows(reports: FloodReport[], hours = 12, now: number = Date.now()): RecentReportRow[] {
  const cutoff = now - hours * 3600000;
  return reports
    .filter((r) => {
      if (r.status === 'resolved') return false;
      const t = new Date(r.createdAt).getTime();
      return !Number.isNaN(t) && t >= cutoff;
    })
    .map((r) => {
      const { city, district } = localityParts(r.district);
      return {
        id: r.id,
        name: r.name,
        city,
        district,
        depthCm: r.depthCm,
        severity: r.severity,
        trend: r.trend,
        reportsCount: r.reportsCount,
        createdAt: r.createdAt,
        time: timeAgo(r.createdAt),
        latitude: r.latitude,
        longitude: r.longitude,
      };
    })
    .sort((a, b) => b.depthCm - a.depthCm || new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
}

const RANK: Record<Severity, number> = { high: 3, medium: 2, low: 1 };

export function computeStatus(enriched: EnrichedReport[], lang: Lang = getLang()): SafetyStatus {
  const inside = enriched
    .filter((r) => r.edgeKm <= 0)
    .sort((a, b) => RANK[b.severity] - RANK[a.severity]);

  let status: SafetyStatus;
  if (inside.length) {
    const w = inside[0];
    status = {
      tone: 'danger',
      badge: translate(lang, 'status.inFloodZone'),
      title: translate(lang, 'status.inFloodZoneTitle'),
      line: tFormat(lang, 'status.inFloodZoneLine', { sev: sevLabel(lang, w.severity), name: w.name, depth: w.depthCm }),
      sub: translate(lang, 'status.inFloodZoneSub'),
      eta: null,
    };
  } else {
    const near = enriched.filter((r) => r.edgeKm <= 2.5).sort((a, b) => a.edgeKm - b.edgeKm);
    if (near.length) {
      const ne = near[0];
      status = {
        tone: 'warn',
        badge: translate(lang, 'status.stayAlert'),
        title: translate(lang, 'status.stayAlertTitle'),
        line: tFormat(lang, 'status.stayAlertLine', {
          km: ne.edgeKm.toFixed(1),
          name: ne.name,
          sev: sevLabel(lang, ne.severity).toLowerCase(),
          rising: ne.trend === 'rising' ? translate(lang, 'status.rising') : '',
        }),
        sub: translate(lang, 'status.stayAlertSub'),
        eta: null,
      };
    } else {
      status = {
        tone: 'ok',
        badge: translate(lang, 'status.clear'),
        title: translate(lang, 'status.clearTitle'),
        line: translate(lang, 'status.clearLine'),
        sub: translate(lang, 'status.clearSub'),
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
      status.eta = tFormat(lang, 'status.etaAtArea', { name: risingNear.name });
    } else {
      const lo = Math.max(1, Math.round(risingNear.edgeKm / 0.98));
      const hi = Math.max(lo + 1, Math.round(risingNear.edgeKm / 0.49));
      status.eta = tFormat(lang, 'status.etaReach', { name: risingNear.name, lo, hi });
    }
  }
  return status;
}
