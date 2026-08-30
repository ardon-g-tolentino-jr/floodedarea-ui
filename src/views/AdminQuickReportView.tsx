import React from 'react';
import type { FloodReport, LatLng } from '../types';
import type { FloodHotspot } from '../data/floodHotspots';
import {
  DEPTH_SLIDER_MAX_CM,
  DEPTH_SLIDER_MIN_CM,
  ROAD_META,
  SEVERITY_PRESET,
  SEV_META,
  TTL_OPTIONS,
  TTL_STOPS_MIN,
  drainMinutes,
  nearestTtlStop,
  roadFromDepth,
  severityFromDepth,
} from '../utils/floodMeta';
import { alreadyReportedKeys } from '../utils/viewModel';
import { cmToIn, formatDepth, formatDepthRange, formatDepthShort, formatDuration } from '../utils/format';
import { cityOf, provinceOf } from '../utils/phGeo';
import * as store from '../utils/hotspotStore';
import { reverseGeocode } from '../api/geocode';
import PlaceField from '../components/panels/PlaceField';
import MapPickField from '../components/panels/MapPickField';
import DepthReference from '../components/panels/DepthReference';
import SliderRow from '../components/panels/SliderRow';

/** One line of the batch: which hotspot, how deep the water is there right now, and how long that
 *  particular flood should stay on the map. All three vary per row — see the page's doc comment. */
export interface HotspotReport {
  hotspot: FloodHotspot;
  depthCm: number;
  ttlMinutes: number;
}

/**
 * Admin-only "Quick flood report" page — tick the Metro Manila corridors that are flooding right
 * now, set how deep and for how long, post them all as system reports in one pass.
 *
 * Distinct from its two neighbours: AdminReportIncidentModal logs ONE incident anywhere in the
 * country with a fresh pin; ZoneReportModal batches over flood-prone ZONES that exist in the
 * backend. This one works off a curated, bundled catalog of known street-level hotspots
 * (data/floodHotspots.ts) so a habagat event needs no pinning at all — and unlike ZoneReportModal
 * every row carries its OWN depth, because the same storm puts gutter-deep water on Roxas Blvd and
 * above-head water in Barangay Damayan.
 *
 * Depth is the only thing the admin has to set: severity, road passability and trend are all derived
 * from it (severityFromDepth / roadFromDepth), so a shallow row can never inherit a deep row's
 * severity — and each row's time-to-live is estimated from that same depth (drainMinutes), so a
 * gutter-deep arterial drops off the map hours before a chest-deep barangay does, with no per-row
 * input at all. Both are still overridable per row.
 *
 * Deliberately does NOT auto-post to Facebook/X — N locations must never fan out into N social
 * posts. Same rule as ZoneReportModal; the Flood digest is how a roundup gets shared.
 */
interface Props {
  isMobile: boolean;
  /** Live (unexpired) reports — greys out hotspots that already carry a pin. */
  reports: FloodReport[];
  /** Biases the "+ Add hotspot" place search toward where the admin is. */
  userLoc: LatLng;
  /** The global "rain is falling now" setting. Water can't start draining until the rain stops, so
   *  this lengthens every auto TTL estimate by RAIN_HOLD_MIN. */
  rainActive: boolean;
  onSubmit: (picked: HotspotReport[]) => Promise<{ ok: number; failed: string[] }>;
  onClose: () => void;
}

const ALL = 'All';
/** Past this many locations in one go, the admin has to confirm the blast radius first — mirrors
 *  AdminScopedWarnModal's BULK_CONFIRM_THRESHOLD, at the smaller scale a report batch warrants. */
const BULK_CONFIRM_THRESHOLD = 10;
/** Batch TTL policy sentinels. 'auto' (the default) means every row derives its own lifetime from
 *  its own depth; 'custom' reveals the free-form hours box; anything else is a fixed minute count
 *  from TTL_OPTIONS applied to every row alike.
 *
 *  TTL_OPTIONS' own '' entry ("Default (by severity)") is deliberately filtered out here: it defers
 *  to the server's 20/45/90-minute windows, which leaves no number for a row's slider to show and
 *  is far shorter than an admin logging a known corridor flood wants. This page is the explicit
 *  -control surface; the single-incident modal still offers it. */
const TTL_AUTO = 'auto';
const TTL_CUSTOM = 'custom';
const TTL_FIXED_OPTIONS = TTL_OPTIONS.filter((o) => o.value !== '');

type Unit = 'cm' | 'in';

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
const labelStyle: React.CSSProperties = { fontSize: 11, fontWeight: 700, color: 'var(--bw-muted)', marginBottom: 4, display: 'block' };
const linkBtn: React.CSSProperties = { border: 0, background: 'transparent', fontSize: 11.5, fontWeight: 800, cursor: 'pointer', padding: 0 };

/** cm → the number shown in the active unit, and back. cm remains the stored unit throughout (see
 *  the warning on `formatDepth`); inches are only ever a display/entry convenience. */
const toUnit = (cm: number, unit: Unit): number => (unit === 'cm' ? cm : cmToIn(cm));
const fromUnit = (v: number, unit: Unit): number => (unit === 'cm' ? Math.round(v) : Math.round(v * 2.54));

/**
 * A depth box that reads and writes centimetres but can be *shown* in inches. cm stays the stored
 * unit everywhere (see the warning on formatDepth) — inches are a typing convenience that converts
 * straight back, never a second source of truth. The local draft lets the field be cleared
 * mid-edit without the value snapping back on every keystroke.
 */
const DepthField: React.FC<{ cm: number; unit: Unit; onChange: (cm: number) => void; width?: number }> = ({ cm, unit, onChange, width }) => {
  const shown = unit === 'cm' ? cm : cmToIn(cm);
  const [draft, setDraft] = React.useState(String(shown));
  React.useEffect(() => setDraft(String(shown)), [shown]);
  return (
    <input
      type="number"
      min={1}
      max={unit === 'cm' ? 300 : 118}
      value={draft}
      onChange={(e) => {
        const raw = e.target.value;
        setDraft(raw);
        const n = Number(raw);
        if (raw !== '' && Number.isFinite(n) && n > 0) onChange(unit === 'cm' ? Math.round(n) : Math.round(n * 2.54));
      }}
      onBlur={() => setDraft(String(shown))}
      style={{ ...inputStyle, width: width ?? '100%', padding: '7px 9px', fontSize: 12.5, fontWeight: 700 }}
    />
  );
};

/** "4h" when every row agrees, "2h–6h" when they don't — the point of per-row lifetimes is visible
 *  right in the footer without opening a single row. */
function spanLabel(mins: number[]): string {
  const lo = Math.min(...mins);
  const hi = Math.max(...mins);
  return lo === hi ? formatDuration(lo) : `${formatDuration(lo)}–${formatDuration(hi)}`;
}

const AdminQuickReportView: React.FC<Props> = ({ isMobile, reports, userLoc, rainActive, onSubmit, onClose }) => {
  const [hotspots, setHotspots] = React.useState<FloodHotspot[]>(() => store.loadHotspots());
  const reload = (): void => setHotspots(store.loadHotspots());

  const [checked, setChecked] = React.useState<Set<string>>(new Set());
  /** Per-row depth overrides, cm. Absent ⇒ the row uses the batch depth. */
  const [depths, setDepths] = React.useState<Record<string, number>>({});
  /** Per-row TTL overrides, minutes. Absent ⇒ the row derives its own (see `ttlOf`). */
  const [ttls, setTtls] = React.useState<Record<string, number>>({});
  const [batchCm, setBatchCm] = React.useState(SEVERITY_PRESET.medium.depthCm);
  const [unit, setUnit] = React.useState<Unit>('cm');
  const [ttl, setTtl] = React.useState(TTL_AUTO);
  const [customHours, setCustomHours] = React.useState('6');

  const [province, setProvince] = React.useState(ALL);
  const [city, setCity] = React.useState(ALL);
  const [tier, setTier] = React.useState(ALL);
  const [query, setQuery] = React.useState('');

  const [pinEditId, setPinEditId] = React.useState<string | null>(null);
  const [addOpen, setAddOpen] = React.useState(false);
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [confirming, setConfirming] = React.useState(false);

  // Hotspots that already have a live pin on top of them — shown disabled so a batch can't stack a
  // duplicate. Same 150 m rule the flood-prone zone checklist uses.
  const already = React.useMemo(
    () => alreadyReportedKeys(reports, hotspots.map((h) => ({ key: h.id, lat: h.lat, lng: h.lng }))),
    [reports, hotspots]
  );

  // ── Cascading scope: each level's options come from the level above it, so a city list can never
  // offer something the chosen province doesn't contain. Native selects, as elsewhere in admin. ──
  const inProvince = React.useMemo(
    () => (province === ALL ? hotspots : hotspots.filter((h) => provinceOf(h.district) === province)),
    [hotspots, province]
  );
  const provinceOptions = React.useMemo(
    () => [...new Set(hotspots.map((h) => provinceOf(h.district)))].sort(),
    [hotspots]
  );
  const cityOptions = React.useMemo(
    () => [...new Set(inProvince.map((h) => cityOf(h.district)))].sort(),
    [inProvince]
  );

  const visible = React.useMemo(() => {
    const q = query.trim().toLowerCase();
    return inProvince
      .filter((h) => city === ALL || cityOf(h.district) === city)
      .filter((h) => tier === ALL || String(h.tier) === tier)
      .filter((h) => !q || `${h.name} ${h.barangay ?? ''} ${h.city}`.toLowerCase().includes(q))
      .sort((a, b) => b.timesReported - a.timesReported || a.city.localeCompare(b.city) || a.name.localeCompare(b.name));
  }, [inProvince, city, tier, query]);

  // Fixed batch lifetime in minutes, or null when the policy is 'auto' and every row estimates its
  // own. Custom hours are clamped into the slider's own range so a typed 999 can still be shown.
  const batchFixedMin: number | null =
    ttl === TTL_AUTO
      ? null
      : ttl === TTL_CUSTOM
        ? Math.min(TTL_STOPS_MIN[TTL_STOPS_MIN.length - 1], Math.max(TTL_STOPS_MIN[0], Math.round((Number(customHours) || 0) * 60)))
        : Number(ttl);

  const depthOf = (h: FloodHotspot): number => depths[h.id] ?? batchCm;
  // A row's lifetime, in precedence order: what the admin dragged for THIS row, else the batch's
  // fixed duration, else — the default — an estimate from this row's own depth. Falling through to
  // the estimate rather than snapshotting it is what makes moving a row's depth slider re-time it.
  const ttlOf = (h: FloodHotspot): number => ttls[h.id] ?? batchFixedMin ?? drainMinutes(depthOf(h), rainActive);
  const picked: HotspotReport[] = hotspots
    .filter((h) => checked.has(h.id))
    .map((h) => ({ hotspot: h, depthCm: depthOf(h), ttlMinutes: ttlOf(h) }));

  const toggle = (id: string): void =>
    setChecked((s) => {
      const next = new Set(s);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  const selectVisible = (rows: FloodHotspot[]): void =>
    setChecked(new Set(rows.filter((h) => !already.has(h.id)).map((h) => h.id)));

  const setRowDepth = (id: string, cm: number): void => setDepths((d) => ({ ...d, [id]: cm }));
  const resetRowDepth = (id: string): void =>
    setDepths((d) => {
      const next = { ...d };
      delete next[id];
      return next;
    });
  const setRowTtl = (id: string, min: number): void => setTtls((t) => ({ ...t, [id]: min }));
  const resetRowTtl = (id: string): void =>
    setTtls((t) => {
      const next = { ...t };
      delete next[id];
      return next;
    });
  /** Fill every ticked row with its own Aug-2026 high-water mark — the catalog's per-location data. */
  const useHistoricalDepths = (): void =>
    setDepths((d) => {
      const next = { ...d };
      for (const h of hotspots) if (checked.has(h.id)) next[h.id] = h.maxDepthCm;
      return next;
    });

  const movePin = (id: string, lat: number, lng: number): void => {
    store.setPin(id, lat, lng);
    reload();
  };

  const post = async (): Promise<void> => {
    if (picked.length === 0 || busy) return;
    setBusy(true);
    setError(null);
    try {
      const result = await onSubmit(picked);
      if (result.failed.length > 0) {
        // Partial failure: stay open with the selection intact so a retry re-posts exactly what
        // didn't land, same as ZoneReportModal.
        setError(`Posted ${result.ok} of ${picked.length}. Failed: ${result.failed.join(', ')}.`);
        setConfirming(false);
      } else {
        onClose();
      }
    } catch {
      setError('Could not post the reports. Please try again.');
      setConfirming(false);
    } finally {
      setBusy(false);
    }
  };

  const onReportClick = (): void => {
    if (picked.length > BULK_CONFIRM_THRESHOLD && !confirming) {
      setConfirming(true);
      return;
    }
    void post();
  };

  const batchSev = severityFromDepth(batchCm);
  const batchRoad = roadFromDepth(batchCm);

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'var(--bw-bg)', zIndex: 1200, display: 'flex', flexDirection: 'column' }}>
      {/* Header */}
      <div style={{ background: 'linear-gradient(135deg,var(--bw-primary),var(--bw-primary-deep))', padding: '16px 20px', color: 'var(--bw-on-accent)', display: 'flex', alignItems: 'center', gap: 12, flex: 'none' }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 18, fontWeight: 800 }}>⚡ Quick flood report</div>
          <div style={{ fontSize: 12, opacity: 0.9 }}>Tick the hotspots that are flooding, set the depth and how long it lasts, then post them all at once.</div>
        </div>
        <button onClick={onClose} style={{ border: 0, background: 'rgba(255,255,255,.18)', color: 'var(--bw-on-accent)', width: 28, height: 28, borderRadius: 8, fontSize: 17, cursor: 'pointer', flex: 'none' }}>×</button>
      </div>

      {/* Scrolling body */}
      <div style={{ flex: 1, overflowY: 'auto', padding: isMobile ? '14px 14px 0' : '16px 22px 0' }}>
        <div style={{ maxWidth: 780, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 14 }}>
          {error && (
            <div style={{ background: 'var(--bw-tint-danger)', color: 'var(--bw-on-tint-danger)', padding: '9px 12px', borderRadius: 9, fontSize: 12.5, fontWeight: 600 }}>{error}</div>
          )}

          {/* ── Batch depth + duration ─────────────────────────────────────────────── */}
          <div style={{ background: 'var(--bw-surface)', border: '1px solid var(--bw-line-soft)', borderRadius: 13, padding: 14, display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div>
              <label style={labelStyle}>Water depth — applies to every ticked location</label>
              <div style={{ display: 'flex', gap: 7, marginBottom: 9 }}>
                {(['low', 'medium', 'high'] as const).map((s) => {
                  const m = SEV_META[s];
                  const active = batchSev === s;
                  return (
                    <button
                      key={s}
                      type="button"
                      onClick={() => setBatchCm(SEVERITY_PRESET[s].depthCm)}
                      style={{ flex: 1, padding: '9px 8px', borderRadius: 10, cursor: 'pointer', border: `1.5px solid ${active ? m.color : 'var(--bw-line)'}`, background: active ? m.soft : 'var(--bw-surface)', color: active ? m.color : 'var(--bw-ink)', fontSize: 12.5, fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}
                    >
                      <span style={{ width: 9, height: 9, borderRadius: '50%', background: m.color, flex: 'none' }} />
                      {m.label}
                    </button>
                  );
                })}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 9, flexWrap: 'wrap' }}>
                <div style={{ width: 100 }}>
                  <DepthField cm={batchCm} unit={unit} onChange={setBatchCm} />
                </div>
                {/* Unit toggle — display only. Everything downstream stays in cm. */}
                <div style={{ display: 'flex', border: '1px solid var(--bw-line)', borderRadius: 9, overflow: 'hidden', flex: 'none' }}>
                  {(['cm', 'in'] as const).map((u) => (
                    <button
                      key={u}
                      type="button"
                      onClick={() => setUnit(u)}
                      style={{ border: 0, padding: '8px 13px', fontSize: 12.5, fontWeight: 800, cursor: 'pointer', background: unit === u ? 'var(--bw-primary)' : 'var(--bw-surface)', color: unit === u ? 'var(--bw-on-accent)' : 'var(--bw-ink-soft)' }}
                    >
                      {u}
                    </button>
                  ))}
                </div>
                <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--bw-muted)' }}>
                  = {unit === 'cm' ? `${cmToIn(batchCm)} in` : `${batchCm} cm`}
                </span>
                <span style={{ fontSize: 11, fontWeight: 800, padding: '4px 10px', borderRadius: 999, background: SEV_META[batchSev].soft, color: SEV_META[batchSev].color }}>
                  {SEV_META[batchSev].label} · {ROAD_META[batchRoad].short}
                </span>
              </div>
              {/* The slider is the primary control; the box above it stays for typing an exact
                  figure straight off an advisory ("45 in"). Both write the same cm. */}
              <input
                type="range"
                min={toUnit(DEPTH_SLIDER_MIN_CM, unit)}
                max={toUnit(DEPTH_SLIDER_MAX_CM, unit)}
                step={1}
                value={toUnit(batchCm, unit)}
                onChange={(e) => setBatchCm(fromUnit(Number(e.target.value), unit))}
                style={{ width: '100%', margin: '11px 0 0', accentColor: SEV_META[batchSev].color, cursor: 'pointer' }}
              />
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10.5, color: 'var(--bw-faint)', fontWeight: 600 }}>
                <span>{formatDepth(DEPTH_SLIDER_MIN_CM)}</span>
                <span>{formatDepth(DEPTH_SLIDER_MAX_CM)}</span>
              </div>
              <div style={{ marginTop: 9 }}>
                <DepthReference depthCm={batchCm} color={SEV_META[batchSev].color} />
              </div>
              <div style={{ fontSize: 10.5, color: 'var(--bw-faint)', fontWeight: 600, marginTop: 8, lineHeight: 1.5 }}>
                Severity and road status are worked out from the depth, per location — tick a row below to give it its own depth.
              </div>
            </div>

            <div>
              <label style={labelStyle}>How long will it last?</label>
              <div style={{ display: 'flex', gap: 9, alignItems: 'center', flexWrap: 'wrap' }}>
                <select value={ttl} onChange={(e) => setTtl(e.target.value)} style={{ ...inputStyle, width: 'auto', minWidth: 240, flex: '0 1 auto' }}>
                  <option value={TTL_AUTO}>Auto — from each location's depth</option>
                  {TTL_FIXED_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label} — every location</option>)}
                  <option value={TTL_CUSTOM}>Custom…</option>
                </select>
                {ttl === TTL_CUSTOM && (
                  <>
                    <input
                      type="number"
                      min={1}
                      max={48}
                      value={customHours}
                      onChange={(e) => setCustomHours(e.target.value)}
                      style={{ ...inputStyle, width: 82 }}
                    />
                    <span style={{ fontSize: 12.5, color: 'var(--bw-muted)', fontWeight: 600 }}>hours</span>
                  </>
                )}
              </div>
              <div style={{ fontSize: 10.5, color: 'var(--bw-faint)', fontWeight: 600, marginTop: 5, lineHeight: 1.5 }}>
                {batchFixedMin === null ? (
                  <>
                    Each location gets its own estimate from how deep it is — about {formatDuration(drainMinutes(20, rainActive))} for
                    gutter-deep, {formatDuration(drainMinutes(152, rainActive))} for above-head.
                    {rainActive
                      ? ' Rain is falling, so every estimate is extended.'
                      : ' Turn on “Rain is falling now” in the admin console to extend them.'}
                  </>
                ) : (
                  `Every ticked location stays live for ${formatDuration(batchFixedMin)}, however deep it is.`
                )}
              </div>
            </div>
          </div>

          {/* ── Scope filters ──────────────────────────────────────────────────────── */}
          <div style={{ display: 'flex', gap: 9, flexWrap: 'wrap' }}>
            <select
              value={province}
              onChange={(e) => { setProvince(e.target.value); setCity(ALL); }}
              style={{ ...inputStyle, width: 'auto', flex: '1 1 150px' }}
            >
              <option value={ALL}>All provinces</option>
              {provinceOptions.map((p) => <option key={p} value={p}>{p}</option>)}
            </select>
            <select value={city} onChange={(e) => setCity(e.target.value)} style={{ ...inputStyle, width: 'auto', flex: '1 1 150px' }}>
              <option value={ALL}>All cities</option>
              {cityOptions.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
            <select value={tier} onChange={(e) => setTier(e.target.value)} style={{ ...inputStyle, width: 'auto', flex: '1 1 150px' }}>
              <option value={ALL}>All locations</option>
              <option value="1">Tier 1 — chronic</option>
              <option value="2">Tier 2 — situational</option>
            </select>
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search street or barangay…"
              style={{ ...inputStyle, width: 'auto', flex: '2 1 190px' }}
            />
          </div>

          {/* ── Selection toolbar ──────────────────────────────────────────────────── */}
          <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap' }}>
            <div style={{ fontSize: 12.5, fontWeight: 800, color: 'var(--bw-ink-soft)' }}>
              {checked.size} selected · {visible.length} shown
            </div>
            <div style={{ display: 'flex', gap: 13, flexWrap: 'wrap' }}>
              <button type="button" onClick={() => selectVisible(visible)} style={{ ...linkBtn, color: 'var(--bw-primary)' }}>Select shown</button>
              <button type="button" onClick={() => selectVisible(visible.filter((h) => h.tier === 1))} style={{ ...linkBtn, color: 'var(--bw-primary)' }}>Tier 1 only</button>
              <button type="button" onClick={() => setChecked(new Set())} style={{ ...linkBtn, color: 'var(--bw-muted)' }}>Select none</button>
              {checked.size > 0 && (
                <button type="button" onClick={useHistoricalDepths} title="Fill each ticked row with its own deepest recorded water" style={{ ...linkBtn, color: 'var(--bw-muted)' }}>
                  Use recorded maxima
                </button>
              )}
            </div>
          </div>

          {/* ── The list ───────────────────────────────────────────────────────────── */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
            {visible.length === 0 && (
              <div style={{ fontSize: 12.5, color: 'var(--bw-muted)', textAlign: 'center', padding: 20 }}>No hotspots match those filters.</div>
            )}
            {visible.map((h) => {
              const isChecked = checked.has(h.id);
              const blocked = already.has(h.id);
              const cm = depthOf(h);
              const sev = severityFromDepth(cm);
              const rowTtl = ttlOf(h);
              const depthOverridden = h.id in depths;
              const ttlOverridden = h.id in ttls;
              const custom = store.isCustom(h.id);
              return (
                <div
                  key={h.id}
                  style={{ border: `1px solid ${isChecked ? 'var(--bw-tint-info-border)' : 'var(--bw-line-soft)'}`, background: blocked ? 'var(--bw-bg-subtle)' : isChecked ? 'var(--bw-tint-info)' : 'var(--bw-surface)', opacity: blocked ? 0.6 : 1, borderRadius: 11, padding: '10px 12px' }}
                >
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, flexWrap: 'wrap' }}>
                    <input
                      type="checkbox"
                      checked={isChecked}
                      disabled={blocked}
                      onChange={() => toggle(h.id)}
                      style={{ marginTop: 3, flex: 'none' }}
                    />
                    <div style={{ flex: '1 1 210px', minWidth: 0 }}>
                      <div style={{ fontSize: 13, fontWeight: 800, display: 'flex', alignItems: 'center', gap: 7, flexWrap: 'wrap' }}>
                        {h.name}
                        {h.tier === 1 && (
                          <span style={{ fontSize: 9.5, fontWeight: 800, padding: '2px 7px', borderRadius: 999, background: 'var(--bw-tint-warn)', color: 'var(--bw-on-tint-warn)' }}>TIER 1</span>
                        )}
                        {custom && (
                          <span style={{ fontSize: 9.5, fontWeight: 800, padding: '2px 7px', borderRadius: 999, background: 'var(--bw-tint-ok)', color: 'var(--bw-on-tint-ok)' }}>YOURS</span>
                        )}
                      </div>
                      <div style={{ fontSize: 11.5, color: 'var(--bw-muted)', fontWeight: 600 }}>
                        {h.barangay ? `${h.barangay} · ` : ''}{h.city} · reported {h.timesReported} day{h.timesReported === 1 ? '' : 's'}
                      </div>
                      {blocked && <div style={{ fontSize: 10.5, color: 'var(--bw-faint)', marginTop: 2 }}>Already reported nearby</div>}
                      {h.pinNote && !blocked && (
                        <div style={{ fontSize: 10.5, color: 'var(--bw-faint)', marginTop: 2 }}>⚲ {h.pinNote}</div>
                      )}
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 7, flex: 'none' }}>
                      {/* Unticked rows stay a single scannable line — the sliders below only appear
                          once a row is actually going to be posted. 32 always-on slider pairs would
                          make the list unusable to scroll during an event. */}
                      {!isChecked && (
                        <span style={{ fontSize: 11.5, fontWeight: 700, color: 'var(--bw-muted)', flex: 'none' }}>
                          {formatDepthShort(cm)} · {formatDuration(rowTtl)}
                        </span>
                      )}
                      <span style={{ fontSize: 10.5, fontWeight: 800, padding: '3px 8px', borderRadius: 999, background: SEV_META[sev].soft, color: SEV_META[sev].color, flex: 'none' }}>
                        {SEV_META[sev].label}
                      </span>
                      <button
                        type="button"
                        onClick={() => setPinEditId((cur) => (cur === h.id ? null : h.id))}
                        title="Adjust this pin"
                        style={{ border: '1px solid var(--bw-line)', background: 'var(--bw-surface)', color: 'var(--bw-ink-soft)', padding: '5px 9px', borderRadius: 8, fontSize: 12, fontWeight: 700, cursor: 'pointer', flex: 'none' }}
                      >
                        ⚲
                      </button>
                      {custom && (
                        <button
                          type="button"
                          onClick={() => { store.removeCustomHotspot(h.id); setChecked((s) => { const n = new Set(s); n.delete(h.id); return n; }); reload(); }}
                          title="Remove this hotspot"
                          style={{ border: '1px solid var(--bw-tint-danger-border)', background: 'var(--bw-tint-danger)', color: 'var(--bw-on-tint-danger)', padding: '5px 9px', borderRadius: 8, fontSize: 12, fontWeight: 700, cursor: 'pointer', flex: 'none' }}
                        >
                          ✕
                        </button>
                      )}
                    </div>
                  </div>
                  {/* Ticked ⇒ this row's own depth and lifetime. Both fall back to a derived value
                      (batch depth / depth-based estimate) until dragged, so the common case needs
                      no interaction at all — see `depthOf` and `ttlOf`. */}
                  {isChecked && (
                    <div style={{ marginTop: 9, paddingTop: 9, borderTop: '1px solid var(--bw-line-soft)', display: 'flex', flexDirection: 'column', gap: 7 }}>
                      <SliderRow
                        label="depth"
                        min={toUnit(DEPTH_SLIDER_MIN_CM, unit)}
                        max={toUnit(DEPTH_SLIDER_MAX_CM, unit)}
                        step={1}
                        value={toUnit(cm, unit)}
                        onChange={(v) => setRowDepth(h.id, fromUnit(v, unit))}
                        color={SEV_META[sev].color}
                        readout={formatDepth(cm)}
                        aside={
                          depthOverridden ? (
                            <button type="button" onClick={() => resetRowDepth(h.id)} title="Back to the batch depth" style={{ ...linkBtn, color: 'var(--bw-muted)', fontSize: 14 }}>⟲</button>
                          ) : (
                            <button type="button" onClick={() => setRowDepth(h.id, h.maxDepthCm)} title={`Use this location's deepest recorded water (${formatDepth(h.maxDepthCm)})`} style={{ ...linkBtn, color: 'var(--bw-faint)', fontSize: 10.5 }}>
                              max {formatDepthShort(h.maxDepthCm)}
                            </button>
                          )
                        }
                      />
                      <SliderRow
                        label="lasts"
                        min={0}
                        max={TTL_STOPS_MIN.length - 1}
                        step={1}
                        value={TTL_STOPS_MIN.indexOf(nearestTtlStop(rowTtl))}
                        onChange={(i) => setRowTtl(h.id, TTL_STOPS_MIN[i])}
                        color="var(--bw-primary)"
                        readout={formatDuration(rowTtl)}
                        aside={
                          ttlOverridden ? (
                            <button type="button" onClick={() => resetRowTtl(h.id)} title={batchFixedMin === null ? 'Back to the estimate from this depth' : 'Back to the batch duration'} style={{ ...linkBtn, color: 'var(--bw-muted)', fontSize: 14 }}>⟲</button>
                          ) : (
                            <span style={{ fontSize: 10.5, color: 'var(--bw-faint)', fontWeight: 700 }}>
                              {batchFixedMin === null ? 'estimated' : 'batch'}
                            </span>
                          )
                        }
                      />
                    </div>
                  )}
                  {pinEditId === h.id && (
                    <div style={{ marginTop: 10 }}>
                      <MapPickField lat={h.lat} lng={h.lng} onPick={(la, ln) => movePin(h.id, la, ln)} />
                      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 6 }}>
                        <span style={{ fontSize: 10.5, color: 'var(--bw-faint)', fontWeight: 600 }}>
                          {h.lat.toFixed(5)}, {h.lng.toFixed(5)} — tap the map to move it. Saved on this device only.
                        </span>
                        {store.hasPinOverride(h.id) && !custom && (
                          <button type="button" onClick={() => { store.clearPin(h.id); reload(); }} style={{ ...linkBtn, color: 'var(--bw-primary)' }}>Reset pin</button>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          <AddHotspotForm
            open={addOpen}
            userLoc={userLoc}
            onOpen={() => setAddOpen(true)}
            onCancel={() => setAddOpen(false)}
            onAdd={(h) => { const row = store.addCustomHotspot(h); reload(); setChecked((s) => new Set(s).add(row.id)); setAddOpen(false); }}
          />

          <div style={{ fontSize: 10.5, color: 'var(--bw-faint)', fontWeight: 600, lineHeight: 1.6, paddingBottom: 14 }}>
            These post as plain system reports — no auto-post to Facebook or X, so a batch never turns into a
            wall of posts. Share a roundup afterwards with the flood digest. Hotspots you add and pins you move
            are saved in this browser only; other admins still see the built-in list.
          </div>
        </div>
      </div>

      {/* Footer */}
      <div style={{ flex: 'none', borderTop: '1px solid var(--bw-line-soft)', background: 'var(--bw-surface)', padding: isMobile ? '11px 14px' : '12px 22px' }}>
        <div style={{ maxWidth: 780, margin: '0 auto' }}>
          {confirming && (
            <div style={{ background: 'var(--bw-tint-warn)', border: '1px solid var(--bw-tint-warn-border)', color: 'var(--bw-on-tint-warn)', borderRadius: 10, padding: '9px 12px', fontSize: 12.5, fontWeight: 700, marginBottom: 9 }}>
              This posts {picked.length} flood reports to the public map at once. Tap again to confirm.
            </div>
          )}
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
            <div style={{ flex: '1 1 190px', fontSize: 11.5, color: 'var(--bw-muted)', fontWeight: 700 }}>
              {picked.length === 0
                ? 'Nothing selected yet.'
                : `${picked.length} location${picked.length === 1 ? '' : 's'} · ${formatDepthRange(Math.min(...picked.map((p) => p.depthCm)), Math.max(...picked.map((p) => p.depthCm)))} · ${spanLabel(picked.map((p) => p.ttlMinutes))} live`}
            </div>
            <button
              onClick={onReportClick}
              disabled={picked.length === 0 || busy}
              style={{ flex: '1 1 210px', border: 0, background: confirming ? 'var(--bw-danger)' : 'var(--bw-primary-deep)', color: 'var(--bw-on-accent)', padding: 13, borderRadius: 11, fontSize: 13.5, fontWeight: 800, cursor: picked.length === 0 || busy ? 'not-allowed' : 'pointer', opacity: picked.length === 0 || busy ? 0.6 : 1 }}
            >
              {busy ? 'Posting…' : confirming ? `Yes — post ${picked.length} reports` : `⚡ Report ${picked.length || ''} location${picked.length === 1 ? '' : 's'}`}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

/**
 * "+ Add hotspot" — the escape hatch for a corridor the bundled catalog doesn't carry. Reuses the
 * same PlaceField + reverse-geocode wiring as AdminReportIncidentModal, so a pick fills the name
 * and district the way admins already expect. Saved rows are this device's only (hotspotStore).
 */
const AddHotspotForm: React.FC<{
  open: boolean;
  userLoc: LatLng;
  onOpen: () => void;
  onCancel: () => void;
  onAdd: (h: Omit<FloodHotspot, 'id'>) => void;
}> = ({ open, userLoc, onOpen, onCancel, onAdd }) => {
  const [lat, setLat] = React.useState('');
  const [lng, setLng] = React.useState('');
  const [placeLabel, setPlaceLabel] = React.useState('');
  const [name, setName] = React.useState('');
  const [district, setDistrict] = React.useState('');
  const [barangay, setBarangay] = React.useState('');
  const [depth, setDepth] = React.useState(SEVERITY_PRESET.medium.depthCm);

  const reset = (): void => { setLat(''); setLng(''); setPlaceLabel(''); setName(''); setDistrict(''); setBarangay(''); };

  const onPick = (la: number, ln: number, label: string, ctx?: { primary: string; context: string }): void => {
    setLat(String(la));
    setLng(String(ln));
    setPlaceLabel(label);
    const firstSeg = ctx?.primary || label.split(',')[0]?.trim();
    if (firstSeg) setName((n) => n || firstSeg);
    if (ctx?.context) setDistrict((d) => d || ctx.context);
    void reverseGeocode(la, ln).then((g) => {
      const street = g.road ?? g.barangay ?? firstSeg ?? '';
      if (street) setName(street);
      // District must land in the app's "City, Province" shape or the city filter (and the posted
      // report's district) inherit whatever sub-area Nominatim happened to return — for Katipunan
      // that's "3rd District", which is not a city. `g.city` is the resolved PH city/municipality,
      // so prefer it and keep only the province half of `g.district` behind it.
      const province = g.district?.includes(',') ? g.district.split(',').pop()!.trim() : '';
      const resolved = g.city ? (province ? `${g.city}, ${province}` : g.city) : g.district;
      if (resolved) setDistrict(resolved);
      if (g.barangay) setBarangay(g.barangay);
    });
  };

  if (!open) {
    return (
      <button onClick={onOpen} style={{ width: '100%', border: '1px dashed var(--bw-primary)', background: 'var(--bw-tint-info)', color: 'var(--bw-primary)', padding: 11, borderRadius: 10, fontSize: 13, fontWeight: 800, cursor: 'pointer' }}>
        + Add a hotspot
      </button>
    );
  }

  const hasCoords = lat !== '' && lng !== '';
  const canAdd = hasCoords && name.trim() !== '';

  return (
    <div style={{ background: 'var(--bw-surface)', border: '1px solid var(--bw-line-soft)', borderRadius: 13, padding: 14, display: 'flex', flexDirection: 'column', gap: 11 }}>
      <div style={{ fontSize: 13.5, fontWeight: 800 }}>Add a hotspot</div>
      <div>
        <label style={labelStyle}>Location</label>
        <PlaceField lat={lat} lng={lng} placeLabel={placeLabel} onPick={onPick} near={userLoc} />
        <div style={{ marginTop: 8 }}>
          <MapPickField
            lat={hasCoords ? Number(lat) : userLoc.lat}
            lng={hasCoords ? Number(lng) : userLoc.lng}
            pinned={hasCoords}
            onPick={(la, ln) => onPick(la, ln, placeLabel)}
          />
        </div>
      </div>
      <div>
        <label style={labelStyle}>Name</label>
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Aurora Blvd cor. Katipunan Ave" style={inputStyle} />
      </div>
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
        <div style={{ flex: '1 1 190px' }}>
          <label style={labelStyle}>District</label>
          <input value={district} onChange={(e) => setDistrict(e.target.value)} placeholder="City, Province — e.g. Quezon City, Metro Manila" style={inputStyle} />
        </div>
        <div style={{ flex: '1 1 190px' }}>
          <label style={labelStyle}>Barangay <span style={{ fontWeight: 600 }}>(optional)</span></label>
          <input value={barangay} onChange={(e) => setBarangay(e.target.value)} style={inputStyle} />
        </div>
      </div>
      <div style={{ maxWidth: 200 }}>
        <label style={labelStyle}>Typical depth here (cm)</label>
        <DepthField cm={depth} unit="cm" onChange={setDepth} />
        {/* The field itself takes cm; echo both units so this form reads like every other depth
            readout in the app rather than being the one cm-only corner. */}
        <div style={{ fontSize: 10.5, fontWeight: 700, color: 'var(--bw-faint)', marginTop: 4 }}>{formatDepth(depth)}</div>
      </div>
      <div style={{ display: 'flex', gap: 9 }}>
        <button
          onClick={() => {
            const d = district.trim() || 'Unknown area';
            onAdd({
              name: name.trim(),
              barangay: barangay.trim() || null,
              city: cityOf(d),
              district: d,
              lat: Number(lat),
              lng: Number(lng),
              tier: 2,
              timesReported: 0,
              maxDepthCm: depth,
            });
            reset();
          }}
          disabled={!canAdd}
          style={{ flex: 1, border: 0, background: 'var(--bw-primary)', color: 'var(--bw-on-accent)', padding: 11, borderRadius: 10, fontSize: 13, fontWeight: 800, cursor: canAdd ? 'pointer' : 'not-allowed', opacity: canAdd ? 1 : 0.6 }}
        >
          Add hotspot
        </button>
        <button onClick={() => { reset(); onCancel(); }} style={{ border: '1px solid var(--bw-line)', background: 'var(--bw-surface)', color: 'var(--bw-ink-soft)', padding: '11px 16px', borderRadius: 10, fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>
          Cancel
        </button>
      </div>
    </div>
  );
};

export default AdminQuickReportView;
