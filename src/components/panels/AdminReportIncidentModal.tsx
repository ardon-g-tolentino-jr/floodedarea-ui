import React from 'react';
import type { AlertLevel, NewFloodProneArea, NewReport, Severity, SocialNetwork } from '../../types';
import { DEPTH_RANGE, SEVERITY_PRESET, SEV_META, TTL_OPTIONS } from '../../utils/floodMeta';
import { reverseGeocode } from '../../api/geocode';
import { findIntersection, type Intersection, type IntersectionOutcome } from '../../api/overpass';
import { fileToCompressedDataUrl } from '../../utils/image';
import { buildIncidentCaption, FB_GLYPH_PATH, X_LIMIT, X_URL_COST } from '../../utils/share';
import PlaceField from './PlaceField';
import MapPickField from './MapPickField';
import DepthReference from './DepthReference';

/**
 * Admin-only "Report a flood incident" modal. Lets an admin log a flood known from news or other
 * sources: pin the location — either a street intersection ("Aurora Blvd cor. Katipunan Ave") or
 * a searched/map-picked point, anywhere in the Philippines — set severity/depth, optionally
 * attach a screenshot, and post it. The parent tags it as a system report (reporterTrust:
 * 'system') and, on success, offers to share it to social media. Optionally, the same submit can
 * also create a quiet flood-prone zone at the same pin (see `markProne` below) — that's a second,
 * best-effort action the parent is expected to swallow the failure of (see `onSubmit`'s doc).
 */
interface Props {
  isMobile: boolean;
  /** Post the report and, if `zone` is given, best-effort create a flood-prone area at the same
   *  spot. Throws on report failure so the modal keeps the form open and shows an error — a zone
   *  failure is the parent's problem to swallow non-fatally, not this modal's. */
  onSubmit: (b: NewReport, zone?: NewFloodProneArea) => Promise<void>;
  /** Where the map tab's mini-map centers before anything has been picked — the user's own
   *  location (falls back to the app default) so the first click lands somewhere useful. */
  initialCenter: { lat: number; lng: number };
  onClose: () => void;
}

const SEV_ORDER: Severity[] = ['high', 'medium', 'low'];

// UI policy for this one form only (not a shared domain constant — floodMeta.ts stays free of
// it): what alert level a quiet zone gets when tagged straight off an incident report, keyed off
// the severity already chosen for the report itself.
const SEV_TO_LEVEL: Record<Severity, AlertLevel> = { high: 'red', medium: 'orange', low: 'yellow' };

// Where the admin learned about the flood. Appended to the report name — "Aurora cor. Katipunan
// (News)" — so readers can see a system report's provenance at a glance.
const SOURCE_OPTIONS = ['News', 'Social media', 'LGU advisory', 'Field report', 'Other'] as const;

// Remembered "Auto-post" default — which networks the admin last left ticked. Both on by default
// so a first-time admin gets the intended behaviour without having to discover the toggles.
const SOCIAL_AUTOPOST_STORAGE_KEY = 'baha_social_autopost_v1';

function loadSocialAutopostPref(): { facebook: boolean; x: boolean } {
  try {
    const raw = localStorage.getItem(SOCIAL_AUTOPOST_STORAGE_KEY);
    if (!raw) return { facebook: true, x: true };
    const parsed = JSON.parse(raw) as { facebook?: boolean; x?: boolean };
    return { facebook: parsed.facebook !== false, x: parsed.x !== false };
  } catch {
    return { facebook: true, x: true };
  }
}

const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '9px 11px',
  border: '1px solid var(--bw-line)',
  borderRadius: 9,
  fontSize: 13,
  color: 'var(--bw-ink)',
  background: '#fff',
  boxSizing: 'border-box',
};

const labelStyle: React.CSSProperties = { fontSize: 11, fontWeight: 700, color: 'var(--bw-muted)', marginBottom: 4, display: 'block' };

const AdminReportIncidentModal: React.FC<Props> = ({ isMobile, onSubmit, initialCenter, onClose }) => {
  const [lat, setLat] = React.useState('');
  const [lng, setLng] = React.useState('');
  const [placeLabel, setPlaceLabel] = React.useState('');
  const [name, setName] = React.useState('');
  const [district, setDistrict] = React.useState('');

  // ── Location: two ways to pin a spot — the search/map field (default; fastest for the common
  // "point on a map" case) or a street intersection (PH flood reports are commonly phrased "A cor.
  // B"). Both land on the same lat/lng/placeLabel state, then a mini-map lets the admin fine-tune. ──
  const [locTab, setLocTab] = React.useState<'intersection' | 'map'>('map');
  const [streetA, setStreetA] = React.useState('');
  const [streetB, setStreetB] = React.useState('');
  const [interCity, setInterCity] = React.useState('');
  // Single outcome slot replaces the old results/searched pair — the four IntersectionOutcome
  // statuses (ok/none/unknown-city/busy/aborted) drive four distinct messages below, so the UI
  // never tells the admin "check the spelling" for what is actually an upstream 504.
  const [interOutcome, setInterOutcome] = React.useState<IntersectionOutcome | null>(null);
  const [interSearching, setInterSearching] = React.useState(false);
  // Flips true ~5s into a search so "Searching…" doesn't look frozen through Overpass's observed
  // 7–11s successful runs (let alone the busy path's retries+backoff, which can take longer).
  const [interSlow, setInterSlow] = React.useState(false);
  const interAbortRef = React.useRef<AbortController | null>(null);
  React.useEffect(() => () => interAbortRef.current?.abort(), []);
  const [severity, setSeverity] = React.useState<Severity>('high');
  const [depth, setDepth] = React.useState(SEVERITY_PRESET.high.depthCm);
  const [source, setSource] = React.useState<string>('News');
  const [sourceOther, setSourceOther] = React.useState('');
  // Auto-post toggles — default from the admin's remembered choice (see loadSocialAutopostPref);
  // ticking/unticking here re-remembers it for next time.
  const [postFacebook, setPostFacebook] = React.useState<boolean>(() => loadSocialAutopostPref().facebook);
  const [postX, setPostX] = React.useState<boolean>(() => loadSocialAutopostPref().x);
  React.useEffect(() => {
    try { localStorage.setItem(SOCIAL_AUTOPOST_STORAGE_KEY, JSON.stringify({ facebook: postFacebook, x: postX })); } catch {/* ignore */}
  }, [postFacebook, postX]);
  // "Also mark this place as flood-prone" — creates a quiet zone (never a broadcast) at the same
  // pin as a secondary, best-effort action alongside the report itself. See SEV_TO_LEVEL and
  // `submit` below for how the zone payload is built.
  const [markProne, setMarkProne] = React.useState(false);
  const [proneRadius, setProneRadius] = React.useState('500');
  // When the source reported the flood ("N hours ago", 0 = now) and how long the report stays live
  // ('' = default by severity, else minutes). Both anchor the client-side TTL countdown.
  const [reportedHoursAgo, setReportedHoursAgo] = React.useState('0');
  const [ttl, setTtl] = React.useState('');

  const [photo, setPhoto] = React.useState<string | null>(null);
  const [photoBusy, setPhotoBusy] = React.useState(false);
  const [photoError, setPhotoError] = React.useState<string | null>(null);
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  // `skipNameOverwrite` is set when the pick came from the intersection finder — that already
  // produced the far more legible "A cor. B" name, so a reverse-geocode of the crossing's exact
  // node (which usually resolves to just ONE of the two streets) must not clobber it.
  // `ctx` (from PlaceField's search results) carries the split primary/context, seeding Name and
  // District immediately — the reverse-geocode below still runs and refines them once it returns,
  // subject to the same skipNameOverwrite gate.
  const onPickPlace = (la: number, ln: number, label: string, skipNameOverwrite = false, ctx?: { primary: string; context: string }): void => {
    setLat(String(la));
    setLng(String(ln));
    setPlaceLabel(label);
    // Seed name/district from the picked label/ctx, then refine with a reverse-geocode. `label`
    // is '' for a raw map click (no search result) — firstSeg then resolves to '', which the
    // `if` below already treats as falsy, so it never writes "undefined" into the field.
    const firstSeg = ctx?.primary || label.split(',')[0]?.trim();
    if (!skipNameOverwrite && firstSeg) setName((n) => n || firstSeg);
    if (!skipNameOverwrite && ctx?.context) setDistrict((d) => d || ctx.context);
    void reverseGeocode(la, ln).then((g) => {
      if (!skipNameOverwrite) {
        const street = g.road ?? g.barangay ?? firstSeg ?? '';
        if (street) setName(street);
      }
      // Bug fix: this used to overwrite District unconditionally on every pick, including a
      // mini-map fine-tune after choosing an intersection — silently rewriting an admin's typed
      // value with no feedback. Gated the same way the name write above is: only overwrite when
      // the pick did NOT come from an intersection (skipNameOverwrite is false), or the field is
      // still blank (so the *first* fine-tune after an intersection pick can still fill it in).
      if (g.district) {
        const resolvedDistrict = g.district;
        setDistrict((d) => (!skipNameOverwrite || d === '' ? resolvedDistrict : d));
      }
    });
  };

  const findIntersectionPoints = async (): Promise<void> => {
    if (!streetA.trim() || !streetB.trim()) return;
    interAbortRef.current?.abort();
    const ac = new AbortController();
    interAbortRef.current = ac;
    setInterSearching(true);
    setInterSlow(false);
    setInterOutcome(null);
    const slowTimer = window.setTimeout(() => {
      if (!ac.signal.aborted) setInterSlow(true);
    }, 5000);
    const outcome = await findIntersection(streetA, streetB, interCity, ac.signal);
    window.clearTimeout(slowTimer);
    if (ac.signal.aborted) return;
    setInterSearching(false);
    setInterSlow(false);
    setInterOutcome(outcome);
  };

  const chooseIntersection = (pt: Intersection): void => {
    onPickPlace(pt.lat, pt.lng, pt.label, true);
    setName(`${streetA.trim()} cor. ${streetB.trim()}`);
  };

  // Fine-tune (mini-map click/drag) after an initial pick. Within the Intersection tab we keep
  // skipping the name overwrite (preserve "A cor. B"); the Pick-on-map tab behaves like PlaceField
  // always has — every move refreshes name/district from the new point.
  const onFineTune = (la: number, ln: number): void => {
    onPickPlace(la, ln, placeLabel, locTab === 'intersection');
  };

  const chooseSeverity = (s: Severity): void => {
    setSeverity(s);
    setDepth(SEVERITY_PRESET[s].depthCm);
  };

  const onPickPhoto = async (e: React.ChangeEvent<HTMLInputElement>): Promise<void> => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setPhotoError(null);
    setPhotoBusy(true);
    try {
      setPhoto(await fileToCompressedDataUrl(file));
    } catch (err) {
      setPhotoError(err instanceof Error ? err.message : 'Could not add that screenshot.');
      setPhoto(null);
    } finally {
      setPhotoBusy(false);
    }
  };

  const hasCoords = lat !== '' && lng !== '';
  const canPost = hasCoords && name.trim() !== '' && !busy && !photoBusy;

  const submit = async (): Promise<void> => {
    if (!canPost) {
      if (!hasCoords) setError('Search and select a location.');
      else if (name.trim() === '') setError('Give the incident a name.');
      return;
    }
    const preset = SEVERITY_PRESET[severity];
    const sourceNote = (source === 'Other' ? sourceOther : source).trim();
    const label = sourceNote ? `${name.trim()} (${sourceNote})` : name.trim();
    // Convert "N hours ago" to an absolute report time; a chosen TTL preset overrides the default.
    const hoursAgo = Math.max(0, Number(reportedHoursAgo) || 0);
    const ttlMinutes = ttl ? Number(ttl) : undefined;
    const networks: SocialNetwork[] = [...(postFacebook ? (['facebook'] as const) : []), ...(postX ? (['x'] as const) : [])];
    const payload: NewReport = {
      name: label,
      district: district.trim() || 'Unknown area',
      latitude: Number(lat),
      longitude: Number(lng),
      severity,
      depthCm: depth,
      trend: preset.trend,
      road: preset.road,
      photoDataUrl: photo ?? undefined,
      reportedAt: new Date(Date.now() - hoursAgo * 3600_000).toISOString(),
      ttlMinutes,
      ...(networks.length > 0
        ? { socialNetworks: networks, socialCaption: buildIncidentCaption({ name: label, district: district.trim(), severity, depthCm: depth, trend: preset.trend }) }
        : {}),
    };
    // Built from the same already-resolved fields as the report — the *plain* name (not the
    // note-suffixed report label), so a zone reads as a place, not a specific news blurb.
    const zone: NewFloodProneArea | undefined = markProne
      ? {
          name: name.trim(),
          district: district.trim() || 'Unknown area',
          latitude: Number(lat),
          longitude: Number(lng),
          radiusM: Math.max(50, Number(proneRadius) || 500),
          level: SEV_TO_LEVEL[severity],
          note: sourceNote || null,
          active: true,
        }
      : undefined;
    setBusy(true);
    setError(null);
    try {
      await onSubmit(payload, zone);
      onClose();
    } catch {
      setError('Could not post the incident. Please try again.');
    } finally {
      setBusy(false);
    }
  };

  const range = DEPTH_RANGE[severity];

  // Live preview of the auto-post caption — mirrors exactly what `submit()` will send as
  // `socialCaption` (same label-with-source-note, same trend), so what the admin sees is what ships.
  const previewSourceNote = (source === 'Other' ? sourceOther : source).trim();
  const previewLabel = previewSourceNote ? `${(name.trim() || 'This location')} (${previewSourceNote})` : (name.trim() || 'This location');
  const captionBody = buildIncidentCaption({
    name: previewLabel,
    district: district.trim(),
    severity,
    depthCm: depth,
    trend: SEVERITY_PRESET[severity].trend,
  });
  // What actually ships on X: this body + a newline + the deep link, which the server appends and
  // which X always counts as X_URL_COST chars regardless of the link's real length.
  const xCharCount = captionBody.length + 1 + X_URL_COST;
  const xOverBudget = xCharCount > X_LIMIT;

  const card = (
    <div
      onClick={(e) => e.stopPropagation()}
      style={{ width: 460, maxWidth: '100%', maxHeight: '90vh', display: 'flex', flexDirection: 'column', background: '#fff', borderRadius: isMobile ? '20px 20px 0 0' : 20, boxShadow: '0 24px 70px rgba(15,23,42,.4)', overflow: 'hidden', animation: isMobile ? 'sheetUp .22s ease-out' : 'popIn .16s ease-out' }}
    >
      {/* Header */}
      <div style={{ background: 'linear-gradient(135deg,#4F46E5,#4338CA)', padding: '16px 20px', color: '#fff', display: 'flex', alignItems: 'center', gap: 12 }}>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 16, fontWeight: 800 }}>🗞 Report a flood incident</div>
          <div style={{ fontSize: 12, opacity: 0.9 }}>Log a flood from news or other sources — posts as a system report.</div>
        </div>
        <button onClick={onClose} style={{ border: 0, background: 'rgba(255,255,255,.18)', color: '#fff', width: 28, height: 28, borderRadius: 8, fontSize: 16, cursor: 'pointer', flex: 'none' }}>×</button>
      </div>

      {/* Body */}
      <div style={{ padding: '15px 20px', overflowY: 'auto', flex: 1, display: 'flex', flexDirection: 'column', gap: 12 }}>
        {error && (
          <div style={{ background: '#FEF2F2', color: '#B91C1C', padding: '8px 11px', borderRadius: 9, fontSize: 12.5, fontWeight: 600 }}>{error}</div>
        )}

        <div>
          <label style={labelStyle}>Location</label>

          <div style={{ display: 'flex', gap: 6, marginBottom: 8 }}>
            {(['map', 'intersection'] as const).map((tKey) => (
              <button
                key={tKey}
                type="button"
                onClick={() => setLocTab(tKey)}
                style={{
                  flex: 1,
                  padding: '7px 8px',
                  borderRadius: 9,
                  cursor: 'pointer',
                  border: `1.5px solid ${locTab === tKey ? '#4338CA' : '#E2E8F0'}`,
                  background: locTab === tKey ? '#EEF2FF' : '#fff',
                  color: locTab === tKey ? '#4338CA' : 'var(--bw-ink)',
                  fontSize: 12,
                  fontWeight: 800,
                }}
              >
                {tKey === 'intersection' ? '✕ Intersection' : '📍 Pick on map'}
              </button>
            ))}
          </div>

          {locTab === 'intersection' ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <input value={streetA} onChange={(e) => setStreetA(e.target.value)} placeholder="Street 1 — e.g. Aurora Blvd" style={inputStyle} />
              <input value={streetB} onChange={(e) => setStreetB(e.target.value)} placeholder="Street 2 — e.g. Katipunan Ave" style={inputStyle} />
              <input value={interCity} onChange={(e) => setInterCity(e.target.value)} placeholder="City (optional) — e.g. Quezon City" style={inputStyle} />
              <button
                type="button"
                disabled={!streetA.trim() || !streetB.trim() || interSearching}
                onClick={() => void findIntersectionPoints()}
                style={{
                  border: 0,
                  background: '#4338CA',
                  color: '#fff',
                  padding: '9px',
                  borderRadius: 9,
                  fontSize: 12.5,
                  fontWeight: 800,
                  cursor: !streetA.trim() || !streetB.trim() || interSearching ? 'not-allowed' : 'pointer',
                  opacity: !streetA.trim() || !streetB.trim() || interSearching ? 0.6 : 1,
                }}
              >
                {interSearching ? 'Searching…' : 'Find intersection'}
              </button>
              {interSearching && interSlow && (
                <div style={{ fontSize: 11, color: 'var(--bw-muted)' }}>Still searching — OpenStreetMap can be slow.</div>
              )}

              {/* Outcome-aware messaging: only 'none' and 'unknown-city' are the admin's own typo
                  to fix. 'busy' is Overpass's fault (observed failing 5/6 attempts with a 504) and
                  gets a Retry + a one-click escape to the map tab instead of "check the spelling". */}
              {interOutcome?.status === 'busy' && (
                <div style={{ background: '#FFFBEB', border: '1px solid #FDE68A', borderRadius: 9, padding: '8px 10px', display: 'flex', flexDirection: 'column', gap: 7 }}>
                  <div style={{ fontSize: 11.5, color: '#92400E', fontWeight: 600 }}>OpenStreetMap's lookup service is busy right now. Try again, or use "Pick on map".</div>
                  <div style={{ display: 'flex', gap: 6 }}>
                    <button
                      type="button"
                      onClick={() => void findIntersectionPoints()}
                      style={{ border: 0, background: '#4338CA', color: '#fff', padding: '6px 11px', borderRadius: 8, fontSize: 11.5, fontWeight: 800, cursor: 'pointer' }}
                    >
                      Retry
                    </button>
                    <button
                      type="button"
                      onClick={() => setLocTab('map')}
                      style={{ border: '1px solid var(--bw-line)', background: '#fff', color: 'var(--bw-ink)', padding: '6px 11px', borderRadius: 8, fontSize: 11.5, fontWeight: 800, cursor: 'pointer' }}
                    >
                      Pick on map
                    </button>
                  </div>
                </div>
              )}
              {interOutcome?.status === 'unknown-city' && (
                <div style={{ fontSize: 11.5, color: 'var(--bw-muted)' }}>Couldn't find "{interOutcome.city}" — check the spelling, or leave City blank.</div>
              )}
              {interOutcome?.status === 'none' && (
                <div style={{ fontSize: 11.5, color: 'var(--bw-muted)' }}>No crossing found — check the spelling, or try "Pick on map".</div>
              )}
              {interOutcome?.status === 'ok' && interOutcome.points.length > 0 && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {interOutcome.points.map((r, i, points) => {
                    const chosen = lat === String(r.lat) && lng === String(r.lng);
                    return (
                      <button
                        key={`${r.lat},${r.lng}`}
                        type="button"
                        onClick={() => chooseIntersection(r)}
                        style={{
                          textAlign: 'left',
                          padding: '8px 10px',
                          borderRadius: 9,
                          border: `1.5px solid ${chosen ? '#4338CA' : '#E2E8F0'}`,
                          background: chosen ? '#EEF2FF' : '#fff',
                          fontSize: 12,
                          fontWeight: 700,
                          cursor: 'pointer',
                        }}
                      >
                        ⚲ {points.length > 1 ? `Crossing #${i + 1} — ` : ''}{r.label}
                      </button>
                    );
                  })}
                </div>
              )}
              {hasCoords && (
                <div style={{ fontSize: 11, color: 'var(--bw-muted)', display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span style={{ color: '#9AA8B4' }}>⚲</span>
                  <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {placeLabel || `Pinned at ${Number(lat).toFixed(4)}, ${Number(lng).toFixed(4)}`}
                  </span>
                </div>
              )}
              {/* Fine-tune mini-map — only once the intersection finder (or a subsequent nudge)
                  has produced a point; unlike the map tab below, there's nothing to click on
                  before that (a crossing, not an arbitrary spot, is the whole point of this tab). */}
              {hasCoords && (
                <div style={{ marginTop: 8 }}>
                  <MapPickField lat={Number(lat)} lng={Number(lng)} onPick={onFineTune} />
                </div>
              )}
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <PlaceField
                lat={lat}
                lng={lng}
                placeLabel={placeLabel}
                onPick={(la, ln, label, ctx) => onPickPlace(la, ln, label, false, ctx)}
                near={initialCenter}
              />
              {/* Always mounted (unlike the intersection tab's fine-tune map): the map itself is
                  the primary way to pick a point here, so it must be clickable before a search
                  even happens. `pinned=hasCoords` hides the marker and shows a tap hint until the
                  first pick lands; a click before then still routes through onFineTune → onPickPlace
                  with the empty placeLabel, which reverse-geocodes to fill Name/District. */}
              <MapPickField
                lat={hasCoords ? Number(lat) : initialCenter.lat}
                lng={hasCoords ? Number(lng) : initialCenter.lng}
                pinned={hasCoords}
                onPick={onFineTune}
              />
            </div>
          )}
        </div>

        <div>
          <label style={labelStyle}>Name / place</label>
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Marikina Bridge" style={inputStyle} />
        </div>

        <div>
          <label style={labelStyle}>District</label>
          <input value={district} onChange={(e) => setDistrict(e.target.value)} placeholder="Auto-filled from the location" style={inputStyle} />
        </div>

        <div>
          <label style={labelStyle}>Severity</label>
          <div style={{ display: 'flex', gap: 7 }}>
            {SEV_ORDER.map((s) => {
              const active = severity === s;
              const m = SEV_META[s];
              return (
                <button
                  key={s}
                  type="button"
                  onClick={() => chooseSeverity(s)}
                  style={{ flex: 1, padding: '9px 8px', borderRadius: 10, cursor: 'pointer', border: `1.5px solid ${active ? m.color : '#E2E8F0'}`, background: active ? m.soft : '#fff', color: active ? m.color : 'var(--bw-ink)', fontSize: 12.5, fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}
                >
                  <span style={{ width: 9, height: 9, borderRadius: '50%', background: m.color, flex: 'none' }} />
                  {m.label}
                </button>
              );
            })}
          </div>
        </div>

        <div>
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>
            <input type="checkbox" checked={markProne} onChange={(e) => setMarkProne(e.target.checked)} />
            ⚠ Also mark this place as flood-prone
          </label>
          <div style={{ fontSize: 10.5, color: 'var(--bw-faint)', fontWeight: 600, marginTop: 3, marginLeft: 22 }}>
            Adds a quiet zone on the map. It does not send a warning; do that from Admin → Zones when you want people alerted.
          </div>
          {markProne && (
            <div style={{ marginTop: 8, marginLeft: 22, maxWidth: 160 }}>
              <label style={labelStyle}>Radius (m)</label>
              <input type="number" min={50} value={proneRadius} onChange={(e) => setProneRadius(e.target.value)} style={inputStyle} />
            </div>
          )}
        </div>

        <div>
          <label style={labelStyle}>Water depth — {depth} cm</label>
          <input
            type="range"
            min={range.min}
            max={range.max}
            step={range.step}
            value={depth}
            onChange={(e) => setDepth(Number(e.target.value))}
            style={{ width: '100%', accentColor: SEV_META[severity].color }}
          />
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10.5, color: 'var(--bw-faint)', fontWeight: 600 }}>
            <span>{range.min} cm</span>
            <span>{range.max} cm</span>
          </div>
          <div style={{ marginTop: 9 }}>
            <DepthReference depthCm={depth} color={SEV_META[severity].color} />
          </div>
        </div>

        <div>
          <label style={labelStyle}>Screenshot <span style={{ fontWeight: 600 }}>(optional)</span></label>
          <input ref={fileInputRef} type="file" accept="image/*" onChange={(e) => void onPickPhoto(e)} style={{ display: 'none' }} />
          {photo ? (
            <div style={{ position: 'relative', borderRadius: 10, overflow: 'hidden', border: '1px solid var(--bw-line)' }}>
              <img src={photo} alt="Incident screenshot preview" style={{ width: '100%', maxHeight: 160, objectFit: 'cover', display: 'block' }} />
              <button type="button" onClick={() => { setPhoto(null); setPhotoError(null); }} style={{ position: 'absolute', top: 6, right: 6, border: 0, background: 'rgba(15,23,42,.62)', color: '#fff', borderRadius: 8, padding: '4px 9px', fontSize: 11, fontWeight: 800, cursor: 'pointer' }}>Remove</button>
            </div>
          ) : (
            <button type="button" disabled={photoBusy} onClick={() => fileInputRef.current?.click()} style={{ width: '100%', padding: 11, border: '1.5px dashed #CBD5E1', borderRadius: 10, background: '#F8FAFC', color: 'var(--bw-ink-soft)', fontSize: 12.5, fontWeight: 800, cursor: photoBusy ? 'wait' : 'pointer' }}>
              {photoBusy ? 'Processing screenshot…' : '📷 Attach a screenshot'}
            </button>
          )}
          {photoError && <div style={{ fontSize: 10.5, color: 'var(--bw-danger)', fontWeight: 600, marginTop: 4 }}>{photoError}</div>}
        </div>

        <div>
          <label style={labelStyle}>Source</label>
          <select value={source} onChange={(e) => setSource(e.target.value)} style={inputStyle}>
            {SOURCE_OPTIONS.map((o) => <option key={o} value={o}>{o}</option>)}
          </select>
          {source === 'Other' && (
            <input
              value={sourceOther}
              onChange={(e) => setSourceOther(e.target.value)}
              placeholder="e.g. via DZMM report"
              style={{ ...inputStyle, marginTop: 8 }}
            />
          )}
        </div>

        <div>
          <label style={labelStyle}>Auto-post</label>
          <div style={{ display: 'flex', gap: 7 }}>
            <label style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 7, padding: '8px 10px', border: `1.5px solid ${postFacebook ? '#4338CA' : '#E2E8F0'}`, background: postFacebook ? '#EEF2FF' : '#fff', borderRadius: 9, fontSize: 12.5, fontWeight: 700, cursor: 'pointer' }}>
              <input type="checkbox" checked={postFacebook} onChange={(e) => setPostFacebook(e.target.checked)} />
              <svg viewBox="0 0 24 24" width={13} height={13} fill="#1877F2" style={{ flex: 'none' }}><path d={FB_GLYPH_PATH} /></svg>
              Facebook
            </label>
            <label style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 7, padding: '8px 10px', border: `1.5px solid ${postX ? '#4338CA' : '#E2E8F0'}`, background: postX ? '#EEF2FF' : '#fff', borderRadius: 9, fontSize: 12.5, fontWeight: 700, cursor: 'pointer' }}>
              <input type="checkbox" checked={postX} onChange={(e) => setPostX(e.target.checked)} />
              𝕏 X
            </label>
          </div>
          {(postFacebook || postX) && (
            <div style={{ marginTop: 8, padding: '9px 10px', background: '#F7FAFB', border: '1px solid var(--bw-line-soft)', borderRadius: 9 }}>
              <div style={{ fontSize: 11.5, color: 'var(--bw-ink-soft)', whiteSpace: 'pre-wrap', lineHeight: 1.4 }}>{captionBody}</div>
              {postX && (
                <div style={{ marginTop: 6, fontSize: 10.5, fontWeight: 700, color: xOverBudget ? 'var(--bw-danger)' : 'var(--bw-faint)' }}>
                  {xCharCount}/{X_LIMIT} on X (link counted as {X_URL_COST} chars)
                </div>
              )}
            </div>
          )}
        </div>

        <div style={{ display: 'flex', gap: 11 }}>
          <div style={{ flex: 1 }}>
            <label style={labelStyle}>Reported how long ago?</label>
            <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
              <input
                type="number"
                min={0}
                value={reportedHoursAgo}
                onChange={(e) => setReportedHoursAgo(e.target.value)}
                style={{ ...inputStyle, width: 80 }}
              />
              <span style={{ fontSize: 12.5, color: 'var(--bw-muted)', fontWeight: 600 }}>hours ago</span>
            </div>
            <div style={{ fontSize: 10.5, color: 'var(--bw-faint)', fontWeight: 600, marginTop: 4 }}>0 = just now. The countdown runs from here.</div>
          </div>
          <div style={{ flex: 1 }}>
            <label style={labelStyle}>Keep live for</label>
            <select value={ttl} onChange={(e) => setTtl(e.target.value)} style={inputStyle}>
              {TTL_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </div>
        </div>
      </div>

      {/* Footer */}
      <div style={{ padding: '12px 20px', borderTop: '1px solid var(--bw-line-soft)' }}>
        <button
          onClick={() => void submit()}
          disabled={!canPost}
          style={{ width: '100%', border: 0, background: '#4338CA', color: '#fff', padding: 12, borderRadius: 11, fontSize: 13.5, fontWeight: 800, cursor: canPost ? 'pointer' : 'not-allowed', opacity: canPost ? 1 : 0.6 }}
        >
          {busy ? 'Posting…' : photoBusy ? 'Processing screenshot…' : 'Post system report'}
        </button>
      </div>
    </div>
  );

  return (
    <div
      onClick={onClose}
      style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,.55)', backdropFilter: 'blur(3px)', zIndex: 1200, display: 'flex', alignItems: isMobile ? 'flex-end' : 'center', justifyContent: 'center', padding: isMobile ? 0 : 18 }}
    >
      {card}
    </div>
  );
};

export default AdminReportIncidentModal;
