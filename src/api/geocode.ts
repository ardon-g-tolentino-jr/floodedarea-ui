// Location search via OpenStreetMap's Nominatim geocoder. Free, no API key, and the same
// data source as the map tiles. Nominatim sends `Access-Control-Allow-Origin: *`, so the
// browser can call it directly — this does NOT go through `api`/`API_BASE` (different host).
//
// Usage policy is low-volume (~1 req/s): callers should debounce and keep a short minimum
// query length. See https://operations.osmfoundation.org/policies/nominatim/.

const NOMINATIM_URL = 'https://nominatim.openstreetmap.org/search';
const NOMINATIM_REVERSE_URL = 'https://nominatim.openstreetmap.org/reverse';

export const MIN_QUERY_LENGTH = 3;

// Half-width (in degrees, ≈ 65 km) of the soft viewbox used to bias search toward the caller's
// current location, on top of the countrycodes=ph filter below. `bounded=0` keeps it a
// preference, not a hard limit, within the Philippines.
const NEAR_BIAS_DEG = 0.6;

/** Build a `viewbox` string (lon1,lat1,lon2,lat2, NW → SE) around a bias point. */
function nearViewbox({ lat, lng }: { lat: number; lng: number }): string {
  const w = (lng - NEAR_BIAS_DEG).toFixed(4);
  const n = (lat + NEAR_BIAS_DEG).toFixed(4);
  const e = (lng + NEAR_BIAS_DEG).toFixed(4);
  const s = (lat - NEAR_BIAS_DEG).toFixed(4);
  return `${w},${n},${e},${s}`;
}

export interface GeoResult {
  id: string;
  label: string;
  lat: number;
  lng: number;
}

interface NominatimRow {
  place_id: number | string;
  display_name: string;
  lat: string;
  lon: string;
}

/**
 * Geocode `query` to a handful of Philippines place suggestions (`countrycodes=ph` — the app is
 * PH-only, not worldwide). Pass `near` (typically the user's current location) to softly rank
 * nearby results first; it is only a bias (`bounded=0`), not a hard limit, within the country.
 * Returns `[]` for short queries, network errors, or aborted requests. Pass an `AbortSignal` to
 * cancel a superseded request.
 */
export async function searchPlaces(
  query: string,
  signal?: AbortSignal,
  near?: { lat: number; lng: number }
): Promise<GeoResult[]> {
  const q = query.trim();
  if (q.length < MIN_QUERY_LENGTH) return [];

  const params = new URLSearchParams({
    format: 'jsonv2',
    q,
    limit: '6',
    addressdetails: '0',
    countrycodes: 'ph',
  });
  if (near) {
    params.set('viewbox', nearViewbox(near));
    params.set('bounded', '0'); // prefer nearby, but still resolve places anywhere
  }

  let res: Response;
  try {
    res = await fetch(`${NOMINATIM_URL}?${params.toString()}`, {
      signal,
      headers: { Accept: 'application/json' },
    });
  } catch {
    return []; // network error or aborted
  }

  if (!res.ok) return [];

  const rows = (await res.json()) as NominatimRow[];
  return rows.map((r) => ({
    id: String(r.place_id),
    label: r.display_name,
    lat: Number(r.lat),
    lng: Number(r.lon),
  }));
}

/**
 * Resolve a city/municipality name to its Nominatim bounding box, reordered to the `s,w,n,e`
 * order Overpass's `way(bbox)` filter expects. Used by `overpass.ts` to scope an intersection
 * search instead of relying on an exact OSM administrative-area name match (`area[name="…"]`),
 * which is intolerant of "QC" / "Q.C." / a trailing "City" / minor typos. `countrycodes=ph`
 * keeps this PH-only like the rest of the module. Returns `null` on error/no match — the caller
 * treats that as "city didn't resolve", not a network failure, since a 200 with an empty array is
 * the normal Nominatim response for an unrecognized place name.
 */
export async function geocodeCityBBox(
  city: string,
  signal?: AbortSignal
): Promise<[number, number, number, number] | null> {
  const q = city.trim();
  if (!q) return null;

  const params = new URLSearchParams({
    format: 'jsonv2',
    q,
    limit: '1',
    countrycodes: 'ph',
  });

  let res: Response;
  try {
    res = await fetch(`${NOMINATIM_URL}?${params.toString()}`, {
      signal,
      headers: { Accept: 'application/json' },
    });
  } catch {
    return null; // network error or aborted
  }
  if (!res.ok) return null;

  let rows: { boundingbox?: [string, string, string, string] }[];
  try {
    rows = (await res.json()) as { boundingbox?: [string, string, string, string] }[];
  } catch {
    return null;
  }
  const bb = rows[0]?.boundingbox;
  if (!bb) return null;

  // Nominatim: [south, north, west, east]. Overpass way(bbox): south,west,north,east.
  const [south, north, west, east] = bb.map(Number);
  if ([south, north, west, east].some((n) => Number.isNaN(n))) return null;
  return [south, west, north, east];
}

/** The road a flood pin sits on, plus its district, city, and barangay, resolved from coordinates. */
export interface ReverseResult {
  road: string | null;
  district: string | null;
  city: string | null;
  barangay: string | null;
  label: string | null;
}

interface NominatimAddress {
  road?: string;
  pedestrian?: string;
  footway?: string;
  residential?: string;
  quarter?: string;
  neighbourhood?: string;
  suburb?: string;
  village?: string;
  hamlet?: string;
  town?: string;
  city_district?: string;
  city?: string;
  municipality?: string;
  state?: string;
}

interface NominatimReverseRow {
  display_name?: string;
  address?: NominatimAddress;
  error?: string;
}

/**
 * Reverse-geocode coordinates to the named road they sit on (e.g. "Lilac Street") plus a
 * district label, so a flood pin can be attributed to a specific street. Uses the same Nominatim
 * host as `searchPlaces` (CORS-friendly, no key). Returns nulls on network error/abort/no match —
 * the caller falls back to a generic label.
 */
export async function reverseGeocode(lat: number, lng: number, signal?: AbortSignal): Promise<ReverseResult> {
  const empty: ReverseResult = { road: null, district: null, city: null, barangay: null, label: null };

  const params = new URLSearchParams({
    format: 'jsonv2',
    lat: String(lat),
    lon: String(lng),
    zoom: '17', // street level
    addressdetails: '1',
  });

  let res: Response;
  try {
    res = await fetch(`${NOMINATIM_REVERSE_URL}?${params.toString()}`, {
      signal,
      headers: { Accept: 'application/json' },
    });
  } catch {
    return empty; // network error or aborted
  }

  if (!res.ok) return empty;

  const row = (await res.json()) as NominatimReverseRow;
  if (row.error || !row.address) return empty;
  const a = row.address;

  // Only genuine public streets. We deliberately do NOT fall back to `residential` (a named
  // private subdivision, e.g. "Brescia Homes") or `neighbourhood`, since those can identify
  // someone's home when used as a report's public label. Area context comes from barangay/district.
  const road = a.road ?? a.pedestrian ?? a.footway ?? null;
  const area = a.suburb ?? a.village ?? a.town ?? a.city_district ?? a.city ?? a.municipality ?? null;
  const district = [area, a.state].filter(Boolean).join(', ') || null;
  // PH city/municipality and barangay (the smallest admin unit). Nominatim maps a barangay to
  // one of quarter/neighbourhood/suburb/village/hamlet depending on the place.
  const city = a.city ?? a.town ?? a.municipality ?? a.city_district ?? null;
  const barangay = a.quarter ?? a.neighbourhood ?? a.suburb ?? a.village ?? a.hamlet ?? null;

  return { road, district, city, barangay, label: row.display_name ?? null };
}
