import React from 'react';
import type { Severity } from '../../types';
import { SEV_META } from '../../utils/floodMeta';
import { useI18n, sevLabel, tFormat, type MsgKey } from '../../i18n';

/**
 * A user's subscription to new-flood-report alerts. Persisted in localStorage.
 * `radiusKm` used to live here as its own slider, duplicating the sidebar's "My area" (monitoring
 * area) slider — two radii, two sources of truth, and this one never fed the map/banner at all.
 * As of 085 there is exactly one radius (`monitorRadiusKm` in App.tsx); this modal only reads it.
 */
export interface NotifyPrefs {
  enabled: boolean;
  severities: Record<Severity, boolean>;
}

export const DEFAULT_NOTIFY_PREFS: NotifyPrefs = {
  enabled: false,
  severities: { high: true, medium: true, low: true },
};

const fmtKm = (km: number): string =>
  km < 1 ? `${Math.round(km * 1000)} m` : `${Number.isInteger(km) ? km : km.toFixed(1)} km`;

interface NotifyModalProps {
  prefs: NotifyPrefs;
  /** The unified monitoring-area radius (App.tsx's `monitorRadiusKm`) — read-only here; set via the
   *  sidebar's Monitoring area slider, not this modal. */
  radiusKm: number;
  permission: NotificationPermission | 'unsupported';
  onEnable: (on: boolean) => void;
  onChange: (next: NotifyPrefs) => void;
  onClose: () => void;
}

const SEV_ORDER: Severity[] = ['high', 'medium', 'low'];

const NotifyModal: React.FC<NotifyModalProps> = ({ prefs, radiusKm, permission, onEnable, onChange, onClose }) => {
  const { lang, t } = useI18n();
  const setSeverity = (s: Severity): void =>
    onChange({ ...prefs, severities: { ...prefs.severities, [s]: !prefs.severities[s] } });

  return (
    <div
      onClick={onClose}
      style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,.55)', backdropFilter: 'blur(3px)', zIndex: 1200, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 18 }}
    >
      <div onClick={(e) => e.stopPropagation()} style={{ width: 400, maxWidth: '100%', maxHeight: '92vh', overflowY: 'auto', background: 'var(--bw-surface)', borderRadius: 18, boxShadow: '0 24px 70px rgba(15,23,42,.4)', animation: 'popIn .16s ease-out' }}>
        {/* Header */}
        <div style={{ padding: '20px 22px 0', display: 'flex', alignItems: 'center', gap: 11 }}>
          <div style={{ width: 36, height: 36, borderRadius: 11, background: 'linear-gradient(150deg,var(--bw-primary),var(--bw-primary-deep))', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, flex: 'none' }}>🔔</div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 16.5, fontWeight: 800 }}>{t('sidebar.floodAlerts')}</div>
            <div style={{ fontSize: 11.5, color: 'var(--bw-muted)', fontWeight: 600 }}>{t('notify.subtitle')}</div>
          </div>
          <button onClick={onClose} style={{ border: 0, background: 'var(--bw-bg-subtle)', color: 'var(--bw-muted)', width: 28, height: 28, borderRadius: 8, fontSize: 16, cursor: 'pointer' }}>×</button>
        </div>

        <div style={{ padding: 22 }}>
          {/* Master toggle */}
          <label style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '13px 14px', border: '1px solid var(--bw-line)', borderRadius: 12, cursor: 'pointer', background: prefs.enabled ? 'var(--bw-tint-info)' : 'var(--bw-surface)', borderColor: prefs.enabled ? 'var(--bw-tint-info-border)' : 'var(--bw-line)' }}>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 13.5, fontWeight: 800 }}>{t('notify.master')}</div>
              <div style={{ fontSize: 11.5, color: 'var(--bw-muted)', marginTop: 2 }}>{t('notify.criteria')}</div>
            </div>
            <span
              onClick={(e) => { e.preventDefault(); onEnable(!prefs.enabled); }}
              style={{ width: 44, height: 26, borderRadius: 999, background: prefs.enabled ? 'var(--bw-primary)' : 'var(--bw-line-strong)', position: 'relative', flex: 'none', transition: 'background .15s' }}
            >
              <span style={{ position: 'absolute', top: 3, left: prefs.enabled ? 21 : 3, width: 20, height: 20, borderRadius: '50%', background: 'var(--bw-surface)', boxShadow: '0 1px 3px rgba(15,23,42,.3)', transition: 'left .15s' }} />
            </span>
          </label>

          {/* Criteria */}
          <div style={{ opacity: prefs.enabled ? 1 : 0.45, pointerEvents: prefs.enabled ? 'auto' : 'none', transition: 'opacity .15s' }}>
            {/* Range — read-only here; the one slider that sets it lives on the sidebar (My area). */}
            <div style={{ marginTop: 18, fontSize: 11.5, color: 'var(--bw-muted)' }}>
              {tFormat(lang, 'notify.rangeFromSidebar', { km: fmtKm(radiusKm) })}
            </div>

            {/* Severity */}
            <div style={{ marginTop: 18 }}>
              <div style={{ fontSize: 10.5, fontWeight: 800, letterSpacing: '.1em', color: 'var(--bw-faint)', marginBottom: 8 }}>{t('notify.forLevels')}</div>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {SEV_ORDER.map((s) => {
                  const sm = SEV_META[s];
                  const active = prefs.severities[s];
                  return (
                    <button
                      key={s}
                      onClick={() => setSeverity(s)}
                      style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '8px 13px', borderRadius: 999, border: `1.5px solid ${active ? sm.color : 'var(--bw-line)'}`, background: active ? sm.soft : 'var(--bw-surface)', color: active ? 'var(--bw-ink)' : 'var(--bw-faint)', fontSize: 12.5, fontWeight: 700, cursor: 'pointer' }}
                    >
                      <span style={{ width: 9, height: 9, borderRadius: '50%', background: sm.color, opacity: active ? 1 : 0.4 }} />
                      {sevLabel(lang, s)}
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
  const { t } = useI18n();
  const note: { bg: string; border: string; col: string; key: MsgKey } =
    permission === 'granted'
      ? { bg: 'var(--bw-tint-ok)', border: 'var(--bw-tint-ok-border)', col: 'var(--bw-on-tint-ok)', key: 'notify.permGranted' }
      : permission === 'denied'
        ? { bg: 'var(--bw-tint-danger)', border: 'var(--bw-tint-danger-border)', col: 'var(--bw-on-tint-danger)', key: 'notify.permDenied' }
        : permission === 'unsupported'
          ? { bg: 'var(--bw-bg-subtle)', border: 'var(--bw-line)', col: 'var(--bw-muted)', key: 'notify.permUnsupported' }
          : { bg: 'var(--bw-tint-info)', border: 'var(--bw-tint-info-border)', col: 'var(--bw-on-tint-info)', key: 'notify.permDefault' };
  return (
    <div style={{ marginTop: 18, padding: '10px 13px', background: note.bg, border: `1px solid ${note.border}`, borderRadius: 9, fontSize: 12, color: note.col, lineHeight: 1.5 }}>
      {t(note.key)}
    </div>
  );
};

export default NotifyModal;
