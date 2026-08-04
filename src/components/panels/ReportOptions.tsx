import React from 'react';
import { useI18n } from '../../i18n';

interface ReportOptionsProps {
  /** Which entry point the reporter picked last time — rendered first and styled as primary. */
  preferred: 'report' | 'quick';
  onChoose: (target: 'report' | 'quick') => void;
}

/**
 * The two-option report chooser: "Report flood" (detailed, pin + fields) vs. "Quick report"
 * (voice-first, one tap). Rendered content-only — the caller positions it (App.tsx anchors it
 * above the mobile FAB as a fan-out; TopBar anchors it as a popover under the desktop button).
 * The remembered preference (`localStorage['baha_report_mode_v1']`) orders and highlights the
 * two choices; both stay visible and clickable regardless of preference.
 */
const ReportOptions: React.FC<ReportOptionsProps> = ({ preferred, onChoose }) => {
  const { t } = useI18n();

  const OPTIONS = [
    { target: 'report' as const, icon: '📝', label: t('topbar.report'), sub: t('report.optionDetailedSub') },
    { target: 'quick' as const, icon: '🎤', label: t('report.optionQuick'), sub: t('report.optionQuickSub') },
  ];
  const ordered = preferred === 'quick' ? [...OPTIONS].reverse() : OPTIONS;

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        width: 240,
        background: '#fff',
        borderRadius: 15,
        boxShadow: '0 12px 36px rgba(15,23,42,.28)',
        border: '1px solid var(--bw-line)',
        overflow: 'hidden',
      }}
    >
      {ordered.map((o, i) => {
        const primary = i === 0;
        return (
          <button
            key={o.target}
            onClick={() => onChoose(o.target)}
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'flex-start',
              gap: 2,
              padding: '12px 15px',
              border: 0,
              borderBottom: i === 0 ? '1px solid var(--bw-line)' : 'none',
              background: primary ? 'rgba(14,165,233,.07)' : '#fff',
              cursor: 'pointer',
              textAlign: 'left',
            }}
          >
            <span style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13.5, fontWeight: 800, color: primary ? 'var(--bw-primary-deep)' : 'var(--bw-ink)' }}>
              <span style={{ fontSize: 16, lineHeight: 1 }}>{o.icon}</span>
              {o.label}
            </span>
            <span style={{ fontSize: 11, color: 'var(--bw-muted)', paddingLeft: 24 }}>{o.sub}</span>
          </button>
        );
      })}
    </div>
  );
};

export default ReportOptions;
