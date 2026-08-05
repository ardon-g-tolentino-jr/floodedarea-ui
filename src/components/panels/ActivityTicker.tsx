import React from 'react';
import type { EnrichedReport } from '../../utils/viewModel';
import { timeAgo } from '../../utils/format';
import { useI18n, tFormat } from '../../i18n';

interface ActivityTickerProps {
  /** Newest active report (feed[0] in App) — the ticker renders nothing when this is null. */
  report: EnrichedReport | null;
  /** True while an SSE event has landed within the last ~90s — drives the pulsing vs. static dot. */
  isLive: boolean;
  isMobile: boolean;
  onClick: () => void;
}

/** Slim full-width strip under the TopBar showing the newest active report, so the SSE-driven live
 *  feed is visibly "live" instead of only updating the map silently in the background. Mounted as a
 *  sibling of AlertRibbon — same flex/zIndex pattern, no map/layout impact. Dismissal is local to the
 *  component and keyed to the current newest report's id, so it reappears when a newer one arrives. */
const ActivityTicker: React.FC<ActivityTickerProps> = ({ report, isLive, isMobile, onClick }) => {
  const { lang, t } = useI18n();
  const [dismissedId, setDismissedId] = React.useState<number | null>(null);

  if (!report || report.id === dismissedId) return null;

  const line = tFormat(lang, 'ticker.floodIn', { sev: report.sev.label, district: report.district });
  const detail = `${report.name} · ${report.depthCm} cm · ${timeAgo(report.createdAt)}`;

  return (
    <div
      style={{
        flex: 'none',
        display: 'flex',
        alignItems: 'center',
        gap: 11,
        padding: '9px 16px',
        background: '#fff',
        borderBottom: '1px solid var(--bw-line-soft)',
        fontSize: 12.5,
        fontWeight: 600,
        color: 'var(--bw-ink-soft)',
        zIndex: 35,
      }}
    >
      <span
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 5,
          flex: 'none',
          fontSize: 10,
          fontWeight: 800,
          letterSpacing: '.08em',
          color: isLive ? 'var(--bw-danger)' : 'var(--bw-muted)',
        }}
      >
        <span
          style={{
            width: 7,
            height: 7,
            borderRadius: '50%',
            background: isLive ? 'var(--bw-danger)' : '#94A3B8',
            animation: isLive ? 'floodPulse 1.4s ease-in-out infinite' : 'none',
          }}
        />
        {t('ticker.live')}
      </span>

      <button
        onClick={onClick}
        style={{
          flex: 1,
          minWidth: 0,
          display: isMobile ? 'block' : 'flex',
          alignItems: 'baseline',
          gap: 7,
          border: 0,
          background: 'transparent',
          padding: 0,
          textAlign: 'left',
          cursor: 'pointer',
          color: 'inherit',
          font: 'inherit',
          ...(isMobile
            ? { whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }
            : {}),
        }}
      >
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
          <span style={{ fontSize: 10, fontWeight: 800, letterSpacing: '.06em', textTransform: 'uppercase', color: 'var(--bw-faint)' }}>{t('ticker.newest')}</span>
          <span style={{ width: 8, height: 8, borderRadius: '50%', flex: 'none', background: report.sev.color }} />
          <b>{line}</b>
        </span>
        <span style={{ color: 'var(--bw-muted)', marginLeft: isMobile ? 4 : 0 }}>{detail}</span>
      </button>

      <button
        onClick={() => setDismissedId(report.id)}
        aria-label={t('common.close')}
        style={{ marginLeft: 'auto', border: 0, background: 'transparent', color: 'var(--bw-muted)', fontSize: 18, lineHeight: 1, cursor: 'pointer', flex: 'none' }}
      >
        ×
      </button>
    </div>
  );
};

export default ActivityTicker;
