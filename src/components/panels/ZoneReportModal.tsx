import React from 'react';
import type { FloodProneArea, Severity } from '../../types';
import { DEPTH_RANGE, SEVERITY_PRESET, SEV_META, TTL_OPTIONS } from '../../utils/floodMeta';
import DepthReference from './DepthReference';

/** What ZoneReportModal hands back to App's `reportZones` for every ticked zone. */
export interface ZoneReportOptions {
  severity: Severity;
  depthCm: number;
  ttlMinutes?: number;
}

/**
 * Admin-only "Report flooding on zones" modal — turns one or more quiet flood-prone zones into
 * live system reports in one pass. Opened either from AdminPanel's zones tab (every active zone
 * ticked, minus ones already reported nearby) or from a single zone's "⚡ Report now" row/map
 * bubble (only that zone ticked). Distinct from AdminWarnZoneModal: this posts flood REPORTS
 * (crowd-sourced-looking "water is here now" pins with a TTL), not a broadcast alert.
 */
interface Props {
  isMobile: boolean;
  /** Active zones only — the parent filters out inactive ones before mounting this modal. */
  zones: FloodProneArea[];
  /** Ids that already have a live system report nearby — rendered disabled, start unticked. */
  alreadyReportedIds: number[];
  /** Set when opened from one row / one map bubble — only that zone starts ticked. */
  preselectId?: number | null;
  onSubmit: (picked: FloodProneArea[], o: ZoneReportOptions) => Promise<{ ok: number; failed: string[] }>;
  onClose: () => void;
}

const SEV_ORDER: Severity[] = ['high', 'medium', 'low'];

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

const ZoneReportModal: React.FC<Props> = ({ isMobile, zones, alreadyReportedIds, preselectId, onSubmit, onClose }) => {
  const alreadySet = React.useMemo(() => new Set(alreadyReportedIds), [alreadyReportedIds]);
  const [checked, setChecked] = React.useState<Set<number>>(() => {
    if (preselectId != null) return new Set([preselectId]);
    return new Set(zones.filter((z) => !alreadySet.has(z.id)).map((z) => z.id));
  });
  const [severity, setSeverity] = React.useState<Severity>('high');
  const [depth, setDepth] = React.useState(SEVERITY_PRESET.high.depthCm);
  const [ttl, setTtl] = React.useState('');
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const toggle = (id: number): void =>
    setChecked((s) => {
      const next = new Set(s);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  const selectAll = (): void => setChecked(new Set(zones.filter((z) => !alreadySet.has(z.id)).map((z) => z.id)));
  const selectNone = (): void => setChecked(new Set());

  const chooseSeverity = (s: Severity): void => {
    setSeverity(s);
    setDepth(SEVERITY_PRESET[s].depthCm);
  };

  const picked = zones.filter((z) => checked.has(z.id));
  const canPost = picked.length > 0 && !busy;

  const submit = async (): Promise<void> => {
    if (!canPost) return;
    setBusy(true);
    setError(null);
    try {
      const result = await onSubmit(picked, { severity, depthCm: depth, ttlMinutes: ttl ? Number(ttl) : undefined });
      if (result.failed.length > 0) {
        // Partial failure: keep the modal open so the admin can see what still needs a retry
        // (they stay ticked — resubmitting only re-posts the same selection).
        setError(`Posted ${result.ok} of ${picked.length}. Failed: ${result.failed.join(', ')}.`);
      } else {
        onClose();
      }
    } catch {
      setError('Could not post the reports. Please try again.');
    } finally {
      setBusy(false);
    }
  };

  const range = DEPTH_RANGE[severity];

  const card = (
    <div
      onClick={(e) => e.stopPropagation()}
      style={{ width: 460, maxWidth: '100%', maxHeight: '90vh', display: 'flex', flexDirection: 'column', background: '#fff', borderRadius: isMobile ? '20px 20px 0 0' : 20, boxShadow: '0 24px 70px rgba(15,23,42,.4)', overflow: 'hidden', animation: isMobile ? 'sheetUp .22s ease-out' : 'popIn .16s ease-out' }}
    >
      {/* Header */}
      <div style={{ background: 'linear-gradient(135deg,#0EA5E9,#0369A1)', padding: '16px 20px', color: '#fff', display: 'flex', alignItems: 'center', gap: 12 }}>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 16, fontWeight: 800 }}>⚡ Report flooding on zones</div>
          <div style={{ fontSize: 12, opacity: 0.9 }}>Turn flood-prone zones into live system reports.</div>
        </div>
        <button onClick={onClose} style={{ border: 0, background: 'rgba(255,255,255,.18)', color: '#fff', width: 28, height: 28, borderRadius: 8, fontSize: 16, cursor: 'pointer', flex: 'none' }}>×</button>
      </div>

      {/* Body */}
      <div style={{ padding: '15px 20px', overflowY: 'auto', flex: 1, display: 'flex', flexDirection: 'column', gap: 12 }}>
        {error && (
          <div style={{ background: '#FEF2F2', color: '#B91C1C', padding: '8px 11px', borderRadius: 9, fontSize: 12.5, fontWeight: 600 }}>{error}</div>
        )}

        <div>
          <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 6 }}>
            <label style={{ ...labelStyle, marginBottom: 0 }}>Zones ({checked.size} selected)</label>
            <div style={{ display: 'flex', gap: 10 }}>
              <button type="button" onClick={selectAll} style={{ border: 0, background: 'transparent', color: 'var(--bw-primary)', fontSize: 11.5, fontWeight: 800, cursor: 'pointer', padding: 0 }}>Select all</button>
              <button type="button" onClick={selectNone} style={{ border: 0, background: 'transparent', color: 'var(--bw-muted)', fontSize: 11.5, fontWeight: 800, cursor: 'pointer', padding: 0 }}>Select none</button>
            </div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 220, overflowY: 'auto' }}>
            {zones.length === 0 && (
              <div style={{ fontSize: 12.5, color: 'var(--bw-muted)', textAlign: 'center', padding: 14 }}>No active zones.</div>
            )}
            {zones.map((z) => {
              const already = alreadySet.has(z.id);
              const isChecked = checked.has(z.id);
              return (
                <label
                  key={z.id}
                  style={{ display: 'flex', alignItems: 'flex-start', gap: 9, padding: '9px 10px', borderRadius: 10, border: `1px solid ${isChecked ? '#BAE2FB' : 'var(--bw-line-soft)'}`, background: already ? 'var(--bw-bg-subtle)' : isChecked ? '#EFF8FF' : '#fff', opacity: already ? 0.6 : 1, cursor: already ? 'default' : 'pointer' }}
                >
                  <input type="checkbox" checked={isChecked} disabled={already} onChange={() => toggle(z.id)} style={{ marginTop: 2, flex: 'none' }} />
                  <span style={{ flex: 1, minWidth: 0 }}>
                    <span style={{ display: 'block', fontSize: 13, fontWeight: 800 }}>{z.name}</span>
                    <span style={{ display: 'block', fontSize: 11.5, color: 'var(--bw-muted)', fontWeight: 600 }}>{z.district} · {z.level.toUpperCase()}</span>
                    {already && <span style={{ display: 'block', fontSize: 10.5, color: 'var(--bw-faint)', marginTop: 2 }}>Already reported nearby</span>}
                  </span>
                </label>
              );
            })}
          </div>
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
          <div style={{ fontSize: 10.5, color: 'var(--bw-faint)', fontWeight: 600, marginTop: 6 }}>
            Applied to every ticked zone alike — for a zone that needs its own depth, use its row's "⚡ Report now" one at a time.
          </div>
        </div>

        <div>
          <label style={labelStyle}>Keep live for</label>
          <select value={ttl} onChange={(e) => setTtl(e.target.value)} style={inputStyle}>
            {TTL_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        </div>

        {/* No social auto-post fields here on purpose — a batch of N zones must never fan out into
            N Facebook/X posts. For a situational roundup after posting, use the consolidated
            "Flood digest" (App's FloodDigestModal), which summarizes every active report as one post. */}
        <div style={{ fontSize: 10.5, color: 'var(--bw-faint)', fontWeight: 600, lineHeight: 1.5 }}>
          These post as plain system reports — no auto-post to Facebook/X. Share a roundup afterward with the flood digest.
        </div>
      </div>

      {/* Footer */}
      <div style={{ padding: '12px 20px', borderTop: '1px solid var(--bw-line-soft)' }}>
        <button
          onClick={() => void submit()}
          disabled={!canPost}
          style={{ width: '100%', border: 0, background: '#0369A1', color: '#fff', padding: 12, borderRadius: 11, fontSize: 13.5, fontWeight: 800, cursor: canPost ? 'pointer' : 'not-allowed', opacity: canPost ? 1 : 0.6 }}
        >
          {busy ? 'Posting…' : `Post ${picked.length} report${picked.length === 1 ? '' : 's'}`}
        </button>
      </div>
    </div>
  );

  // zIndex 1300, not the usual 1200: this modal is opened FROM the admin console, which also sits
  // at 1200 and renders later in App's JSX — at an equal z-index the console wins the tie and
  // buries this behind it. AdminWarnZoneModal is raised for exactly the same reason.
  return (
    <div
      onClick={onClose}
      style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,.55)', backdropFilter: 'blur(3px)', zIndex: 1300, display: 'flex', alignItems: isMobile ? 'flex-end' : 'center', justifyContent: 'center', padding: isMobile ? 0 : 18 }}
    >
      {card}
    </div>
  );
};

export default ZoneReportModal;
