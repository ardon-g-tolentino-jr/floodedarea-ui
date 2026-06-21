// Location search via OpenStreetMap's Nominatim geocoder. Free, no API key, and the same
// data source as the map tiles. Nominatim sends `Access-Control-Allow-Origin: *`, so the
// browser can call it directly — this does NOT go through `api`/`API_BASE` (different host).
//
// Usage policy is low-volume (~1 req/s): callers should debounce and keep a short minimum
// query length. See https://operations.osmfoundation.org/policies/nominatim/.

const NOMINATIM_URL = 'https://nominatim.openstreetmap.org/search';

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
