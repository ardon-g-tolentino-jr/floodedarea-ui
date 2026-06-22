import React from 'react';
import type { FloodAlert } from '../../types';
import { LEVEL_STYLE } from './AlertRibbon';

const LEVEL_LABEL: Record<FloodAlert['level'], string> = {
  yellow: 'Advisory',
  orange: 'Warning',
  red: 'Emergency',
};

interface AlertModalProps {
  alert: FloodAlert;
  onClose: () => void;
}

/** Centered, attention-demanding modal for a severe (orange/red) flood alert. Auto-popped from
 *  App when a newly-active severe alert arrives; the top ribbon persists behind it. */
const AlertModal: React.FC<AlertModalProps> = ({ alert, onClose }) => {
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
            <div style={{ fontSize: 10.5, fontWeight: 800, letterSpacing: '.12em', textTransform: 'uppercase', color: s.close }}>{LEVEL_LABEL[alert.level]}</div>
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

          <button
            onClick={onClose}
            style={{ marginTop: alert.body ? 18 : 0, width: '100%', padding: '13px 0', border: 0, borderRadius: 12, background: s.chip, color: '#fff', fontSize: 14, fontWeight: 800, cursor: 'pointer' }}
          >
            Got it
          </button>
        </div>
      </div>
    </div>
  );
};

export default AlertModal;
