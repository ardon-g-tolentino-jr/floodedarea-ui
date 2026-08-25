import React from 'react';
import type { AlertLevel, FloodAlert, FloodProneArea, WarnArea } from '../../types';
import { cityOf, islandOf, provinceOf, ISLAND_GROUPS, type IslandGroup } from '../../utils/phGeo';

/**
 * Admin-only "Warn an area" modal — the scoped counterpart to the single-zone AdminWarnZoneModal.
 * Cascading island/province/city/area dropdowns narrow the ~400-zone national list down to a
 * region, then broadcast one warning per zone in that scope (or clear existing warnings in it).
 * Mirrors ZoneReportModal's structure/styling/checklist and AdminWarnZoneModal's warn fields —
 * this posts alerts (broadcasts), not flood reports, so title/body/level replace severity/depth.
 */
interface Props {
  isMobile: boolean;
  /** Active zones only — the parent filters out inactive ones before mounting this modal. */
  zones: FloodProneArea[];
  /** Current alert list — used to show how many active warnings already exist in the picked scope. */
  alerts: FloodAlert[];
  onWarn: (picked: FloodProneArea[], body: WarnArea) => Promise<{ ok: number; failed: string[] }>;
  onClearWarnings: (picked: FloodProneArea[]) => Promise<{ ok: number; failed: string[] }>;
  onClose: () => void;
}

const ALL = 'All' as const;
type Choice<T extends string> = typeof ALL | T;

const LEVEL_OPTIONS: { value: AlertLevel; label: string }[] = [
  { value: 'yellow', label: 'Yellow' },
  { value: 'orange', label: 'Orange' },
  { value: 'red', label: 'Red' },
];

// A scope-wide warn can hit hundreds of zones — each one is its own alert + SSE broadcast, so
// past this many the admin must explicitly acknowledge the blast radius before it fires.
const BULK_CONFIRM_THRESHOLD = 25;

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

/** Count occurrences of each key, alphabetical by key. */
function tally(keys: string[]): { key: string; count: number }[] {
  const m = new Map<string, number>();
  for (const k of keys) m.set(k, (m.get(k) ?? 0) + 1);
  return [...m.entries()].map(([key, count]) => ({ key, count })).sort((a, b) => a.key.localeCompare(b.key));
}

const AdminScopedWarnModal: React.FC<Props> = ({ isMobile, zones, alerts, onWarn, onClearWarnings, onClose }) => {
  const [island, setIsland] = React.useState<Choice<IslandGroup>>(ALL);
  const [province, setProvince] = React.useState<Choice<string>>(ALL);
  const [city, setCity] = React.useState<Choice<string>>(ALL);
  const [area, setArea] = React.useState<Choice<string>>(ALL); // zone id, as a string

  // Each level's candidate zones are filtered by every level ABOVE it only — this is also the
  // scope-derivation chain: the narrowest non-'All' selection's zone list IS the effective scope.
  const zonesInIsland = React.useMemo(
    () => (island === ALL ? zones : zones.filter((z) => islandOf(z.district) === island)),
    [zones, island]
  );
  const zonesInProvince = React.useMemo(
    () => (province === ALL ? zonesInIsland : zonesInIsland.filter((z) => provinceOf(z.district) === province)),
    [zonesInIsland, province]
  );
  const zonesInCity = React.useMemo(
    () => (city === ALL ? zonesInProvince : zonesInProvince.filter((z) => cityOf(z.district) === city)),
    [zonesInProvince, city]
  );
  const scopedZones = React.useMemo(
    () => (area === ALL ? zonesInCity : zonesInCity.filter((z) => String(z.id) === area)),
    [zonesInCity, area]
  );

  // Dropdown options, each labelled with the zone count it represents.
  const islandOptions = React.useMemo(
    () => ISLAND_GROUPS.map((g) => ({ value: g, count: zones.filter((z) => islandOf(z.district) === g).length })),
    [zones]
  );
  const provinceOptions = React.useMemo(
    () => tally(zonesInIsland.map((z) => provinceOf(z.district))),
    [zonesInIsland]
  );
  const cityOptions = React.useMemo(
    () => tally(zonesInProvince.map((z) => cityOf(z.district))),
    [zonesInProvince]
  );
  const areaOptions = React.useMemo(
    () => [...zonesInCity].sort((a, b) => a.name.localeCompare(b.name)),
    [zonesInCity]
  );

  const scopeLabel = area !== ALL
    ? (zones.find((z) => String(z.id) === area)?.name ?? 'this area')
    : city !== ALL
      ? city
      : province !== ALL
        ? province
        : island !== ALL
          ? island
          : 'all flood-prone areas';

  // Resetting a higher level clears every level below it.
  const chooseIsland = (v: Choice<IslandGroup>): void => { setIsland(v); setProvince(ALL); setCity(ALL); setArea(ALL); };
  const chooseProvince = (v: Choice<string>): void => { setProvince(v); setCity(ALL); setArea(ALL); };
  const chooseCity = (v: Choice<string>): void => { setCity(v); setArea(ALL); };

  // Checklist: ticked by default, individually untickable. Re-deriving the scope (any dropdown
  // change) re-ticks everything — a stale partial selection from a prior scope must never carry over.
  const [checked, setChecked] = React.useState<Set<number>>(() => new Set(scopedZones.map((z) => z.id)));
  React.useEffect(() => {
    setChecked(new Set(scopedZones.map((z) => z.id)));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [island, province, city, area]);
  const toggle = (id: number): void =>
    setChecked((s) => {
      const next = new Set(s);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });

  const picked = scopedZones.filter((z) => checked.has(z.id));
  const pickedIds = React.useMemo(() => new Set(picked.map((z) => z.id)), [picked]);
  const activeWarningsInScope = React.useMemo(
    () => alerts.filter((a) => a.active && a.areaId != null && pickedIds.has(a.areaId)).length,
    [alerts, pickedIds]
  );

  // Warn-fields defaults track the scope label, but only while the admin hasn't typed their own
  // text — tracked via refs of the last auto-generated value so an edited field is never clobbered.
  const autoTitle = (label: string): string => `Heavy rain over ${label}`;
  const autoBody = (label: string): string => `Flooding is likely in flood-prone areas across ${label}. Avoid low-lying roads and monitor conditions.`;
  const [title, setTitle] = React.useState(() => autoTitle(scopeLabel));
  const [body, setBody] = React.useState(() => autoBody(scopeLabel));
  const [level, setLevel] = React.useState<AlertLevel>('orange');
  const lastAutoTitle = React.useRef(title);
  const lastAutoBody = React.useRef(body);
  React.useEffect(() => {
    const nextTitle = autoTitle(scopeLabel);
    const nextBody = autoBody(scopeLabel);
    setTitle((t) => (t === lastAutoTitle.current ? nextTitle : t));
    setBody((b) => (b === lastAutoBody.current ? nextBody : b));
    lastAutoTitle.current = nextTitle;
    lastAutoBody.current = nextBody;
  }, [scopeLabel]);

  // >25 picked zones needs an explicit inline acknowledgment before Warn fires — tracked by the
  // exact count so re-picking a different set of the same size still requires re-confirming isn't
  // strictly necessary, but simplest/safest is: any change in count clears a stale confirmation.
  const [confirmedCount, setConfirmedCount] = React.useState<number | null>(null);
  const needsConfirm = picked.length > BULK_CONFIRM_THRESHOLD && confirmedCount !== picked.length;

  const [busy, setBusy] = React.useState<'warn' | 'clear' | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  const submitWarn = async (): Promise<void> => {
    if (busy || picked.length === 0 || needsConfirm) return;
    setBusy('warn');
    setError(null);
    try {
      const result = await onWarn(picked, { title: title.trim() || undefined, body: body.trim() || undefined, level });
      if (result.failed.length > 0) {
        setError(`Warned ${result.ok} of ${picked.length}. Failed: ${result.failed.join(', ')}.`);
      } else {
        onClose();
      }
    } catch {
      setError('Could not send the warnings. Please try again.');
    } finally {
      setBusy(null);
    }
  };

  const submitClear = async (): Promise<void> => {
    if (busy || activeWarningsInScope === 0) return;
    setBusy('clear');
    setError(null);
    try {
      const result = await onClearWarnings(picked);
      // The denominator here is what was actually attempted (ok + failed), not picked.length —
      // most picked zones typically have no active warning at all, so they're never attempted.
      const attempted = result.ok + result.failed.length;
      if (result.failed.length > 0) {
        setError(`Cleared ${result.ok} of ${attempted}. Failed: ${result.failed.join(', ')}.`);
      } else {
        onClose();
      }
    } catch {
      setError('Could not clear warnings. Please try again.');
    } finally {
      setBusy(null);
    }
  };

  const card = (
    <div
      onClick={(e) => e.stopPropagation()}
      style={{ width: 480, maxWidth: '100%', maxHeight: '90vh', display: 'flex', flexDirection: 'column', background: 'var(--bw-surface)', borderRadius: isMobile ? '20px 20px 0 0' : 20, boxShadow: '0 24px 70px rgba(15,23,42,.4)', overflow: 'hidden', animation: isMobile ? 'sheetUp .22s ease-out' : 'popIn .16s ease-out' }}
    >
      {/* Header */}
      <div style={{ background: 'linear-gradient(135deg,var(--bw-warn),var(--bw-on-tint-warn))', padding: '16px 20px', color: 'var(--bw-on-accent)', display: 'flex', alignItems: 'center', gap: 12 }}>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 16, fontWeight: 800 }}>⚠ Warn an area</div>
          <div style={{ fontSize: 12, opacity: 0.9 }}>Broadcast a warning across a region of flood-prone zones.</div>
        </div>
        <button onClick={onClose} style={{ border: 0, background: 'rgba(255,255,255,.18)', color: 'var(--bw-on-accent)', width: 28, height: 28, borderRadius: 8, fontSize: 16, cursor: 'pointer', flex: 'none' }}>×</button>
      </div>

      {/* Body */}
      <div style={{ padding: '15px 20px', overflowY: 'auto', flex: 1, display: 'flex', flexDirection: 'column', gap: 12 }}>
        {error && (
          <div style={{ background: 'var(--bw-tint-danger)', color: 'var(--bw-on-tint-danger)', padding: '8px 11px', borderRadius: 9, fontSize: 12.5, fontWeight: 600 }}>{error}</div>
        )}

        {/* Cascading scope pickers */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 9 }}>
          <div>
            <label style={labelStyle}>Island group</label>
            <select value={island} onChange={(e) => chooseIsland(e.target.value as Choice<IslandGroup>)} style={inputStyle}>
              <option value={ALL}>All ({zones.length})</option>
              {islandOptions.map((o) => <option key={o.value} value={o.value}>{o.value} ({o.count})</option>)}
            </select>
          </div>
          <div>
            <label style={labelStyle}>Province</label>
            <select value={province} onChange={(e) => chooseProvince(e.target.value)} style={inputStyle}>
              <option value={ALL}>All in {island === ALL ? 'Philippines' : island} ({zonesInIsland.length})</option>
              {provinceOptions.map((o) => <option key={o.key} value={o.key}>{o.key} ({o.count})</option>)}
            </select>
          </div>
          <div>
            <label style={labelStyle}>City / municipality</label>
            <select value={city} onChange={(e) => chooseCity(e.target.value)} style={inputStyle}>
              <option value={ALL}>All in {province === ALL ? (island === ALL ? 'Philippines' : island) : province} ({zonesInProvince.length})</option>
              {cityOptions.map((o) => <option key={o.key} value={o.key}>{o.key} ({o.count})</option>)}
            </select>
          </div>
          <div>
            <label style={labelStyle}>Area</label>
            <select value={area} onChange={(e) => setArea(e.target.value)} style={inputStyle}>
              <option value={ALL}>All in {city === ALL ? (province === ALL ? (island === ALL ? 'Philippines' : island) : province) : city} ({zonesInCity.length})</option>
              {areaOptions.map((z) => <option key={z.id} value={String(z.id)}>{z.name}</option>)}
            </select>
          </div>
        </div>

        {/* Scope label + live count */}
        <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between' }}>
          <span style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--bw-ink)' }}>{scopeLabel}</span>
          <span style={{ fontSize: 12, fontWeight: 800, color: 'var(--bw-primary-deep)' }}>{picked.length} zone{picked.length === 1 ? '' : 's'} selected</span>
        </div>

        {/* Checklist */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 200, overflowY: 'auto' }}>
          {scopedZones.length === 0 && (
            <div style={{ fontSize: 12.5, color: 'var(--bw-muted)', textAlign: 'center', padding: 14 }}>No zones in this scope.</div>
          )}
          {scopedZones.map((z) => {
            const isChecked = checked.has(z.id);
            return (
              <label
                key={z.id}
                style={{ display: 'flex', alignItems: 'flex-start', gap: 9, padding: '9px 10px', borderRadius: 10, border: `1px solid ${isChecked ? 'var(--bw-tint-warn-border)' : 'var(--bw-line-soft)'}`, background: isChecked ? 'var(--bw-tint-warn)' : 'var(--bw-surface)', cursor: 'pointer' }}
              >
                <input type="checkbox" checked={isChecked} onChange={() => toggle(z.id)} style={{ marginTop: 2, flex: 'none' }} />
                <span style={{ flex: 1, minWidth: 0 }}>
                  <span style={{ display: 'block', fontSize: 13, fontWeight: 800 }}>{z.name}</span>
                  <span style={{ display: 'block', fontSize: 11.5, color: 'var(--bw-muted)', fontWeight: 600 }}>{z.district} · {z.level.toUpperCase()}</span>
                </span>
              </label>
            );
          })}
        </div>

        {/* Warn fields */}
        <div>
          <label style={labelStyle}>Title</label>
          <input value={title} onChange={(e) => setTitle(e.target.value)} style={inputStyle} />
        </div>
        <div>
          <label style={labelStyle}>Body</label>
          <textarea value={body} onChange={(e) => setBody(e.target.value)} rows={3} style={{ ...inputStyle, resize: 'vertical' }} />
        </div>
        <div>
          <label style={labelStyle}>Level</label>
          <div style={{ display: 'flex', gap: 7 }}>
            {LEVEL_OPTIONS.map((o) => (
              <button
                key={o.value}
                type="button"
                onClick={() => setLevel(o.value)}
                style={{ flex: 1, padding: '9px 8px', borderRadius: 10, cursor: 'pointer', border: `1.5px solid ${level === o.value ? 'var(--bw-on-tint-warn)' : 'var(--bw-line)'}`, background: level === o.value ? 'var(--bw-tint-warn)' : 'var(--bw-surface)', color: level === o.value ? 'var(--bw-on-tint-warn)' : 'var(--bw-ink)', fontSize: 12.5, fontWeight: 800 }}
              >
                {o.label}
              </button>
            ))}
          </div>
        </div>

        {activeWarningsInScope > 0 && (
          <div style={{ fontSize: 11, color: 'var(--bw-faint)' }}>
            {activeWarningsInScope} active warning{activeWarningsInScope === 1 ? '' : 's'} already broadcast in this scope.
          </div>
        )}

        {/* Bulk confirmation — a scope-wide warn creates one alert (and one SSE broadcast) per
            zone, so past the threshold the admin must explicitly acknowledge the blast radius. */}
        {picked.length > BULK_CONFIRM_THRESHOLD && confirmedCount !== picked.length && (
          <div style={{ padding: '10px 12px', background: 'var(--bw-tint-warn)', border: '1px solid var(--bw-tint-warn-border)', borderRadius: 10, fontSize: 12, color: 'var(--bw-on-tint-warn)', fontWeight: 600, lineHeight: 1.5, display: 'flex', flexDirection: 'column', gap: 8 }}>
            <span>This creates {picked.length} separate alerts. Confirm before sending.</span>
            <button
              type="button"
              onClick={() => setConfirmedCount(picked.length)}
              style={{ alignSelf: 'flex-start', border: '1px solid var(--bw-tint-warn-border)', background: 'var(--bw-surface)', color: 'var(--bw-on-tint-warn)', padding: '6px 12px', borderRadius: 8, fontSize: 11.5, fontWeight: 800, cursor: 'pointer' }}
            >
              Yes, warn {picked.length} areas
            </button>
          </div>
        )}
      </div>

      {/* Footer */}
      <div style={{ padding: '12px 20px', borderTop: '1px solid var(--bw-line-soft)', display: 'flex', gap: 9 }}>
        <button
          onClick={() => void submitClear()}
          disabled={!!busy || picked.length === 0 || activeWarningsInScope === 0}
          style={{ flex: 1, border: '1px solid var(--bw-line)', background: 'var(--bw-surface)', color: 'var(--bw-ink-soft)', padding: 12, borderRadius: 11, fontSize: 13, fontWeight: 800, cursor: !busy && picked.length > 0 && activeWarningsInScope > 0 ? 'pointer' : 'not-allowed', opacity: !busy && picked.length > 0 && activeWarningsInScope > 0 ? 1 : 0.6 }}
        >
          {busy === 'clear' ? 'Clearing…' : activeWarningsInScope > 0 ? `Clear ${activeWarningsInScope} warning${activeWarningsInScope === 1 ? '' : 's'} in scope` : 'Clear warnings in scope'}
        </button>
        <button
          onClick={() => void submitWarn()}
          disabled={!!busy || picked.length === 0 || needsConfirm}
          style={{ flex: 1, border: 0, background: 'var(--bw-on-tint-warn)', color: 'var(--bw-on-accent)', padding: 12, borderRadius: 11, fontSize: 13.5, fontWeight: 800, cursor: !busy && picked.length > 0 && !needsConfirm ? 'pointer' : 'not-allowed', opacity: !busy && picked.length > 0 && !needsConfirm ? 1 : 0.6 }}
        >
          {busy === 'warn' ? `Warning ${picked.length} area${picked.length === 1 ? '' : 's'}…` : `⚠ Warn ${picked.length} area${picked.length === 1 ? '' : 's'}`}
        </button>
      </div>
    </div>
  );

  // zIndex 1300, not the usual 1200: this modal is opened FROM the admin console, which also sits
  // at 1200 and renders later in App's JSX — at an equal z-index the console wins the tie and
  // buries this behind it. Same reasoning as ZoneReportModal/AdminWarnZoneModal.
  return (
    <div
      onClick={onClose}
      style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,.55)', backdropFilter: 'blur(3px)', zIndex: 1300, display: 'flex', alignItems: isMobile ? 'flex-end' : 'center', justifyContent: 'center', padding: isMobile ? 0 : 18 }}
    >
      {card}
    </div>
  );
};

export default AdminScopedWarnModal;
