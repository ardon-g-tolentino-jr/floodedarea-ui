// Derived view model for the flood map + sidebar, ported from the design's renderVals().
// Pure functions over the live API data + the user's location.

import type { FloodReport, LatLng, Severity } from '../types';
import { kmBetween } from './geo';
import { SEV_META, type SevMeta } from './floodMeta';
import { timeAgo } from './format';

export const REPORT_RADIUS_KM = 0.3; // default affected radius drawn around each report (300 m)
export const REPORT_RADIUS_MIN = 0.2; // 200 m
export const REPORT_RADIUS_MAX = 1; // 1 km
export const REPORT_RADIUS_STEP = 0.1; // 100 m
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
  reportRadiusKm: number = REPORT_RADIUS_KM,
  now: number = Date.now()
): EnrichedReport[] {
  return reports.map((r) => {
    const distKm = kmBetween(userLoc, { lat: r.latitude, lng: r.longitude });
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
      edgeKm: distKm - reportRadiusKm,
      time: timeAgo(r.createdAt),
      mine: authUserId != null && r.reporterUserId === authUserId,
      ageMin,
      expiresInMin,
      expired: r.status === 'resolved' || expiresInMin <= 0,
    };
  });
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
