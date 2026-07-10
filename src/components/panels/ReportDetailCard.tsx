import React from 'react';
import { affectedRiseRatio, type EnrichedReport } from '../../utils/viewModel';
import { ADVICE, ROAD_META, TREND_META, sparkPaths, trendNote, waterSeries } from '../../utils/floodMeta';

interface ReportDetailCardProps {
  report: EnrichedReport;
  isMobile: boolean;
  canConfirm: boolean;
  confirming: boolean;
  onConfirm: () => void;
  canRemove: boolean;
  removing: boolean;
  onRemove: () => void;
  onShowLocation: () => void;
  /** Absolute URL to the report's flood photo, or null when none was attached. */
  photoSrc: string | null;
  /** Share this report to Facebook (native photo share on mobile, web sharer fallback). */
  onShareReport: () => void;
  projectedRiseCm: number;
  onClose: () => void;
}

const DEPTH_TICKS = [
  { l: 'Ankle', cm: 15 },
  { l: 'Knee', cm: 50 },
  { l: 'Waist', cm: 100 },
  { l: 'Chest', cm: 140 },
];

const ReportDetailCard: React.FC<ReportDetailCardProps> = ({ report, isMobile, canConfirm, confirming, onConfirm, canRemove, removing, onRemove, onShowLocation, photoSrc, onShareReport, projectedRiseCm, onClose }) => {
  const [confirmRemove, setConfirmRemove] = React.useState(false);
  const rise = projectedRiseCm > 0 ? affectedRiseRatio(report.depthCm, projectedRiseCm) : null;
  const sev = report.sev;
  const tm = TREND_META[report.trend];
  const rm = ROAD_META[report.road];
  const advice = ADVICE[report.road];
  const series = waterSeries(report.depthCm, report.trend, report.id);
  const spark = sparkPaths(series);
  const note = trendNote(report.depthCm, report.trend, series);
  const depthPct = Math.min(report.depthCm / 150, 1) * 100;
  const edgeLabel = report.edgeKm <= 0 ? 'you are inside this zone' : `${report.distKm.toFixed(1)} km away`;

  const card = (
    <div style={{ background: '#fff', borderRadius: 16, boxShadow: '0 14px 40px rgba(15,23,42,.3)', overflow: 'hidden', border: '1px solid var(--bw-line)' }}>
      <div style={{ padding: '14px 15px 12px', borderBottom: '1px solid var(--bw-line-soft)' }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 9 }}>
          <span style={{ width: 14, height: 14, borderRadius: '50%', marginTop: 3, flex: 'none', background: sev.color }} />
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 15, fontWeight: 800, lineHeight: 1.15 }}>{report.name}</div>
            <div style={{ fontSize: 11.5, color: 'var(--bw-muted)', fontWeight: 600 }}>{report.district} · {edgeLabel}</div>
          </div>
          <button onClick={onClose} style={{ border: 0, background: 'var(--bw-bg-subtle)', color: '#7C8B98', width: 26, height: 26, borderRadius: 7, fontSize: 15, cursor: 'pointer', flex: 'none' }}>×</button>
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 7, marginTop: 10 }}>
          <span style={{ background: sev.soft, color: sev.color, fontSize: 11, fontWeight: 800, padding: '4px 10px', borderRadius: 8 }}>
            {sev.label} flooding · {report.depthCm} cm
          </span>
          <span
            title="Reports stay live for 30 minutes after they're posted."
            style={{ background: report.expired ? '#F1F5F9' : '#FFF7ED', color: report.expired ? '#94A3B8' : '#C2620B', fontSize: 11, fontWeight: 800, padding: '4px 10px', borderRadius: 8 }}
          >
            ⏳ {report.expired ? 'Expired' : `Expires in ${report.expiresInMin}m`}
          </span>
          {report.guest && (
            <span
              title="Posted by a guest (no account). Treat as unverified until others confirm it."
              style={{ background: '#FFF7ED', color: '#B45309', fontSize: 11, fontWeight: 800, padding: '4px 10px', borderRadius: 8 }}
            >
              ⚠ Unverified
            </span>
          )}
          {report.system && (
            <span
              title="Logged by a FloodedArea admin from news or other sources."
              style={{ background: '#EEF2FF', color: '#4338CA', fontSize: 11, fontWeight: 800, padding: '4px 10px', borderRadius: 8 }}
            >
              🛈 System report
            </span>
          )}
        </div>
      </div>

      {photoSrc && (
        <img
          src={photoSrc}
          alt={`Flood photo — ${report.name}`}
          loading="lazy"
          style={{ width: '100%', maxHeight: 200, objectFit: 'cover', display: 'block', borderBottom: '1px solid var(--bw-line-soft)' }}
        />
      )}

      <div style={{ padding: '13px 15px' }}>
        <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: '.1em', color: 'var(--bw-faint)', marginBottom: 7 }}>WATER DEPTH</div>
        <div style={{ position: 'relative', height: 10, background: '#EEF2F5', borderRadius: 6, overflow: 'hidden', marginBottom: 4 }}>
          <div style={{ position: 'absolute', left: 0, top: 0, height: '100%', borderRadius: 6, width: `${depthPct}%`, background: sev.color }} />
        </div>
        <div style={{ position: 'relative', height: 26, marginBottom: 10 }}>
          {DEPTH_TICKS.map((t) => (
            <div key={t.l} style={{ position: 'absolute', transform: 'translateX(-50%)', textAlign: 'center', left: `${Math.min(t.cm / 150, 1) * 100}%` }}>
              <div style={{ width: 1, height: 5, background: '#C3CDD6', margin: '0 auto' }} />
              <div style={{ fontSize: 9, color: 'var(--bw-faint)', fontWeight: 700, whiteSpace: 'nowrap' }}>{t.l}</div>
            </div>
          ))}
        </div>

        {rise && (
          <div style={{ marginBottom: 10, padding: '9px 11px', background: 'var(--bw-bg-subtle)', borderRadius: 11, fontSize: 11.5, fontWeight: 700, color: 'var(--bw-ink-soft)', lineHeight: 1.4 }}>
            📈 If water rises <strong>+{projectedRiseCm} cm</strong>, this zone spreads{' '}
            <strong style={{ color: 'var(--bw-primary-deep)' }}>≈{rise.diameter.toFixed(1)}× wider</strong> ·{' '}
            <strong style={{ color: 'var(--bw-primary-deep)' }}>≈{rise.area.toFixed(1)}× area</strong>
          </div>
        )}

        <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: '.1em', color: 'var(--bw-faint)', margin: '2px 0 6px' }}>WATER LEVEL · LAST 6 HOURS</div>
        <div style={{ background: '#F7FAFB', borderRadius: 11, padding: '10px 10px 6px', marginBottom: 10 }}>
          <svg viewBox="0 0 100 36" preserveAspectRatio="none" style={{ width: '100%', height: 46, display: 'block' }}>
            <path d={spark.area} fill={sev.soft} />
            <path d={spark.line} fill="none" stroke={sev.color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
          </svg>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 9, color: '#A4B0BB', fontWeight: 700, marginTop: 3 }}>
            <span>−6h</span><span>−4h</span><span>−2h</span><span>now</span>
          </div>
        </div>
        <div style={{ marginTop: 9, fontSize: 12, fontWeight: 700, color: tm.color, lineHeight: 1.4 }}>{note}</div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 9, marginTop: 11 }}>
          <Cell label="TREND"><span style={{ color: tm.color, fontSize: 13, fontWeight: 800, display: 'flex', alignItems: 'center', gap: 5 }}><span>{tm.sym}</span>{tm.label}</span></Cell>
          <Cell label="ROADS"><span style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12.5, fontWeight: 800 }}><span style={{ width: 9, height: 9, borderRadius: '50%', background: rm.color }} />{rm.label}</span></Cell>
          <Cell label="CONFIRMED BY"><span style={{ fontSize: 13, fontWeight: 800 }}>{report.reportsCount} reports</span></Cell>
          <Cell label="LAST UPDATE"><span style={{ fontSize: 13, fontWeight: 800 }}>{report.time}</span></Cell>
        </div>

        <div style={{ marginTop: 11, padding: '10px 12px', background: advice.bg, color: advice.col, borderRadius: 11, fontSize: 12, fontWeight: 600, lineHeight: 1.4 }}>{advice.txt}</div>

        <button
          onClick={onShareReport}
          style={{ marginTop: 11, width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, border: 0, background: '#1877F2', color: '#fff', padding: 11, borderRadius: 11, fontSize: 13.5, fontWeight: 800, cursor: 'pointer' }}
        >
          <span style={{ fontSize: 15 }}>ⓕ</span> Share to Facebook
        </button>

        {canConfirm && (
          <button
            onClick={onConfirm}
            disabled={confirming}
            style={{ marginTop: 11, width: '100%', border: '1.5px solid var(--bw-primary)', background: '#fff', color: 'var(--bw-primary-deep)', padding: 11, borderRadius: 11, fontSize: 13.5, fontWeight: 800, cursor: confirming ? 'wait' : 'pointer', opacity: confirming ? 0.7 : 1 }}
          >
            {confirming ? 'Confirming…' : "I'm seeing this too — confirm"}
          </button>
        )}

        {canRemove && (
          <>
            <button
              onClick={onShowLocation}
              style={{ marginTop: 11, width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7, border: '1.5px solid var(--bw-line)', background: '#fff', color: 'var(--bw-ink-soft)', padding: 11, borderRadius: 11, fontSize: 13.5, fontWeight: 800, cursor: 'pointer' }}
            >
              📍 Show my location
            </button>
            {confirmRemove ? (
            <div style={{ marginTop: 11, padding: '11px 12px', background: '#FEF2F2', border: '1px solid #FCA5A5', borderRadius: 11 }}>
              <div style={{ fontSize: 12.5, fontWeight: 700, color: '#B91C1C', lineHeight: 1.4 }}>Remove this report? It will disappear from the map for everyone.</div>
              <div style={{ display: 'flex', gap: 8, marginTop: 9 }}>
                <button
                  onClick={onRemove}
                  disabled={removing}
                  style={{ flex: 1, border: 0, background: 'var(--bw-danger)', color: '#fff', padding: 10, borderRadius: 10, fontSize: 13, fontWeight: 800, cursor: removing ? 'wait' : 'pointer', opacity: removing ? 0.7 : 1 }}
                >
                  {removing ? 'Removing…' : 'Remove'}
                </button>
                <button
                  onClick={() => setConfirmRemove(false)}
                  disabled={removing}
                  style={{ flex: 1, border: '1.5px solid var(--bw-line)', background: '#fff', color: '#475563', padding: 10, borderRadius: 10, fontSize: 13, fontWeight: 800, cursor: 'pointer' }}
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <button
              onClick={() => setConfirmRemove(true)}
              style={{ marginTop: 11, width: '100%', border: '1.5px solid #FCA5A5', background: '#fff', color: '#B91C1C', padding: 11, borderRadius: 11, fontSize: 13.5, fontWeight: 800, cursor: 'pointer' }}
            >
              Remove my report
            </button>
          )}
          </>
        )}
      </div>
    </div>
  );

  if (isMobile) {
    return (
      <>
        <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,.4)', zIndex: 1100 }} />
        <div style={{ position: 'fixed', left: 0, right: 0, bottom: 0, zIndex: 1110, maxHeight: '88vh', overflowY: 'auto', animation: 'sheetUp .22s ease-out' }}>{card}</div>
      </>
    );
  }
  return <div style={{ position: 'fixed', left: 16, top: 132, width: 330, zIndex: 1110, animation: 'popIn .14s ease-out' }}>{card}</div>;
};

const Cell: React.FC<{ label: string; children: React.ReactNode }> = ({ label, children }) => (
  <div style={{ background: '#F7FAFB', borderRadius: 11, padding: '9px 11px' }}>
    <div style={{ fontSize: 10, color: 'var(--bw-faint)', fontWeight: 700, marginBottom: 3 }}>{label}</div>
    {children}
  </div>
);

export default ReportDetailCard;
