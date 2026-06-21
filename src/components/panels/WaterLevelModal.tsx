import React from 'react';
import type { FloodReport } from '../../types';
import { DEPTH_TICKS, DISTRICT_COLORS, TREND_META } from '../../utils/floodMeta';
import { buildWaterChart, type TimedDepth } from '../../utils/waterChart';

interface WaterLevelModalProps {
  reports: FloodReport[];
  isMobile: boolean;
  onClose: () => void;
}

// SVG plot geometry (viewBox units). Margins leave room for axis labels.
const VB_W = 560;
const VB_H = 300;
const M = { top: 14, right: 16, bottom: 28, left: 40 };
const PLOT_W = VB_W - M.left - M.right;
const PLOT_H = VB_H - M.top - M.bottom;

const WaterLevelModal: React.FC<WaterLevelModalProps> = ({ reports, isMobile, onClose }) => {
  const chart = React.useMemo(() => buildWaterChart(reports, Date.now(), DISTRICT_COLORS), [reports]);
  const { series, tMin, tMax, depthMax } = chart;

  const spanT = Math.max(1, tMax - tMin);
  const x = (t: number): number => M.left + ((t - tMin) / spanT) * PLOT_W;
  const y = (cm: number): number => M.top + (1 - Math.min(cm, depthMax) / depthMax) * PLOT_H;
  const linePath = (pts: TimedDepth[]): string =>
    pts.map((p, i) => `${i ? 'L' : 'M'}${x(p.t).toFixed(1)} ${y(p.depthCm).toFixed(1)}`).join(' ');

  // X-axis ticks: −6h … now, in 2-hour steps mapped onto the actual window.
  const xTicks = [0, 0.25, 0.5, 0.75, 1].map((f) => {
    const t = tMin + f * spanT;
    const hoursAgo = Math.round((tMax - t) / 3_600_000);
    return { tx: x(t), label: hoursAgo <= 0 ? 'now' : `−${hoursAgo}h` };
  });

  const yBands = DEPTH_TICKS.filter((d) => d.cm <= depthMax);

  const chartBody =
    series.length === 0 ? (
      <div style={{ textAlign: 'center', padding: '46px 10px', color: '#9AA8B4', fontSize: 13 }}>
        No active reports to chart yet.
      </div>
    ) : (
      <>
        <svg viewBox={`0 0 ${VB_W} ${VB_H}`} style={{ width: '100%', height: 'auto', display: 'block' }}>
          {/* Y gridlines + depth-band labels */}
          {yBands.map((b) => (
            <g key={b.label}>
              <line
                x1={M.left}
                x2={VB_W - M.right}
                y1={y(b.cm)}
                y2={y(b.cm)}
                stroke="#E2E8F0"
                strokeWidth={1}
                strokeDasharray={b.cm >= 100 ? '4 4' : undefined}
              />
              <text x={M.left - 6} y={y(b.cm) + 3} textAnchor="end" fontSize={9} fontWeight={700} fill="#94A3B8">
                {b.cm}
              </text>
            </g>
          ))}
          {/* Baseline + axis */}
          <line x1={M.left} x2={VB_W - M.right} y1={M.top + PLOT_H} y2={M.top + PLOT_H} stroke="#CBD5E1" strokeWidth={1} />
          {/* X ticks */}
          {xTicks.map((t) => (
            <text key={t.label} x={t.tx} y={VB_H - 8} textAnchor="middle" fontSize={9} fontWeight={700} fill="#A4B0BB">
              {t.label}
            </text>
          ))}
          {/* District curves + real-report markers */}
          {series.map((s) => (
            <g key={s.district}>
              <path
                d={linePath(s.curve)}
                fill="none"
                stroke={s.color}
                strokeWidth={2.2}
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              {s.points.map((p, i) => (
                <circle key={i} cx={x(p.t)} cy={y(p.depthCm)} r={3.4} fill="#fff" stroke={s.color} strokeWidth={2} />
              ))}
            </g>
          ))}
        </svg>

        {/* Legend */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px 16px', marginTop: 12 }}>
          {series.map((s) => {
            const tm = TREND_META[s.trend];
            return (
              <div key={s.district} style={{ display: 'flex', alignItems: 'center', gap: 7, fontSize: 12 }}>
                <span style={{ width: 12, height: 3, borderRadius: 2, background: s.color, flex: 'none' }} />
                <span style={{ fontWeight: 800, color: 'var(--bw-ink)' }}>{s.district}</span>
                <span style={{ color: 'var(--bw-muted)', fontWeight: 600 }}>{s.latestDepthCm} cm</span>
                <span style={{ color: tm.color, fontWeight: 800 }}>{tm.sym}</span>
              </div>
            );
          })}
        </div>
      </>
    );

  const card = (
    <div style={{ background: '#fff', borderRadius: 18, boxShadow: '0 18px 50px rgba(15,23,42,.32)', overflow: 'hidden', border: '1px solid var(--bw-line)' }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 9, padding: '16px 18px 12px', borderBottom: '1px solid var(--bw-line-soft)' }}>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 16, fontWeight: 800, letterSpacing: '-.01em' }}>Water level over time</div>
          <div style={{ fontSize: 12, color: 'var(--bw-muted)', fontWeight: 600, marginTop: 2 }}>By district · last 6 hours</div>
        </div>
        <button
          onClick={onClose}
          aria-label="Close"
          style={{ border: 0, background: 'var(--bw-bg-subtle)', color: '#7C8B98', width: 28, height: 28, borderRadius: 8, fontSize: 16, cursor: 'pointer', flex: 'none' }}
        >
          ×
        </button>
      </div>
      <div style={{ padding: '16px 18px 20px' }}>{chartBody}</div>
    </div>
  );

  if (isMobile) {
    return (
      <>
        <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,.4)', zIndex: 1200 }} />
        <div style={{ position: 'fixed', left: 0, right: 0, bottom: 0, zIndex: 1210, maxHeight: '90vh', overflowY: 'auto', animation: 'sheetUp .22s ease-out' }}>
          {card}
        </div>
      </>
    );
  }
  return (
    <>
      <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,.4)', zIndex: 1200 }} />
      <div style={{ position: 'fixed', left: '50%', top: '50%', transform: 'translate(-50%,-50%)', width: 'min(620px, 92vw)', zIndex: 1210, animation: 'popIn .14s ease-out' }}>
        {card}
      </div>
    </>
  );
};

export default WaterLevelModal;
