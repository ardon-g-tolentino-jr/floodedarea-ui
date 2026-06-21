import React from 'react';
import type { Severity } from '../../types';
import { SEV_META } from '../../utils/floodMeta';
import { MONITOR_RADIUS_MAX, MONITOR_RADIUS_MIN, MONITOR_RADIUS_STEP } from '../../utils/viewModel';

/** A user's subscription to new-flood-report alerts. Persisted in localStorage. */
export interface NotifyPrefs {
  enabled: boolean;
  radiusKm: number;
  severities: Record<Severity, boolean>;
}

export const DEFAULT_NOTIFY_PREFS: NotifyPrefs = {
  enabled: false,
  radiusKm: 3,
  severities: { high: true, medium: true, low: true },
};

const fmtKm = (km: number): string =>
  km < 1 ? `${Math.round(km * 1000)} m` : `${Number.isInteger(km) ? km : km.toFixed(1)} km`;

interface NotifyModalProps {
  prefs: NotifyPrefs;
  permission: NotificationPermission | 'unsupported';
  onEnable: (on: boolean) => void;
  onChange: (next: NotifyPrefs) => void;
  onClose: () => void;
}

const SEV_ORDER: Severity[] = ['high', 'medium', 'low'];

const NotifyModal: React.FC<NotifyModalProps> = ({ prefs, permission, onEnable, onChange, onClose }) => {
  const setSeverity = (s: Severity): void =>
    onChange({ ...prefs, severities: { ...prefs.severities, [s]: !prefs.severities[s] } });

  return (
    <div
      onClick={onClose}
      style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,.55)', backdropFilter: 'blur(3px)', zIndex: 1200, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 18 }}
    >
      <div onClick={(e) => e.stopPropagation()} style={{ width: 400, maxWidth: '100%', maxHeight: '92vh', overflowY: 'auto', background: '#fff', borderRadius: 18, boxShadow: '0 24px 70px rgba(15,23,42,.4)', animation: 'popIn .16s ease-out' }}>
        {/* Header */}
        <div style={{ padding: '20px 22px 0', display: 'flex', alignItems: 'center', gap: 11 }}>
          <div style={{ width: 36, height: 36, borderRadius: 11, background: 'linear-gradient(150deg,#0EA5E9,#0369A1)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, flex: 'none' }}>🔔</div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 16.5, fontWeight: 800 }}>Flood alerts</div>
            <div style={{ fontSize: 11.5, color: 'var(--bw-muted)', fontWeight: 600 }}>Get notified when a new flood is reported near you</div>
          </div>
          <button onClick={onClose} style={{ border: 0, background: 'var(--bw-bg-subtle)', color: '#7C8B98', width: 28, height: 28, borderRadius: 8, fontSize: 16, cursor: 'pointer' }}>×</button>
        </div>

        <div style={{ padding: 22 }}>
          {/* Master toggle */}
          <label style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '13px 14px', border: '1px solid var(--bw-line)', borderRadius: 12, cursor: 'pointer', background: prefs.enabled ? '#EFF8FF' : '#fff', borderColor: prefs.enabled ? '#BAE2FB' : 'var(--bw-line)' }}>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 13.5, fontWeight: 800 }}>Notify me about new reports</div>
              <div style={{ fontSize: 11.5, color: 'var(--bw-muted)', marginTop: 2 }}>From other people, matching the criteria below</div>
            </div>
            <span
              onClick={(e) => { e.preventDefault(); onEnable(!prefs.enabled); }}
              style={{ width: 44, height: 26, borderRadius: 999, background: prefs.enabled ? 'var(--bw-primary)' : '#CBD5E1', position: 'relative', flex: 'none', transition: 'background .15s' }}
            >
              <span style={{ position: 'absolute', top: 3, left: prefs.enabled ? 21 : 3, width: 20, height: 20, borderRadius: '50%', background: '#fff', boxShadow: '0 1px 3px rgba(15,23,42,.3)', transition: 'left .15s' }} />
            </span>
          </label>

          {/* Criteria */}
          <div style={{ opacity: prefs.enabled ? 1 : 0.45, pointerEvents: prefs.enabled ? 'auto' : 'none', transition: 'opacity .15s' }}>
            {/* Distance */}
            <div style={{ marginTop: 18 }}>
              <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 6 }}>
                <span style={{ fontSize: 10.5, fontWeight: 800, letterSpacing: '.1em', color: 'var(--bw-faint)' }}>WITHIN DISTANCE</span>
                <span style={{ fontSize: 13, fontWeight: 800, color: 'var(--bw-primary-deep)' }}>{fmtKm(prefs.radiusKm)}</span>
              </div>
              <input
                type="range"
                min={MONITOR_RADIUS_MIN}
                max={MONITOR_RADIUS_MAX}
                step={MONITOR_RADIUS_STEP}
                value={prefs.radiusKm}
                onChange={(e) => onChange({ ...prefs, radiusKm: parseFloat(e.target.value) })}
                aria-label="Alert distance in kilometers"
                style={{ width: '100%', accentColor: 'var(--bw-primary)', cursor: 'pointer' }}
              />
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: 'var(--bw-muted)', marginTop: 1 }}>
                <span>{fmtKm(MONITOR_RADIUS_MIN)}</span>
                <span>{fmtKm(MONITOR_RADIUS_MAX)}</span>
              </div>
            </div>

            {/* Severity */}
            <div style={{ marginTop: 18 }}>
              <div style={{ fontSize: 10.5, fontWeight: 800, letterSpacing: '.1em', color: 'var(--bw-faint)', marginBottom: 8 }}>FOR THESE LEVELS</div>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {SEV_ORDER.map((s) => {
                  const sm = SEV_META[s];
                  const active = prefs.severities[s];
                  return (
                    <button
                      key={s}
                      onClick={() => setSeverity(s)}
                      style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '8px 13px', borderRadius: 999, border: `1.5px solid ${active ? sm.color : '#E2E8F0'}`, background: active ? sm.soft : '#fff', color: active ? 'var(--bw-ink)' : '#9AA8B4', fontSize: 12.5, fontWeight: 700, cursor: 'pointer' }}
                    >
                      <span style={{ width: 9, height: 9, borderRadius: '50%', background: sm.color, opacity: active ? 1 : 0.4 }} />
                      {sm.label}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Permission status */}
          <PermissionNote permission={permission} />
        </div>
      </div>
    </div>
  );
};

const PermissionNote: React.FC<{ permission: NotificationPermission | 'unsupported' }> = ({ permission }) => {
  const note =
    permission === 'granted'
      ? { bg: '#F0FDF4', border: '#BBF7D0', col: '#15803D', txt: 'Browser notifications are on — you’ll be alerted even when this tab is in the background.' }
      : permission === 'denied'
        ? { bg: '#FEF2F2', border: '#FECACA', col: '#B91C1C', txt: 'Browser notifications are blocked in your browser settings. You’ll still see in-app alerts while FloodedArea is open.' }
        : permission === 'unsupported'
          ? { bg: 'var(--bw-bg-subtle)', border: 'var(--bw-line)', col: 'var(--bw-muted)', txt: 'This browser can’t show system notifications. You’ll still see in-app alerts while FloodedArea is open.' }
          : { bg: '#EFF6FF', border: '#BFDBFE', col: '#1D4ED8', txt: 'Turn the toggle on to allow notifications and get alerts even when this tab is in the background.' };
  return (
    <div style={{ marginTop: 18, padding: '10px 13px', background: note.bg, border: `1px solid ${note.border}`, borderRadius: 9, fontSize: 12, color: note.col, lineHeight: 1.5 }}>
      {note.txt}
    </div>
  );
};

export default NotifyModal;
