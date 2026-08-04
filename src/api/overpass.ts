// Street-intersection lookup via the Overpass API (OpenStreetMap). PH flood reports are commonly
// phrased as a crossing ("Aurora Blvd cor. Katipunan Ave"), which Nominatim's place search
// (geocode.ts) can't resolve directly — this finds the actual node where two named roads meet.
//
// Same contract style as geocode.ts: never throws, returns [] on error/abort/no-match. Overpass's
// usage policy asks for restraint, so this is fired only on an explicit "Find intersection"
// button press in the UI — never per keystroke.

const OVERPASS_URL = 'https://overpass-api.de/api/interpreter';

// Rough Philippines bounding box (south, west, north, east) — used ONLY when no city was given
// (see findIntersection below), so the query still stays PH-scoped rather than the whole planet.
const PH_BBOX = '4.5,116.9,21.2,126.6';

export interface Intersection {
  lat: number;
  lng: number;
  label: string;
}

interface OverpassElement {
  type: string;
  id: number;
  lat?: number;
  lon?: number;
}

interface OverpassResponse {
  elements?: OverpassElement[];
}

/**
 * Escape regex metacharacters (`. * + ? ( ) [ ] { } ^ $ | \`) so a street name is matched
 * literally by Overpass's substring regex (`name~"...",i`) instead of as a pattern. Real PH
 * street names routinely contain these — "C-5 Rd (Katipunan)", "A. Bonifacio Ave.", "EDSA /
 * Guadalupe" — and an unbalanced `(` makes the whole query invalid (Overpass 400s → `[]`).
 * MUST run before `escapeForQuery` below, since the backslashes it introduces then need their
 * own escaping to survive inside the quoted string.
 */
function escapeRegexMeta(s: string): string {
  return s.replace(/[.*+?()[\]{}^$|\\]/g, '\\$&');
}

/** Escape quotes/backslashes so a value can't break out of the quoted string in an Overpass QL
 *  query. Used on its own for an exact-match value (e.g. `city`); a regex pattern must be passed
 *  through `escapeRegexMeta` first (see `streetPattern`). */
function escapeForQuery(s: string): string {
  return s.replace(/[\\"]/g, '\\$&');
}

/** A street name prepared for `name~"...",i` — regex-escaped (literal match) then string-escaped.
 *  Keeps substring behaviour (no anchoring): "Aurora" still matches "Aurora Boulevard". */
function streetPattern(s: string): string {
  return escapeForQuery(escapeRegexMeta(s));
}

function cityQuery(a: string, b: string, city: string): string {
  return `[out:json][timeout:25];
area[name="${escapeForQuery(city)}"][boundary=administrative]->.a;
way(area.a)[highway][name~"${streetPattern(a)}",i]->.w1;
way(area.a)[highway][name~"${streetPattern(b)}",i]->.w2;
node(w.w1)(w.w2);
out center 5;`;
}

// Scans every highway in the Philippines, so it's inherently heavy — common street names
// ("Rizal", "Bonifacio") can approach Overpass's timeout/rate limit. A longer timeout and a
// harder result cap (both in the query and in runQuery's slice) keep it from being the default
// second attempt on every miss; see findIntersection for when this actually runs.
function bboxQuery(a: string, b: string): string {
  return `[out:json][timeout:40];
way(${PH_BBOX})[highway][name~"${streetPattern(a)}",i]->.w1;
way(${PH_BBOX})[highway][name~"${streetPattern(b)}",i]->.w2;
node(w.w1)(w.w2);
out center 3;`;
}

async function runQuery(query: string, label: string, signal?: AbortSignal, maxResults = 5): Promise<Intersection[]> {
  let res: Response;
  try {
    res = await fetch(OVERPASS_URL, {
      method: 'POST',
      body: `data=${encodeURIComponent(query)}`,
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      signal,
    });
  } catch {
    return []; // network error or aborted
  }
  if (!res.ok) return [];

  let data: OverpassResponse;
  try {
    data = (await res.json()) as OverpassResponse;
  } catch {
    return [];
  }

  return (data.elements ?? [])
    .filter((el): el is OverpassElement & { lat: number; lon: number } => el.type === 'node' && typeof el.lat === 'number' && typeof el.lon === 'number')
    .slice(0, maxResults)
    .map((n) => ({ lat: n.lat, lng: n.lon, label }));
}

/**
 * Find up to 5 candidate crossings of street `a` and street `b`. When `city` is given (an
 * administrative area name Overpass can resolve, e.g. "Quezon City"), the search is scoped to it
 * and that's the only attempt — if it yields nothing, the city name is the thing to fix, and a
 * nationwide guess would be misleading, so this returns `[]` rather than falling back. Only when
 * NO city is given does it fall back to a rough Philippines bounding box (capped to 3 results,
 * longer timeout — scanning every highway in the country is expensive). Never throws — returns
 * `[]` on error/abort/no match.
 */
export async function findIntersection(
  a: string,
  b: string,
  city: string,
  signal?: AbortSignal
): Promise<Intersection[]> {
  const streetA = a.trim();
  const streetB = b.trim();
  const cityName = city.trim();
  if (!streetA || !streetB) return [];

  const label = `${streetA} cor. ${streetB}${cityName ? `, ${cityName}` : ''}`;

  try {
    if (cityName) {
      return await runQuery(cityQuery(streetA, streetB, cityName), label, signal);
    }
    return await runQuery(bboxQuery(streetA, streetB), label, signal, 3);
  } catch {
    return [];
  }
}
