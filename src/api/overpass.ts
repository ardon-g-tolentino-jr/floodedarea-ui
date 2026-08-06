// Street-intersection lookup via the Overpass API (OpenStreetMap). PH flood reports are commonly
// phrased as a crossing ("Aurora Blvd cor. Katipunan Ave"), which Nominatim's place search
// (geocode.ts) can't resolve directly — this finds the actual node where two named roads meet.
//
// Overpass's usage policy asks for restraint, so this is fired only on an explicit "Find
// intersection" button press in the UI — never per keystroke. Unlike geocode.ts, this module does
// NOT collapse every failure into an empty result: `overpass-api.de` was observed failing 5 of 6
// attempts with a 504 "server is probably too busy" and once with a 429, with successful runs
// taking 7–11 s. Reporting that to the admin as "no crossing found" is actively misleading (it
// reads as their typo), so `findIntersection` returns an `IntersectionOutcome` that keeps "the
// service is busy" distinct from "the city didn't resolve" distinct from "genuinely no match".

import { geocodeCityBBox } from './geocode';

// Endpoints tried in order on a 'busy' outcome, before giving up. Both mirrors were unreachable
// from the network this was verified on (connect timeout) — they're kept as best-effort extra
// chances for admins on a different network path, not as the actual fix (that's the retry+backoff
// below). The primary is confirmed CORS-open (`Access-Control-Allow-Origin: *`).
const OVERPASS_ENDPOINTS = [
  'https://overpass-api.de/api/interpreter',
  'https://overpass.kumi.systems/api/interpreter',
  'https://overpass.private.coffee/api/interpreter',
];

// Per-request timeout for a single endpoint attempt. Short enough that a dead mirror can't hang
// the "Find intersection" button; long enough for the primary's observed 7–11 s successful runs.
const REQUEST_TIMEOUT_MS = 20_000;

// Retry policy for a 'busy' outcome on a given endpoint: measured success rate on a single shot
// was ~1 in 6, so a couple of retries with backoff moves that to a usable place without hammering
// an already-overloaded server.
const RETRY_DELAYS_MS = [1500, 4000];

// Rough Philippines bounding box (south, west, north, east) — used ONLY when no city was given
// (see findIntersection below), so the query still stays PH-scoped rather than the whole planet.
const PH_BBOX = '4.5,116.9,21.2,126.6';

export interface Intersection {
  lat: number;
  lng: number;
  label: string;
}

/**
 * The four real outcomes of an intersection search, kept distinct so the UI never mislabels an
 * upstream hiccup as the admin's own typo:
 *  - `ok`      — the query ran and found at least one crossing.
 *  - `none`    — the query ran cleanly and genuinely found nothing; "check the spelling" is fair.
 *  - `unknown-city` — the typed city didn't resolve to a Nominatim bounding box; "check the city
 *    spelling" is fair here too, but it's a different fix than the street names.
 *  - `busy`    — every endpoint/retry came back 429/5xx/timeout/network-error/malformed body.
 *    This is Overpass's fault, not the admin's; never render "no crossing found" for it.
 *  - `aborted` — the caller's signal fired (superseded search / modal closed). Silent, no message.
 */
export type IntersectionOutcome =
  | { status: 'ok'; points: Intersection[] }
  | { status: 'none' }
  | { status: 'unknown-city'; city: string }
  | { status: 'busy' }
  | { status: 'aborted' };

interface OverpassElement {
  type: string;
  id: number;
  lat?: number;
  lon?: number;
}

interface OverpassResponse {
  elements?: OverpassElement[];
  remark?: string;
}

/**
 * Escape regex metacharacters (`. * + ? ( ) [ ] { } ^ $ | \`) so a street name is matched
 * literally by Overpass's substring regex (`name~"...",i`) instead of as a pattern. Real PH
 * street names routinely contain these — "C-5 Rd (Katipunan)", "A. Bonifacio Ave.", "EDSA /
 * Guadalupe" — and an unbalanced `(` makes the whole query invalid (Overpass 400s → busy-ish
 * failure). MUST run before `escapeForQuery` below, since the backslashes it introduces then need
 * their own escaping to survive inside the quoted string.
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

/**
 * Street-type words and the abbreviations admins actually type, as alternation groups. OSM stores
 * the expanded form ("Aurora Boulevard", "Katipunan Avenue") but PH reports — and this modal's own
 * placeholder text, "e.g. Aurora Blvd" — use the short form. Verified against Overpass: a substring
 * search for `Aurora Blvd` matched ZERO ways in the Quezon City bbox, while `Aurora` matched
 * "Aurora Boulevard". Without this expansion the finder reports "no crossing found" for correctly
 * spelled input, which is the same misleading-error class the outcome type above exists to kill.
 */
const STREET_TYPE_ALIASES: string[][] = [
  ['ave', 'avenue'],
  ['blvd', 'boulevard'],
  ['st', 'street'],
  ['rd', 'road'],
  ['hwy', 'highway'],
  ['dr', 'drive'],
  ['ext', 'extension'],
  ['hts', 'heights'],
  ['pkwy', 'parkway'],
];

// Joins the tokens of a street name. Tolerates whatever punctuation OSM uses between words, so
// "St Mary" still matches "St. Mary" and "C 5" matches "C-5". Inserted raw (it IS regex), so it
// must never be passed through escapeRegexMeta.
const TOKEN_SEPARATOR = '[^A-Za-z0-9]+';

/**
 * A street name prepared for `name~"...",i` — each token regex-escaped (literal match) then
 * string-escaped, with recognised street-type words swapped for an `(abbrev|expanded)` alternation
 * and the tokens rejoined by `TOKEN_SEPARATOR`. Keeps substring behaviour (no anchoring): "Aurora"
 * still matches "Aurora Boulevard".
 */
function streetPattern(s: string): string {
  const tokens = s.trim().split(/\s+/).filter(Boolean);
  return tokens
    .map((raw) => {
      // Strip trailing punctuation ("Ave." → "ave") purely for the alias lookup.
      const key = raw.replace(/[^A-Za-z0-9]+$/, '').toLowerCase();
      const group = STREET_TYPE_ALIASES.find((g) => g.includes(key));
      if (group) return `(${group.join('|')})`;
      return escapeForQuery(escapeRegexMeta(raw));
    })
    .join(TOKEN_SEPARATOR);
}

// Scans every highway inside a bounding box, so a nationwide-sized box is inherently heavy —
// common street names ("Rizal", "Bonifacio") can approach Overpass's timeout/rate limit. A longer
// timeout and a harder result cap (both in the query and in runQuery's slice) keep it from being
// expensive on every call; see findIntersection for when a wide box is actually used.
function bboxQuery(a: string, b: string, bbox: string, limit: number): string {
  return `[out:json][timeout:40];
way(${bbox})[highway][name~"${streetPattern(a)}",i]->.w1;
way(${bbox})[highway][name~"${streetPattern(b)}",i]->.w2;
node(w.w1)(w.w2);
out center ${limit};`;
}

/** `true` if the elements array has at least one node with usable coordinates — used to tell a
 *  genuine "ran fine, nothing found" apart from a malformed/busy response. */
function hasUsableElements(data: OverpassResponse): boolean {
  return (data.elements ?? []).some((el) => el.type === 'node' && typeof el.lat === 'number' && typeof el.lon === 'number');
}

function toIntersections(data: OverpassResponse, label: string, maxResults: number): Intersection[] {
  return (data.elements ?? [])
    .filter((el): el is OverpassElement & { lat: number; lon: number } => el.type === 'node' && typeof el.lat === 'number' && typeof el.lon === 'number')
    .slice(0, maxResults)
    .map((n) => ({ lat: n.lat, lng: n.lon, label }));
}

type QueryResult = { kind: 'ok'; data: OverpassResponse } | { kind: 'busy' } | { kind: 'aborted' };

/** Combine the caller's signal with a per-request timeout, so a single dead endpoint can't hang
 *  the button even if the caller never aborts. Returns the signal plus a `done()` the caller must
 *  invoke to clear the timer.
 *
 *  `AbortSignal.any`/`AbortSignal.timeout` are only Chrome 116+ / Safari 17.4+ / Firefox 124+.
 *  Without a fallback, an admin on an older browser would see EVERY search fail as 'busy' —
 *  exactly the misleading-error class this whole module exists to remove — so this hand-rolls the
 *  same behaviour on a plain AbortController when they're missing. */
function withTimeout(signal: AbortSignal | undefined, ms: number): { signal: AbortSignal; done: () => void } {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), ms);
  const forward = (): void => ctrl.abort();
  if (signal) {
    if (signal.aborted) ctrl.abort();
    else signal.addEventListener('abort', forward, { once: true });
  }
  return {
    signal: ctrl.signal,
    done: () => {
      clearTimeout(timer);
      signal?.removeEventListener('abort', forward);
    },
  };
}

/** One attempt against one endpoint. Never throws — collapses network errors, non-2xx status,
 *  malformed JSON, and Overpass's "200 OK with an HTML/remark error body" cases into `'busy'`,
 *  since none of those are the admin's fault. `'aborted'` is kept separate so callers can stop
 *  retrying/trying-mirrors immediately instead of burning the retry budget on a closed modal. */
async function attempt(url: string, query: string, signal: AbortSignal | undefined): Promise<QueryResult> {
  const combined = withTimeout(signal, REQUEST_TIMEOUT_MS);
  let res: Response;
  try {
    res = await fetch(url, {
      method: 'POST',
      body: `data=${encodeURIComponent(query)}`,
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      signal: combined.signal,
    });
  } catch {
    combined.done();
    if (signal?.aborted) return { kind: 'aborted' };
    // Includes AbortError from our own timeout — that's a dead/slow endpoint, treat as busy.
    return { kind: 'busy' };
  }
  if (signal?.aborted) { combined.done(); return { kind: 'aborted' }; }
  if (res.status === 429 || (res.status >= 500 && res.status < 600)) { combined.done(); return { kind: 'busy' }; }
  if (!res.ok) { combined.done(); return { kind: 'busy' }; }

  let data: OverpassResponse;
  try {
    data = (await res.json()) as OverpassResponse;
  } catch {
    return { kind: 'busy' }; // Overpass sometimes returns 200 with an HTML error body.
  } finally {
    combined.done();
  }
  const remark = (data.remark ?? '').toLowerCase();
  if (remark.includes('timed out') || remark.includes('too busy') || remark.includes('rate_limited')) {
    return { kind: 'busy' };
  }
  return { kind: 'ok', data };
}

function sleep(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve) => {
    const t = setTimeout(resolve, ms);
    signal?.addEventListener('abort', () => { clearTimeout(t); resolve(); }, { once: true });
  });
}

/**
 * Run `query` against the mirror list, retrying each endpoint on `'busy'` with backoff before
 * moving to the next mirror. Returns the outcome (never throws). `'aborted'` short-circuits
 * immediately — no point spending the retry budget once the caller has moved on.
 */
async function runQuery(query: string, label: string, signal?: AbortSignal, maxResults = 5): Promise<IntersectionOutcome> {
  for (const url of OVERPASS_ENDPOINTS) {
    // First try, then up to RETRY_DELAYS_MS.length retries against this same endpoint.
    for (let i = 0; i <= RETRY_DELAYS_MS.length; i++) {
      if (signal?.aborted) return { status: 'aborted' };
      const result = await attempt(url, query, signal);
      if (result.kind === 'aborted') return { status: 'aborted' };
      if (result.kind === 'ok') {
        return hasUsableElements(result.data)
          ? { status: 'ok', points: toIntersections(result.data, label, maxResults) }
          : { status: 'none' };
      }
      // 'busy' — back off and retry this endpoint, unless we've used up its retries.
      if (i < RETRY_DELAYS_MS.length) {
        await sleep(RETRY_DELAYS_MS[i], signal);
        if (signal?.aborted) return { status: 'aborted' };
      }
    }
    // Exhausted retries on this endpoint — fall through to the next mirror.
  }
  return { status: 'busy' };
}

/**
 * Find up to 5 candidate crossings of street `a` and street `b`. When `city` is given, it's
 * resolved via Nominatim (`geocodeCityBBox`) to a bounding box rather than matched against an
 * exact OSM administrative-area name — this tolerates "QC" / "Q.C." / a trailing "City" / minor
 * typos the way Nominatim's fuzzy search does, and keeps the query index-backed via `bboxQuery`
 * instead of Overpass's heavier `area[name=...]` lookup. If the city can't be resolved at all,
 * that's reported as `unknown-city` — a nationwide guess would be misleading, so this does not
 * silently fall back to PH-wide in that case. Only when NO city is given does it fall back to a
 * rough Philippines bounding box (capped to 3 results, longer timeout — scanning every highway in
 * the country is expensive). Never throws.
 */
export async function findIntersection(
  a: string,
  b: string,
  city: string,
  signal?: AbortSignal
): Promise<IntersectionOutcome> {
  const streetA = a.trim();
  const streetB = b.trim();
  const cityName = city.trim();
  if (!streetA || !streetB) return { status: 'none' };

  const label = `${streetA} cor. ${streetB}${cityName ? `, ${cityName}` : ''}`;

  try {
    if (cityName) {
      const bboxArr = await geocodeCityBBox(cityName, signal);
      if (signal?.aborted) return { status: 'aborted' };
      if (!bboxArr) return { status: 'unknown-city', city: cityName };
      const bbox = bboxArr.join(',');
      return await runQuery(bboxQuery(streetA, streetB, bbox, 5), label, signal, 5);
    }
    return await runQuery(bboxQuery(streetA, streetB, PH_BBOX, 3), label, signal, 3);
  } catch {
    return signal?.aborted ? { status: 'aborted' } : { status: 'busy' };
  }
}
