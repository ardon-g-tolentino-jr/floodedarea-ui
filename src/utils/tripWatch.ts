// Trip-stop monitoring: watch several tagged places (a "trip") and match new flood reports against
// them by radius or road name. Client-only — a Trip never touches baha-api (see the note in
// types.ts). Kept separate from viewModel.ts's `enrichReports`, whose distKm/edgeKm are relative to
// a single `userLoc` and are consumed by computeStatus/Sidebar; multi-centre matching needs its own
// pure helper rather than overloading that one.

import type { LatLng, Trip, TripStop } from '../types';
import { kmBetween } from './geo';
import { snapToRoad } from './roadSnap';
import type { EnrichedReport } from './viewModel';

export const TRIP_STORAGE_KEY = 'baha_trip_v1';

export const MAX_STOPS = 8;
export const ROAD_MATCH_CAP_KM = 6;
export const STOP_RADIUS_OPTIONS = [0.5, 1, 2, 3, 5];
export const STOP_RADIUS_DEFAULT = 1;
export const DUPLICATE_STOP_KM = 0.15;
export const ALERT_BURST = 4;

export const EMPTY_TRIP: Trip = { id: '', active: false, stops: [], startedAt: 0 };

export const newStopId = (): string => `s_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
export const newTripId = (): string => `t_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

// ── Persistence ──────────────────────────────────────────────────────────────────

const isFiniteNum = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);
const isLat = (v: unknown): v is number => isFiniteNum(v) && v >= -90 && v <= 90;
const isLng = (v: unknown): v is number => isFiniteNum(v) && v >= -180 && v <= 180;
const clamp = (v: number, lo: number, hi: number): number => Math.min(hi, Math.max(lo, v));
const nearestRadiusOption = (v: number): number =>
  STOP_RADIUS_OPTIONS.reduce((best, opt) => (Math.abs(opt - v) < Math.abs(best - v) ? opt : best), STOP_RADIUS_OPTIONS[0]);

/** Coerce anything (old version, hand-edited, partially-written) into a valid TripStop, or null. */
function sanitizeStop(raw: unknown, seenIds: Set<string>): TripStop | null {
  if (typeof raw !== 'object' || raw === null) return null;
  const r = raw as Record<string, unknown>;
  if (!isLat(r.lat) || !isLng(r.lng)) return null;
  let id = typeof r.id === 'string' && r.id.length > 0 ? r.id : newStopId();
  if (seenIds.has(id)) id = newStopId();
  seenIds.add(id);
  const label = typeof r.label === 'string' ? r.label.slice(0, 80) : '';
  const radiusKm = isFiniteNum(r.radiusKm) ? nearestRadiusOption(clamp(r.radiusKm, STOP_RADIUS_OPTIONS[0], STOP_RADIUS_OPTIONS.at(-1)!)) : STOP_RADIUS_DEFAULT;
  const roadName = typeof r.roadName === 'string' ? r.roadName : null;
  const city = typeof r.city === 'string' ? r.city : null;
  return { id, label, lat: r.lat as number, lng: r.lng as number, radiusKm, roadName, city };
}

/** Pure: coerce anything into a valid Trip. Never throws. */
export function sanitizeTrip(raw: unknown): Trip {
  if (typeof raw !== 'object' || raw === null) return EMPTY_TRIP;
  const r = raw as Record<string, unknown>;
  const seenIds = new Set<string>();
  const stops = Array.isArray(r.stops)
    ? (r.stops.map((s) => sanitizeStop(s, seenIds)).filter((s): s is TripStop => s !== null).slice(0, MAX_STOPS))
    : [];
  const id = typeof r.id === 'string' && r.id.length > 0 ? r.id : newTripId();
  const startedAt = isFiniteNum(r.startedAt) ? r.startedAt : 0;
  const active = stops.length > 0 && r.active === true;
  return { id, active, stops, startedAt };
}

/** localStorage read; tolerates missing/corrupt/quota-blocked storage. */
export function loadTrip(): Trip {
  try {
    const raw = localStorage.getItem(TRIP_STORAGE_KEY);
    return raw ? sanitizeTrip(JSON.parse(raw)) : EMPTY_TRIP;
  } catch {
    return EMPTY_TRIP;
  }
}

// ── Road-name normalization ─────────────────────────────────────────────────────

const SUFFIXES = new Set([
  'street', 'st', 'avenue', 'ave', 'av', 'road', 'rd', 'boulevard', 'blvd', 'highway', 'hwy',
  'drive', 'dr', 'extension', 'ext', 'lane', 'ln', 'circle', 'cir', 'expressway', 'expy',
  'bridge', 'flyover', 'underpass', 'interchange', 'tollway', 'diversion', 'bypass', 'service',
]);

const ROAD_ALIASES: Record<string, string> = {
  edsa: 'edsa',
  'epifanio de los santos': 'edsa',
  'epifanio delos santos': 'edsa',
  'highway 54': 'edsa',
  c5: 'c5', 'c 5': 'c5', 'circumferential 5': 'c5',
  c6: 'c6', 'c 6': 'c6', 'circumferential 6': 'c6',
  slex: 'south luzon expressway',
  nlex: 'north luzon expressway',
  skyway: 'skyway',
  'marcos highway': 'marikina infanta highway',
  'marikina infanta': 'marikina infanta highway',
};

/** After suffix-stripping, these normalized names are too common to trust on distance alone —
 *  matchTripStops requires the stop's city and the report's district to agree before either arm
 *  fires a road match on one of these. */
export const AMBIGUOUS_ROAD_NAMES = new Set([
  'rizal', 'j p rizal', 'jp rizal', 'bonifacio', 'a bonifacio', 'mabini', 'del pilar', 'm h del pilar',
  'burgos', 'p burgos', 'luna', 'general luna', 'quezon', 'm l quezon', 'magsaysay', 'aguinaldo',
  'quirino', 'national', 'national highway', 'main', 'maharlika', 'san jose', 'santo nino', 'malvar',
]);

/** lowercase, strip diacritics/punctuation, collapse whitespace, drop one trailing street-type
 *  token, then run alias lookups both before and after that strip (so "Epifanio de los Santos
 *  Avenue" collapses to "edsa" only once "avenue" is gone). */
export function normalizeRoadName(raw: string | null | undefined): string {
  if (!raw) return '';
  const flat = raw
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[.'’"]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  if (ROAD_ALIASES[flat]) return ROAD_ALIASES[flat];
  const core = flat.split(' ').filter((w) => !SUFFIXES.has(w)).join(' ').trim();
  return ROAD_ALIASES[core] ?? core;
}

const normCity = (city: string | null): string => normalizeRoadName(city);

/** True when `a` and `b` are the same road, guarding against common-name false positives by
 *  requiring matching cities/districts when the normalized name is ambiguous. */
export function sameRoadName(a: string | null, b: string | null, cityA: string | null, cityB: string | null): boolean {
  const na = normalizeRoadName(a);
  const nb = normalizeRoadName(b);
  if (!na || !nb || na.length < 4 || nb.length < 4) return false;
  if (na !== nb) return false;
  if (AMBIGUOUS_ROAD_NAMES.has(na)) {
    const ca = normCity(cityA);
    const cb = normCity(cityB);
    if (!ca || !cb) return false;
    // A shared token (e.g. "marikina" appears in both "marikina" and "marikina city, metro manila")
    const tokensA = new Set(ca.split(' '));
    if (!cb.split(' ').some((t) => tokensA.has(t) && t.length >= 3)) return false;
  }
  return true;
}

/** The canonical road a report sits on: snapped OSM name when the road index is loaded, else the
 *  street prefix of the report's name (built as `${street}, ${barangay}` when reports are posted). */
export function reportRoadName(r: { latitude: number; longitude: number; name: string }): string | null {
  const snapped = snapToRoad(r.latitude, r.longitude);
  if (snapped) return snapped.name;
  const street = r.name.split(',')[0]?.trim();
  return street && street.length > 0 ? street : null;
}

// ── Matching ─────────────────────────────────────────────────────────────────────

export interface StopMatch {
  stopId: string;
  report: EnrichedReport;
  km: number;
  via: 'radius' | 'road';
}

/** Every (stop, report) pair where the report falls inside the stop's radius OR sits on the same
 *  named road, capped at ROAD_MATCH_CAP_KM. At most one StopMatch per pair — radius wins over road. */
export function matchTripStops(reports: EnrichedReport[], stops: TripStop[]): StopMatch[] {
  if (!reports.length || !stops.length) return [];
  const matches: StopMatch[] = [];
  for (const stop of stops) {
    for (const report of reports) {
      const loc: LatLng = { lat: report.latitude, lng: report.longitude };
      const km = kmBetween(stop, loc);
      if (km <= stop.radiusKm) {
        matches.push({ stopId: stop.id, report, km, via: 'radius' });
        continue;
      }
      if (km <= ROAD_MATCH_CAP_KM && stop.roadName) {
        const roadName = reportRoadName(report);
        if (sameRoadName(stop.roadName, roadName, stop.city, report.district)) {
          matches.push({ stopId: stop.id, report, km, via: 'road' });
        }
      }
    }
  }
  return matches;
}

/** Per-stop rollup for the TripPanel badges (✓ clear / ⚠ N reports). */
export function groupStopMatches(matches: StopMatch[]): Map<string, StopMatch[]> {
  const out = new Map<string, StopMatch[]>();
  for (const m of matches) {
    const list = out.get(m.stopId);
    if (list) list.push(m); else out.set(m.stopId, [m]);
  }
  return out;
}
