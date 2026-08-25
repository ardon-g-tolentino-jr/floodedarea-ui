import React from 'react';
import type { FloodAlert } from '../../types';
import type { EnrichedReport } from '../../utils/viewModel';
import { formatDepth, timeAgo } from '../../utils/format';
import { useI18n, tFormat } from '../../i18n';
import { LEVEL_STYLE } from './AlertRibbon';

interface ActivityTickerProps {
  /** Newest active report (feed[0] in App). Null renders no report row. */
  report: EnrichedReport | null;
  /** Nearest active warning overlapping the user's "My area" circle (App's `monitorAreaWarnings`),
   *  or null when there is none / location is unknown. Drives the warning row. */
  warning: FloodAlert | null;
  /** How many warnings overlap the monitoring area in total — `warning` is just the nearest. */
  warningCount: number;
  /** The user's current "My area" radius, km — named in the warning row so the label says which
   *  area it means rather than leaving the user to guess. */
  monitorRadiusKm: number;
  /** True while an SSE event has landed within the last ~90s — drives the pulsing vs. static dot. */
  isLive: boolean;
  isMobile: boolean;
  onClick: () => void;
  /** Opens the warning (same modal the alarm path uses). */
  onWarningClick: () => void;
}

/** Slim full-width strip under the TopBar showing the newest active report, so the SSE-driven live
 *  feed is visibly "live" instead of only updating the map silently in the background. Mounted as a
 *  sibling of AlertRibbon — same flex/zIndex pattern, no map/layout impact. Dismissal is local to the
 *  component and keyed to the current newest report's id, so it reappears when a newer one arrives. */
const ActivityTicker: React.FC<ActivityTickerProps> = ({
  report, warning, warningCount, monitorRadiusKm, isLive, isMobile, onClick, onWarningClick,
}) => {
  const { lang, t } = useI18n();
  const [dismissedId, setDismissedId] = React.useState<number | null>(null);
  // Dismissal is tracked separately per row and keyed to the id of what's showing, so closing the
  // report line never silences a warning (or vice versa) and a NEWER item reopens its own row.
  const [dismissedWarnId, setDismissedWarnId] = React.useState<number | null>(null);

  const showReport = report != null && report.id !== dismissedId;
  const showWarning = warning != null && warning.id !== dismissedWarnId;
  if (!showReport && !showWarning) return null;

  const line = report ? tFormat(lang, 'ticker.floodIn', { sev: report.sev.label, district: report.district }) : '';
  const detail = report ? `${report.name} · ${formatDepth(report.depthCm)} · ${timeAgo(report.createdAt)}` : '';
  const ws = warning ? (LEVEL_STYLE[warning.level] ?? LEVEL_STYLE.orange) : LEVEL_STYLE.orange;

  return (
    <>
      {/* WARNING ROW — an advisory was issued somewhere inside the user's My-area circle. Sits
          above the newest-report row because a standing warning outranks a single new report, and
          renders even with no reports at all: "nothing reported yet, but your area is warned" is
          exactly the state worth surfacing. Distinct from the AlertRibbon, which only fires once
          the user is practically inside the zone (see alertsInMonitorArea's doc comment). */}
      {showWarning && warning && (
        <div
          style={{
            flex: 'none', display: 'flex', alignItems: 'center', gap: 11, padding: '9px 16px',
            background: ws.bg, borderBottom: `1px solid ${ws.border}`,
            fontSize: 12.5, fontWeight: 600, color: ws.text, zIndex: 36,
          }}
        >
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, flex: 'none', fontSize: 10, fontWeight: 800, letterSpacing: '.08em', color: 'var(--bw-on-accent)', background: ws.chip, padding: '2px 7px', borderRadius: 999 }}>
            ⚠ {t('ticker.warnTag')}
          </span>
          <button
            onClick={onWarningClick}
            style={{
              flex: 1, minWidth: 0, display: isMobile ? 'block' : 'flex', alignItems: 'baseline', gap: 7,
              border: 0, background: 'transparent', padding: 0, textAlign: 'left', cursor: 'pointer',
              color: 'inherit', font: 'inherit',
              ...(isMobile ? { whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' } : {}),
            }}
          >
            <b>{warning.title}</b>
            <span style={{ opacity: 0.85, marginLeft: isMobile ? 4 : 0 }}>
              {tFormat(lang, 'ticker.warnWithin', { km: String(monitorRadiusKm) })}
              {warningCount > 1 ? ` · ${tFormat(lang, 'ticker.warnMore', { n: String(warningCount - 1) })}` : ''}
            </span>
          </button>
          <button
            onClick={() => setDismissedWarnId(warning.id)}
            aria-label={t('common.close')}
            style={{ marginLeft: 'auto', border: 0, background: 'transparent', color: ws.close, fontSize: 18, lineHeight: 1, cursor: 'pointer', flex: 'none' }}
          >
            ×
          </button>
        </div>
      )}

      {showReport && report && (
    <div
      style={{
        flex: 'none',
        display: 'flex',
        alignItems: 'center',
        gap: 11,
        padding: '9px 16px',
        background: 'var(--bw-surface)',
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
            background: isLive ? 'var(--bw-danger)' : 'var(--bw-faint)',
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
      )}
    </>
  );
};

export default ActivityTicker;
