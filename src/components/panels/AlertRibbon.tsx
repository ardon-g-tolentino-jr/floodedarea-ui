import React from 'react';
import type { FloodAlert } from '../../types';

const LEVEL_STYLE: Record<FloodAlert['level'], { bg: string; border: string; chip: string; text: string; close: string }> = {
  yellow: { bg: '#FEFCE8', border: '#FDE68A', chip: '#EAB308', text: '#854D0E', close: '#A16207' },
  orange: { bg: '#FFF4E0', border: '#F6E2BC', chip: '#F59E0B', text: '#92600B', close: '#B07D1C' },
  red: { bg: '#FEF2F2', border: '#FECACA', chip: '#EF4444', text: '#991B1B', close: '#B91C1C' },
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
          color: '#fff',
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
