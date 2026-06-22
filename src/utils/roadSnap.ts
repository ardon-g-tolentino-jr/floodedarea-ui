import type { LatLng } from '../types';

// Snaps a flood-report coordinate to the real road it sits on, using a bundled OSM road dataset
// (public/roads.json — major roads for the monitoring region). Pure + side-effect-free aside from
// the one-time in-memory index built by `loadRoads`. No network, no external service.

/** Compact roads asset shape (public/roads.json). Coordinates are [lng, lat], 5-decimal. */
interface RawRoad { i: number; n: string; h: string; c: [number, number][] }
export interface RoadsAsset { generated?: string; bbox?: [number, number, number, number]; roads: RawRoad[] }

export interface SnappedRoad {
  roadId: number;
  name: string;
  highway: string;
  /** The affected stretch of the road, clipped to ~±STRETCH_M around the pin. */
  path: LatLng[];
}

const SNAP_MAX_M = 40; // a pin farther than this from any road doesn't snap (caller falls back)
const STRETCH_M = 120; // half-length of the highlighted stretch around the snap point
const CELL_DEG = 0.01; // spatial-index cell (~1.1 km)
const M_PER_DEG_LAT = 111320;

const mPerDegLng = (lat: number): number => M_PER_DEG_LAT * Math.cos((lat * Math.PI) / 180);
const cellKey = (lat: number, lng: number): string => `${Math.floor(lat / CELL_DEG)}:${Math.floor(lng / CELL_DEG)}`;

interface Road { name: string; highway: string; pts: LatLng[]; cum: number[] }
interface Seg { roadId: number; k: number }

let roads: Map<number, Road> | null = null;
let grid: Map<string, Seg[]> | null = null;

function meters(a: LatLng, b: LatLng, lat0: number): number {
  const dx = (b.lng - a.lng) * mPerDegLng(lat0);
  const dy = (b.lat - a.lat) * M_PER_DEG_LAT;
  return Math.hypot(dx, dy);
}

/** Project q onto segment a–b (local planar, meters). Returns the distance and the fraction t∈[0,1]. */
function project(q: LatLng, a: LatLng, b: LatLng, lat0: number): { dist: number; t: number } {
  const mLng = mPerDegLng(lat0);
  const ax = (a.lng - q.lng) * mLng, ay = (a.lat - q.lat) * M_PER_DEG_LAT;
  const bx = (b.lng - q.lng) * mLng, by = (b.lat - q.lat) * M_PER_DEG_LAT;
  const dx = bx - ax, dy = by - ay;
  const len2 = dx * dx + dy * dy;
  let t = len2 ? -(ax * dx + ay * dy) / len2 : 0;
  t = Math.max(0, Math.min(1, t));
  return { dist: Math.hypot(ax + t * dx, ay + t * dy), t };
}

/** Parse the asset into the in-memory road table + grid index. Idempotent; replaces any prior load. */
export function loadRoads(asset: RoadsAsset): void {
  const r = new Map<number, Road>();
  const g = new Map<string, Seg[]>();
  for (const raw of asset.roads) {
    if (!raw.c || raw.c.length < 2) continue;
    const pts: LatLng[] = raw.c.map(([lng, lat]) => ({ lat, lng }));
    const cum = [0];
    for (let k = 0; k < pts.length - 1; k++) cum.push(cum[k] + meters(pts[k], pts[k + 1], pts[k].lat));
    r.set(raw.i, { name: raw.n, highway: raw.h, pts, cum });
    // Register each segment in every grid cell it passes through (sampled finely vs cell size), so
    // even a long straight segment is found from a cell that has none of its vertices.
    for (let k = 0; k < pts.length - 1; k++) {
      const a = pts[k], b = pts[k + 1];
      const steps = Math.max(1, Math.ceil(meters(a, b, a.lat) / (CELL_DEG * M_PER_DEG_LAT * 0.5)));
      const cells = new Set<string>();
      for (let s = 0; s <= steps; s++) {
        const tt = s / steps;
        cells.add(cellKey(a.lat + (b.lat - a.lat) * tt, a.lng + (b.lng - a.lng) * tt));
      }
      const seg: Seg = { roadId: raw.i, k };
      for (const c of cells) { const bucket = g.get(c); if (bucket) bucket.push(seg); else g.set(c, [seg]); }
    }
  }
  roads = r;
  grid = g;
}

export function roadsLoaded(): boolean { return roads !== null; }

/** The lat/lng at arc-length L (meters) along a road, clamped to its ends. */
function pointAt(road: Road, L: number): LatLng {
  const { pts, cum } = road;
  const clamped = Math.max(0, Math.min(cum[cum.length - 1], L));
  let k = 0;
  while (k < cum.length - 2 && cum[k + 1] < clamped) k++;
  const segLen = cum[k + 1] - cum[k];
  const t = segLen ? (clamped - cum[k]) / segLen : 0;
  const a = pts[k], b = pts[k + 1];
  return { lat: a.lat + (b.lat - a.lat) * t, lng: a.lng + (b.lng - a.lng) * t };
}

/**
 * Snap a coordinate to the nearest bundled road within SNAP_MAX_M, returning the road's identity
 * and the affected stretch (±STRETCH_M of real geometry around the pin). Returns null when no road
 * is close enough — the caller then keeps its name-based fallback.
 */
export function snapToRoad(lat: number, lng: number): SnappedRoad | null {
  if (!roads || !grid) return null;
  const q: LatLng = { lat, lng };
  const baseLat = Math.floor(lat / CELL_DEG), baseLng = Math.floor(lng / CELL_DEG);
  let best: { roadId: number; k: number; dist: number } | null = null;
  const seen = new Set<Seg>();
  for (let dy = -1; dy <= 1; dy++) {
    for (let dx = -1; dx <= 1; dx++) {
      const bucket = grid.get(`${baseLat + dy}:${baseLng + dx}`);
      if (!bucket) continue;
      for (const seg of bucket) {
        if (seen.has(seg)) continue;
        seen.add(seg);
        const road = roads.get(seg.roadId);
        if (!road) continue;
        const { dist } = project(q, road.pts[seg.k], road.pts[seg.k + 1], lat);
        if (!best || dist < best.dist) best = { roadId: seg.roadId, k: seg.k, dist };
      }
    }
  }
  if (!best || best.dist > SNAP_MAX_M) return null;

  const road = roads.get(best.roadId)!;
  const { t } = project(q, road.pts[best.k], road.pts[best.k + 1], lat);
  const s0 = road.cum[best.k] + t * (road.cum[best.k + 1] - road.cum[best.k]);
  const lo = s0 - STRETCH_M, hi = s0 + STRETCH_M;
  const path: LatLng[] = [pointAt(road, lo)];
  for (let i = 0; i < road.pts.length; i++) {
    if (road.cum[i] > lo && road.cum[i] < hi) path.push(road.pts[i]);
  }
  path.push(pointAt(road, hi));
  return { roadId: best.roadId, name: road.name, highway: road.highway, path };
}

export interface NearbyRoad {
  roadId: number;
  name: string;
  highway: string;
  nearestM: number; // the road's closest approach to the query point (metres)
  path: LatLng[];   // the road's geometry clipped to the circle
}

const lerp = (a: LatLng, b: LatLng, t: number): LatLng => ({ lat: a.lat + (b.lat - a.lat) * t, lng: a.lng + (b.lng - a.lng) * t });

/**
 * Every road whose geometry comes within `radiusKm` of (lat,lng), each with its closest approach and
 * geometry clipped to the circle. Powers area-based closure inference (a flood's affected ring covers
 * many roads, not just the one the pin sits on). Reuses the same grid index + projection as snapToRoad.
 */
export function roadsWithinRadius(lat: number, lng: number, radiusKm: number): NearbyRoad[] {
  if (!roads || !grid || radiusKm <= 0) return [];
  const center: LatLng = { lat, lng };
  const radiusM = radiusKm * 1000;
  const dLat = radiusM / M_PER_DEG_LAT, dLng = radiusM / mPerDegLng(lat);
  const latLo = Math.floor((lat - dLat) / CELL_DEG), latHi = Math.floor((lat + dLat) / CELL_DEG);
  const lngLo = Math.floor((lng - dLng) / CELL_DEG), lngHi = Math.floor((lng + dLng) / CELL_DEG);

  const nearest = new Map<number, number>();
  const seen = new Set<Seg>();
  for (let cy = latLo; cy <= latHi; cy++) {
    for (let cx = lngLo; cx <= lngHi; cx++) {
      const bucket = grid.get(`${cy}:${cx}`);
      if (!bucket) continue;
      for (const seg of bucket) {
        if (seen.has(seg)) continue;
        seen.add(seg);
        const road = roads.get(seg.roadId);
        if (!road) continue;
        const { dist } = project(center, road.pts[seg.k], road.pts[seg.k + 1], lat);
        const cur = nearest.get(seg.roadId);
        if (cur === undefined || dist < cur) nearest.set(seg.roadId, dist);
      }
    }
  }

  const out: NearbyRoad[] = [];
  for (const [roadId, nearestM] of nearest) {
    if (nearestM > radiusM) continue;
    const road = roads.get(roadId)!;
    out.push({ roadId, name: road.name, highway: road.highway, nearestM, path: clipToCircle(road, center, radiusM, lat) });
  }
  return out;
}

/** The contiguous stretch of a road within `radiusM` of `center`, through the road's closest point. */
function clipToCircle(road: Road, center: LatLng, radiusM: number, lat0: number): LatLng[] {
  const { pts } = road;
  let bestK = 0, bestT = 0, bestD = Infinity;
  for (let k = 0; k < pts.length - 1; k++) {
    const { dist, t } = project(center, pts[k], pts[k + 1], lat0);
    if (dist < bestD) { bestD = dist; bestK = k; bestT = t; }
  }
  const np = lerp(pts[bestK], pts[bestK + 1], bestT);
  const within = (p: LatLng): boolean => meters(center, p, lat0) <= radiusM;
  const cross = (inside: LatLng, outside: LatLng): LatLng => {
    const dIn = meters(center, inside, lat0), dOut = meters(center, outside, lat0);
    const t = dOut === dIn ? 0 : Math.max(0, Math.min(1, (radiusM - dIn) / (dOut - dIn)));
    return lerp(inside, outside, t);
  };
  const fwd: LatLng[] = [];
  let prev = np;
  for (let i = bestK + 1; i < pts.length; i++) {
    if (within(pts[i])) { fwd.push(pts[i]); prev = pts[i]; } else { fwd.push(cross(prev, pts[i])); break; }
  }
  const bwd: LatLng[] = [];
  prev = np;
  for (let i = bestK; i >= 0; i--) {
    if (within(pts[i])) { bwd.push(pts[i]); prev = pts[i]; } else { bwd.push(cross(prev, pts[i])); break; }
  }
  return [...bwd.reverse(), np, ...fwd];
}
