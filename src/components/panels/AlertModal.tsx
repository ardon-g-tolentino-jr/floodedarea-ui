import React from 'react';
import type { FloodAlert } from '../../types';
import { LEVEL_STYLE } from './AlertRibbon';
import { useI18n, type MsgKey } from '../../i18n';

const LEVEL_LABEL: Record<FloodAlert['level'], string> = {
  yellow: 'Advisory',
  orange: 'Warning',
  red: 'Emergency',
};

/** Which of the three alert systems (see i18n `alert.source*`) triggered this dialog — shown as a
 *  small chip so the same modal chrome doesn't look identical for a nearby report, a trip-stop
 *  match, and a real PAGASA warning. */
export type AlertSource = 'nearby' | 'trip' | 'weather';
const SOURCE_KEY: Record<AlertSource, MsgKey> = {
  nearby: 'alert.sourceNearby',
  trip: 'alert.sourceTrip',
  weather: 'alert.sourceWeather',
};

interface AlertModalProps {
  alert: FloodAlert;
  /** Optional primary action (e.g. "View on map"). Runs, then closes the dialog. */
  action?: { label: string; run: () => void };
  /** Which alert system this came from. Omit for existing call sites — no chip is shown then. */
  source?: AlertSource;
  onClose: () => void;
}

/** Centered, attention-demanding modal for a severe (orange/red) flood alert. Auto-popped from
 *  App when a newly-active severe alert arrives; the top ribbon persists behind it. */
const AlertModal: React.FC<AlertModalProps> = ({ alert, action, source, onClose }) => {
  const { t } = useI18n();
  const s = LEVEL_STYLE[alert.level] ?? LEVEL_STYLE.orange;
  return (
    <div
      onClick={onClose}
      style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,.55)', backdropFilter: 'blur(3px)', zIndex: 1200, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 18 }}
    >
      <div onClick={(e) => e.stopPropagation()} style={{ width: 400, maxWidth: '100%', maxHeight: '92vh', overflowY: 'auto', background: '#fff', borderRadius: 18, boxShadow: '0 24px 70px rgba(15,23,42,.4)', animation: 'popIn .16s ease-out' }}>
        {/* Header */}
        <div style={{ padding: '20px 22px 0', display: 'flex', alignItems: 'flex-start', gap: 11 }}>
          <div style={{ width: 36, height: 36, borderRadius: 11, background: s.chip, color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, fontWeight: 800, flex: 'none' }}>!</div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ fontSize: 10.5, fontWeight: 800, letterSpacing: '.12em', textTransform: 'uppercase', color: s.close }}>{LEVEL_LABEL[alert.level]}</span>
              {source && (
                <span style={{ fontSize: 10, fontWeight: 800, letterSpacing: '.04em', textTransform: 'uppercase', color: 'var(--bw-muted)', background: 'var(--bw-bg-subtle)', padding: '2px 7px', borderRadius: 6 }}>
                  {t(SOURCE_KEY[source])}
                </span>
              )}
            </div>
            <div style={{ fontSize: 16.5, fontWeight: 800, marginTop: 1, textWrap: 'pretty' } as React.CSSProperties}>{alert.title}</div>
            {alert.region ? <div style={{ fontSize: 11.5, color: 'var(--bw-muted)', fontWeight: 600, marginTop: 2 }}>{alert.region}</div> : null}
          </div>
          <button onClick={onClose} aria-label="Dismiss alert" style={{ border: 0, background: 'var(--bw-bg-subtle)', color: '#7C8B98', width: 28, height: 28, borderRadius: 8, fontSize: 16, cursor: 'pointer', flex: 'none' }}>×</button>
        </div>

        <div style={{ padding: 22 }}>
          {alert.body ? (
            <div style={{ padding: '13px 14px', background: s.bg, border: `1px solid ${s.border}`, borderRadius: 12, fontSize: 13.5, lineHeight: 1.55, color: s.text, fontWeight: 600 }}>
              {alert.body}
            </div>
          ) : null}

          <div style={{ display: 'flex', gap: 10, marginTop: alert.body ? 18 : 0 }}>
            {action ? (
              <button
                onClick={onClose}
                style={{ flex: 'none', padding: '13px 18px', border: '1px solid var(--bw-line)', borderRadius: 12, background: '#fff', color: 'var(--bw-ink)', fontSize: 14, fontWeight: 700, cursor: 'pointer' }}
              >
                Dismiss
              </button>
            ) : null}
            <button
              onClick={() => { action?.run(); onClose(); }}
              style={{ flex: 1, padding: '13px 0', border: 0, borderRadius: 12, background: s.chip, color: '#fff', fontSize: 14, fontWeight: 800, cursor: 'pointer' }}
            >
              {action ? action.label : 'Got it'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AlertModal;
