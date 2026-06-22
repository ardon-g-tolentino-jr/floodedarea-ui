// Location search via OpenStreetMap's Nominatim geocoder. Free, no API key, and the same
// data source as the map tiles. Nominatim sends `Access-Control-Allow-Origin: *`, so the
// browser can call it directly — this does NOT go through `api`/`API_BASE` (different host).
//
// Usage policy is low-volume (~1 req/s): callers should debounce and keep a short minimum
// query length. See https://operations.osmfoundation.org/policies/nominatim/.

const NOMINATIM_URL = 'https://nominatim.openstreetmap.org/search';
const NOMINATIM_REVERSE_URL = 'https://nominatim.openstreetmap.org/reverse';

// Bias results toward Metro Manila & Rizal: viewbox is lon1,lat1,lon2,lat2 (NW → SE).
const METRO_VIEWBOX = '120.9,14.85,121.5,14.25';

export const MIN_QUERY_LENGTH = 3;

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
 * Geocode `query` to a handful of place suggestions, biased to the monitoring region.
 * Returns `[]` for short queries, network errors, or aborted requests (caller can render
 * an empty dropdown). Pass an `AbortSignal` to cancel a superseded request.
 */
export async function searchPlaces(query: string, signal?: AbortSignal): Promise<GeoResult[]> {
  const q = query.trim();
  if (q.length < MIN_QUERY_LENGTH) return [];

  const params = new URLSearchParams({
    format: 'jsonv2',
    q,
    countrycodes: 'ph',
    viewbox: METRO_VIEWBOX,
    bounded: '0', // prefer the viewbox but still resolve places outside it
    limit: '6',
    addressdetails: '0',
  });

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

  const road = a.road ?? a.pedestrian ?? a.footway ?? a.residential ?? a.neighbourhood ?? null;
  const area = a.suburb ?? a.village ?? a.town ?? a.city_district ?? a.city ?? a.municipality ?? null;
  const district = [area, a.state].filter(Boolean).join(', ') || null;
  // PH city/municipality and barangay (the smallest admin unit). Nominatim maps a barangay to
  // one of quarter/neighbourhood/suburb/village/hamlet depending on the place.
  const city = a.city ?? a.town ?? a.municipality ?? a.city_district ?? null;
  const barangay = a.quarter ?? a.neighbourhood ?? a.suburb ?? a.village ?? a.hamlet ?? null;

  return { road, district, city, barangay, label: row.display_name ?? null };
}
