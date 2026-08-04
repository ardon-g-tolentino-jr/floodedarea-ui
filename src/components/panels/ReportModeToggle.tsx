import React from 'react';
import { useI18n } from '../../i18n';

interface ReportModeToggleProps {
  mode: 'report' | 'quick';
  onSwitch: (mode: 'report' | 'quick') => void;
}

/**
 * Detailed / 🚗 Quick segmented control. On desktop, App.tsx renders this inside a floating pill
 * above the map. On mobile it's rendered instead (see SeverityPicker / QuickReportSheet) as the
 * first row inside the sheet card: the floating-pill placement sits in the map area's stacking
 * context (`isolation: isolate`), which the sheets' full-viewport dimmer (same zIndex bracket)
 * paints over once open — making the pill unreachable on mobile.
 */
const ReportModeToggle: React.FC<ReportModeToggleProps> = ({ mode, onSwitch }) => {
  const { t } = useI18n();
  return (
    <div style={{ display: 'flex', gap: 3, padding: 3, background: '#0F172A', borderRadius: 11, boxShadow: '0 8px 24px rgba(15,23,42,.35)' }}>
      {(['report', 'quick'] as const).map((m) => (
        <button
          key={m}
          onClick={() => onSwitch(m)}
          style={{
            flex: 1,
            border: 0,
            borderRadius: 8,
            padding: '8px 14px',
            fontSize: 12,
            fontWeight: 800,
            cursor: 'pointer',
            background: mode === m ? '#fff' : 'transparent',
            color: mode === m ? '#0F172A' : 'rgba(255,255,255,.75)',
          }}
        >
          {m === 'report' ? t('report.modeDetailed') : t('report.modeQuick')}
        </button>
      ))}
    </div>
  );
};

export default ReportModeToggle;
