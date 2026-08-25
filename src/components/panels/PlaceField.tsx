import React from 'react';
import { MIN_QUERY_LENGTH, searchPlaces, type GeoResult } from '../../api/geocode';
import { locateWithAccuracy } from '../../utils/geolocate';
import PlaceSuggestion from './PlaceSuggestion';

const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '9px 11px',
  border: '1px solid var(--bw-line)',
  borderRadius: 9,
  fontSize: 13,
  color: 'var(--bw-ink)',
  background: 'var(--bw-surface)',
  boxSizing: 'border-box',
};

/**
 * Location picker for admin records: the admin searches a place (Nominatim, same geocoder as the
 * TopBar search) or uses their current location, and we derive the coordinates from the pick — no
 * manual lat/lng. Shared by the Admin console forms and the "Report incident" modal.
 */
const PlaceField: React.FC<{
  lat: string;
  lng: string;
  placeLabel: string;
  /** `ctx` carries the picked result's split primary/context (search picks only — a "Current
   *  location" pick and any caller ignoring the arg both stay compatible). */
  onPick: (lat: number, lng: number, label: string, ctx?: { primary: string; context: string }) => void;
  /** Overrides the search input's placeholder — lets bilingual callers (e.g. AddStopSheet) localize it. */
  placeholder?: string;
  /** Overrides the "Current" button label. */
  currentLabel?: string;
  /** User's current location — softly biases search results toward nearby places, same as SearchBox. */
  near?: { lat: number; lng: number };
}> = ({ lat, lng, placeLabel, onPick, placeholder, currentLabel, near }) => {
  const [query, setQuery] = React.useState('');
  const [results, setResults] = React.useState<GeoResult[]>([]);
  const [open, setOpen] = React.useState(false);
  const [loading, setLoading] = React.useState(false);
  const abortRef = React.useRef<AbortController | null>(null);

  React.useEffect(() => {
    const q = query.trim();
    if (q.length < MIN_QUERY_LENGTH) {
      setResults([]);
      setLoading(false);
      abortRef.current?.abort();
      return;
    }
    setLoading(true);
    const timer = window.setTimeout(async () => {
      abortRef.current?.abort();
      const ac = new AbortController();
      abortRef.current = ac;
      const found = await searchPlaces(q, ac.signal, near);
      if (ac.signal.aborted) return;
      setResults(found);
      setLoading(false);
      setOpen(true);
    }, 350);
    return () => window.clearTimeout(timer);
  }, [query]);

  const [locating, setLocating] = React.useState(false);
  const [geoError, setGeoError] = React.useState<string | null>(null);

  const choose = (r: GeoResult): void => {
    onPick(r.lat, r.lng, r.label, { primary: r.primary, context: r.context });
    setQuery('');
    setResults([]);
    setOpen(false);
  };

  const useCurrentLocation = (): void => {
    setGeoError(null);
    if (!navigator.geolocation) {
      setGeoError('Location is not available on this device.');
      return;
    }
    setLocating(true);
    // Let the fix converge and keep the best reading, then label the pick with its accuracy.
    void locateWithAccuracy({ desiredAccuracyM: 30 }).then(
      (fix) => {
        onPick(fix.lat, fix.lng, `My current location (±${Math.round(fix.accuracyM)} m)`);
        setQuery('');
        setResults([]);
        setOpen(false);
        setLocating(false);
      },
      () => {
        setGeoError('Could not get your location. Allow location access or search instead.');
        setLocating(false);
      }
    );
  };

  const hasCoords = lat !== '' && lng !== '';
  const showList = open && (loading || results.length > 0);

  return (
    <div style={{ position: 'relative' }}>
      <div style={{ display: 'flex', gap: 8 }}>
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => { if (results.length) setOpen(true); }}
          placeholder={placeholder ?? 'Search a barangay, street or landmark…'}
          style={{ ...inputStyle, flex: 1 }}
        />
        <button
          type="button"
          onClick={useCurrentLocation}
          disabled={locating}
          title="Use my current location"
          style={{ flex: 'none', display: 'flex', alignItems: 'center', gap: 6, padding: '0 12px', border: '1px solid var(--bw-tint-info-border)', background: 'var(--bw-tint-info)', color: 'var(--bw-primary)', borderRadius: 9, fontSize: 12.5, fontWeight: 700, cursor: locating ? 'wait' : 'pointer', whiteSpace: 'nowrap' }}
        >
          ◎ {locating ? 'Locating…' : (currentLabel ?? 'Current')}
        </button>
      </div>
      {geoError && (
        <div style={{ fontSize: 11, color: 'var(--bw-on-tint-danger)', marginTop: 5 }}>{geoError}</div>
      )}
      {(placeLabel || hasCoords) && (
        <div style={{ fontSize: 11, color: 'var(--bw-muted)', marginTop: 5, display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ color: 'var(--bw-faint)' }}>⚲</span>
          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {placeLabel || `Pinned at ${Number(lat).toFixed(4)}, ${Number(lng).toFixed(4)}`}
          </span>
        </div>
      )}
      {showList && (
        <div style={{ position: 'absolute', top: 'calc(100% + 4px)', left: 0, right: 0, zIndex: 1400, background: 'var(--bw-surface)', border: '1px solid var(--bw-line)', borderRadius: 11, boxShadow: '0 12px 34px rgba(15,23,42,.18)', overflow: 'hidden', maxHeight: 240, overflowY: 'auto' }}>
          {loading && results.length === 0 ? (
            <div style={{ padding: '11px 13px', fontSize: 12.5, color: 'var(--bw-muted)' }}>Searching…</div>
          ) : (
            results.map((r, i) => (
              <button
                key={r.id}
                type="button"
                onMouseDown={(e) => { e.preventDefault(); choose(r); }}
                style={{ display: 'flex', alignItems: 'center', width: '100%', textAlign: 'left', padding: '10px 13px', border: 0, borderTop: i === 0 ? 'none' : '1px solid var(--bw-line)', background: 'var(--bw-surface)', cursor: 'pointer', fontSize: 13, color: 'var(--bw-ink)', lineHeight: 1.35 }}
              >
                <PlaceSuggestion primary={r.primary} context={r.context} />
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
};

export default PlaceField;
