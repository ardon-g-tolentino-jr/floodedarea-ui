import React from 'react';
import type { AlertLevel, FloodProneArea, WarnArea } from '../../types';
import { useI18n } from '../../i18n';

/**
 * Manual "Warn this zone" confirm modal — the deliberate second action the whole feature is built
 * around. A flood-prone area (AdminPanel's Zones tab) exists quietly until an admin explicitly
 * sends a warning here; saving/editing the zone itself must never trigger this. Prefills from the
 * zone but every field is editable before the broadcast goes out.
 */
interface Props {
  isMobile: boolean;
  zone: FloodProneArea;
  /** Broadcast the warning. Throws on failure so the modal keeps its form open and shows an error. */
  onSubmit: (b: WarnArea) => Promise<void>;
  onClose: () => void;
}

const LEVEL_OPTIONS: { value: AlertLevel; label: string }[] = [
  { value: 'yellow', label: 'Yellow' },
  { value: 'orange', label: 'Orange' },
  { value: 'red', label: 'Red' },
];

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

const AdminWarnZoneModal: React.FC<Props> = ({ isMobile, zone, onSubmit, onClose }) => {
  const { t } = useI18n();
  const [title, setTitle] = React.useState(`Flood-prone area: ${zone.name}`);
  const [body, setBody] = React.useState(zone.note ?? `Flooding is likely near ${zone.name}, ${zone.district}. Avoid the area and monitor conditions.`);
  const [level, setLevel] = React.useState<AlertLevel>(zone.level);
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const submit = async (): Promise<void> => {
    setBusy(true);
    setError(null);
    try {
      await onSubmit({ title: title.trim() || undefined, body: body.trim() || undefined, level });
      onClose();
    } catch {
      setError('Could not send the warning. Please try again.');
    } finally {
      setBusy(false);
    }
  };

  const card = (
    <div
      onClick={(e) => e.stopPropagation()}
      style={{ width: 440, maxWidth: '100%', maxHeight: '90vh', display: 'flex', flexDirection: 'column', background: 'var(--bw-surface)', borderRadius: isMobile ? '20px 20px 0 0' : 20, boxShadow: '0 24px 70px rgba(15,23,42,.4)', overflow: 'hidden', animation: isMobile ? 'sheetUp .22s ease-out' : 'popIn .16s ease-out' }}
    >
      {/* Header */}
      <div style={{ background: 'linear-gradient(135deg,var(--bw-warn),var(--bw-on-tint-warn))', padding: '16px 20px', color: 'var(--bw-on-accent)', display: 'flex', alignItems: 'center', gap: 12 }}>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 16, fontWeight: 800 }}>⚠ {t('zone.warnTitle')}</div>
          <div style={{ fontSize: 12, opacity: 0.9 }}>{zone.name} · {zone.district}</div>
        </div>
        <button onClick={onClose} style={{ border: 0, background: 'rgba(255,255,255,.18)', color: 'var(--bw-on-accent)', width: 28, height: 28, borderRadius: 8, fontSize: 16, cursor: 'pointer', flex: 'none' }}>×</button>
      </div>

      {/* Body */}
      <div style={{ padding: '15px 20px', overflowY: 'auto', flex: 1, display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div style={{ padding: '10px 12px', background: 'var(--bw-tint-warn)', border: '1px solid var(--bw-tint-warn-border)', borderRadius: 10, fontSize: 12, color: 'var(--bw-on-tint-warn)', fontWeight: 600, lineHeight: 1.5 }}>
          {t('zone.warnBody')} {t('zone.advisory')}
        </div>

        {error && (
          <div style={{ background: 'var(--bw-tint-danger)', color: 'var(--bw-on-tint-danger)', padding: '8px 11px', borderRadius: 9, fontSize: 12.5, fontWeight: 600 }}>{error}</div>
        )}

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

        <div style={{ fontSize: 11, color: 'var(--bw-faint)' }}>
          Radius: {zone.radiusM} m around the pinned zone. {zone.lastWarnedAt ? `Last warned ${new Date(zone.lastWarnedAt).toLocaleString()}.` : 'Never warned before.'}
        </div>
      </div>

      {/* Footer */}
      <div style={{ padding: '12px 20px', borderTop: '1px solid var(--bw-line-soft)' }}>
        <button
          onClick={() => void submit()}
          disabled={busy}
          style={{ width: '100%', border: 0, background: 'var(--bw-on-tint-warn)', color: 'var(--bw-on-accent)', padding: 12, borderRadius: 11, fontSize: 13.5, fontWeight: 800, cursor: busy ? 'wait' : 'pointer', opacity: busy ? 0.7 : 1 }}
        >
          {busy ? 'Sending…' : `⚠ ${t('zone.sendWarning')}`}
        </button>
      </div>
    </div>
  );

  // zIndex 1300, not the usual 1200: this modal is only ever opened FROM the admin console, which
  // also sits at 1200 and renders later in App's JSX — at an equal z-index the console won the tie
  // and buried the warn form behind it, leaving the "⚠ Warn" button looking inert.
  return (
    <div
      onClick={onClose}
      style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,.55)', backdropFilter: 'blur(3px)', zIndex: 1300, display: 'flex', alignItems: isMobile ? 'flex-end' : 'center', justifyContent: 'center', padding: isMobile ? 0 : 18 }}
    >
      {card}
    </div>
  );
};

export default AdminWarnZoneModal;
