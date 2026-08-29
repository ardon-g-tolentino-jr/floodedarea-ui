// Device-local extras layered over the bundled hotspot catalog: pins an admin has nudged, and
// hotspots they added themselves. Everything here lives in localStorage on ONE admin's browser —
// nothing is sent to baha-api, so a second admin sees the bundled list only. That's the deliberate
// trade for shipping this without a backend table; the Quick report page says so on screen.

import { FLOOD_HOTSPOTS, type FloodHotspot } from '../data/floodHotspots';

const STORAGE_KEY = 'baha_hotspots_v1';
/** Prefix marking a hotspot as admin-added rather than bundled — the only thing removable. */
export const CUSTOM_ID_PREFIX = 'custom-';

interface StoredState {
  /** Hotspots this admin added. Ids always start with CUSTOM_ID_PREFIX. */
  custom: FloodHotspot[];
  /** Nudged pins, keyed by hotspot id — applies to bundled and custom rows alike. */
  pins: Record<string, { lat: number; lng: number }>;
}

const EMPTY: StoredState = { custom: [], pins: {} };

/** Read the stored state, tolerating absent/corrupt/partial JSON — same idiom as the other
 *  localStorage prefs in this app (see loadSocialAutopostPref in AdminReportIncidentModal). */
function read(): StoredState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return EMPTY;
    const parsed = JSON.parse(raw) as Partial<StoredState>;
    return {
      custom: Array.isArray(parsed.custom) ? parsed.custom : [],
      pins: parsed.pins && typeof parsed.pins === 'object' ? parsed.pins : {},
    };
  } catch {
    return EMPTY;
  }
}

function write(s: StoredState): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(s));
  } catch {
    /* private mode / quota — the page still works for this session, it just won't persist */
  }
}

/**
 * The full hotspot list to show: bundled catalog first (its curated tier/frequency ranking is the
 * point), then this admin's own additions, with any nudged pin applied on top. Pure read — call it
 * from a useState initialiser and re-call after any mutation below.
 */
export function loadHotspots(): FloodHotspot[] {
  const { custom, pins } = read();
  return [...FLOOD_HOTSPOTS, ...custom].map((h) => {
    const pin = pins[h.id];
    return pin ? { ...h, lat: pin.lat, lng: pin.lng } : h;
  });
}

/** Move one hotspot's pin. Works for bundled rows too — the override is stored, never the catalog. */
export function setPin(id: string, lat: number, lng: number): void {
  const s = read();
  write({ ...s, pins: { ...s.pins, [id]: { lat, lng } } });
}

/** Drop a nudge, restoring the bundled coordinates. No-op for a custom row (nothing to fall back to). */
export function clearPin(id: string): void {
  const s = read();
  if (!(id in s.pins)) return;
  const pins = { ...s.pins };
  delete pins[id];
  write({ ...s, pins });
}

/** True when this row's pin has been moved from where the catalog put it. */
export function hasPinOverride(id: string): boolean {
  return id in read().pins;
}

/** Add an admin's own hotspot. Returns the row as stored (with its minted id). */
export function addCustomHotspot(h: Omit<FloodHotspot, 'id'>): FloodHotspot {
  const s = read();
  const row: FloodHotspot = { ...h, id: `${CUSTOM_ID_PREFIX}${Date.now().toString(36)}` };
  write({ ...s, custom: [...s.custom, row] });
  return row;
}

/** Remove an admin-added hotspot and any pin nudge it carried. Bundled rows are never removable. */
export function removeCustomHotspot(id: string): void {
  if (!isCustom(id)) return;
  const s = read();
  const pins = { ...s.pins };
  delete pins[id];
  write({ custom: s.custom.filter((h) => h.id !== id), pins });
}

export const isCustom = (id: string): boolean => id.startsWith(CUSTOM_ID_PREFIX);
