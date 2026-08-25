import React from 'react';
import type { FloodAlert } from '../../types';

export const LEVEL_STYLE: Record<FloodAlert['level'], { bg: string; border: string; chip: string; text: string; close: string }> = {
  yellow: { bg: 'var(--bw-tint-warn)', border: 'var(--bw-tint-warn-border)', chip: 'var(--bw-warn)', text: 'var(--bw-on-tint-warn)', close: 'var(--bw-on-tint-warn)' },
  orange: { bg: 'var(--bw-tint-warn)', border: 'var(--bw-tint-warn-border)', chip: 'var(--bw-warn)', text: 'var(--bw-on-tint-warn)', close: 'var(--bw-on-tint-warn)' },
  red: { bg: 'var(--bw-tint-danger)', border: 'var(--bw-tint-danger-border)', chip: 'var(--bw-danger)', text: 'var(--bw-on-tint-danger)', close: 'var(--bw-on-tint-danger)' },
};

interface AlertRibbonProps {
  alert: FloodAlert;
  onClose: () => void;
}

const AlertRibbon: React.FC<AlertRibbonProps> = ({ alert, onClose }) => {
  const s = LEVEL_STYLE[alert.level] ?? LEVEL_STYLE.orange;
  return (
    <div
      style={{
        flex: 'none',
        display: 'flex',
        alignItems: 'center',
        gap: 11,
        padding: '9px 16px',
        background: s.bg,
        borderBottom: `1px solid ${s.border}`,
        fontSize: 12.5,
        fontWeight: 600,
        color: s.text,
        zIndex: 35,
      }}
    >
      <span
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          width: 18,
          height: 18,
          background: s.chip,
          color: 'var(--bw-on-accent)',
          borderRadius: 6,
          fontSize: 12,
          fontWeight: 800,
          flex: 'none',
        }}
      >
        !
      </span>
      <span style={{ textWrap: 'pretty' } as React.CSSProperties}>
        <b>{alert.title}</b>
        {alert.body ? ` ${alert.body}` : ''}
      </span>
      <button
        onClick={onClose}
        style={{ marginLeft: 'auto', border: 0, background: 'transparent', color: s.close, fontSize: 18, lineHeight: 1, cursor: 'pointer', flex: 'none' }}
      >
        ×
      </button>
    </div>
  );
};

export default AlertRibbon;
