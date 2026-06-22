import React from 'react';
import type { LatLng } from '../../types';
import { DEPTH_TICKS, SEV_META } from '../../utils/floodMeta';
import { buildDailyWaterBars } from '../../utils/waterChart';
import { localDateKey } from '../../utils/viewModel';
import { kmBetween } from '../../utils/geo';
import { useReportHistory } from '../../hooks/useDomainData';

interface WaterLevelModalProps {
  userLoc: LatLng;
  isMobile: boolean;
  onClose: () => void;
}

// SVG plot geometry (viewBox units). Margins leave room for tick + axis-title labels.
const VB_W = 560;
const VB_H = 322;
const M = { top: 14, right: 16, bottom: 50, left: 54 };
const PLOT_W = VB_W - M.left - M.right;
const PLOT_H = VB_H - M.top - M.bottom;

const ACCENT = '#0EA5E9'; // fallback bar color when a bucket has no severity

/** "Today · Mon, Jun 22" or just "Mon, Jun 22". */
function dateLabel(ymd: string, today: string): string {
  const d = new Date(`${ymd}T00:00:00`);
  const pretty = d.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' });
  return ymd === today ? `Today · ${pretty}` : pretty;
}

/** "12a" / "3a" / "12p" / "3p" for an hour 0–23. */
function hourLabel(h: number): string {
  const ap = h < 12 ? 'a' : 'p';
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}${ap}`;
}

const WaterLevelModal: React.FC<WaterLevelModalProps> = ({ userLoc, isMobile, onClose }) => {
  const today = React.useMemo(() => localDateKey(new Date()), []);
  const [selectedDate, setSelectedDate] = React.useState(today);
  const [selectedDistrict, setSelectedDistrict] = React.useState('');

  const history = useReportHistory(selectedDate);
  const dayReports = history.data ?? [];

  // Districts that have reports this day, sorted.
  const districts = React.useMemo(
    () => [...new Set(dayReports.map((r) => r.district))].sort((a, b) => a.localeCompare(b)),
    [dayReports]
  );

  // Default to the district of the report nearest to the user.
  const nearestDistrict = React.useMemo(() => {
    let best: { d: string; km: number } | null = null;
    for (const r of dayReports) {
      const km = kmBetween(userLoc, { lat: r.latitude, lng: r.longitude });
      if (!best || km < best.km) best = { d: r.district, km };
    }
    return best?.d ?? null;
  }, [dayReports, userLoc]);

  React.useEffect(() => {
    if (districts.length === 0) {
      if (selectedDistrict) setSelectedDistrict('');
      return;
    }
    if (!districts.includes(selectedDistrict)) {
      setSelectedDistrict(nearestDistrict && districts.includes(nearestDistrict) ? nearestDistrict : districts[0]);
    }
  }, [districts, nearestDistrict]); // eslint-disable-line react-hooks/exhaustive-deps

  const { bars, depthMax } = React.useMemo(
    () => buildDailyWaterBars(dayReports, selectedDistrict, selectedDate),
    [dayReports, selectedDistrict, selectedDate]
  );
  const hasData = selectedDistrict !== '' && bars.some((b) => b.depthCm > 0);

  const y = (cm: number): number => M.top + (1 - Math.min(cm, depthMax) / depthMax) * PLOT_H;
  const slotW = PLOT_W / 24;
  const barW = slotW * 0.62;
  const yBands = DEPTH_TICKS.filter((d) => d.cm <= depthMax);

  const chartBody =
    history.loading && dayReports.length === 0 ? (
      <div style={{ textAlign: 'center', padding: '46px 10px', color: '#9AA8B4', fontSize: 13 }}>
        Loading water levels…
      </div>
    ) : history.error ? (
      <div style={{ textAlign: 'center', padding: '46px 10px', color: '#B91C1C', fontSize: 13 }}>
        Couldn’t load water levels.
        <div style={{ color: '#9AA8B4', fontSize: 12, marginTop: 4 }}>Check the backend is running, then reopen.</div>
      </div>
    ) : !hasData ? (
      <div style={{ textAlign: 'center', padding: '46px 10px', color: '#9AA8B4', fontSize: 13 }}>
        No water-level reports for {selectedDistrict || 'this area'} on {dateLabel(selectedDate, today)}.
      </div>
    ) : (
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
        {/* Baseline */}
        <line x1={M.left} x2={VB_W - M.right} y1={M.top + PLOT_H} y2={M.top + PLOT_H} stroke="#CBD5E1" strokeWidth={1} />
        {/* Bars + every-3h X labels */}
        {bars.map((b) => {
          const cx = M.left + (b.hour + 0.5) * slotW;
          const color = b.severity ? SEV_META[b.severity].color : ACCENT;
          const top = y(b.depthCm);
          const h = M.top + PLOT_H - top;
          return (
            <g key={b.hour}>
              {b.depthCm > 0 && (
                <rect x={cx - barW / 2} y={top} width={barW} height={Math.max(0, h)} rx={2} fill={color}>
                  <title>{`${hourLabel(b.hour)} · ${b.depthCm} cm`}</title>
                </rect>
              )}
              {b.hour % 3 === 0 && (
                <text x={cx} y={M.top + PLOT_H + 14} textAnchor="middle" fontSize={9} fontWeight={700} fill="#A4B0BB">
                  {hourLabel(b.hour)}
                </text>
              )}
            </g>
          );
        })}
        {/* Axis titles */}
        <text x={M.left + PLOT_W / 2} y={M.top + PLOT_H + 34} textAnchor="middle" fontSize={10.5} fontWeight={800} fill="#64748B">
          Time of day
        </text>
        <text
          x={14}
          y={M.top + PLOT_H / 2}
          textAnchor="middle"
          fontSize={10.5}
          fontWeight={800}
          fill="#64748B"
          transform={`rotate(-90 14 ${M.top + PLOT_H / 2})`}
        >
          Water depth (cm)
        </text>
      </svg>
    );

  const card = (
    <div style={{ background: '#fff', borderRadius: 18, boxShadow: '0 18px 50px rgba(15,23,42,.32)', overflow: 'hidden', border: '1px solid var(--bw-line)' }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 9, padding: '16px 18px 12px', borderBottom: '1px solid var(--bw-line-soft)' }}>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 16, fontWeight: 800, letterSpacing: '-.01em' }}>Water level over time</div>
          <div style={{ fontSize: 12, color: 'var(--bw-muted)', fontWeight: 600, marginTop: 2 }}>
            {selectedDistrict || 'No reports'} · {dateLabel(selectedDate, today)}
          </div>
        </div>
        <button
          onClick={onClose}
          aria-label="Close"
          style={{ border: 0, background: 'var(--bw-bg-subtle)', color: '#7C8B98', width: 28, height: 28, borderRadius: 8, fontSize: 16, cursor: 'pointer', flex: 'none' }}
        >
          ×
        </button>
      </div>

      {/* Controls: district + date */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '12px 18px', borderBottom: '1px solid var(--bw-line-soft)', flexWrap: 'wrap' }}>
        <select
          value={selectedDistrict}
          onChange={(e) => setSelectedDistrict(e.target.value)}
          disabled={districts.length === 0}
          style={{ flex: '1 1 180px', fontSize: 13, fontWeight: 700, color: 'var(--bw-ink)', border: '1px solid var(--bw-line)', borderRadius: 9, padding: '8px 10px', background: '#fff' }}
        >
          {districts.length === 0 && <option value="">No reports this day</option>}
          {districts.map((d) => (
            <option key={d} value={d}>{d}</option>
          ))}
        </select>
        <input
          type="date"
          value={selectedDate}
          max={today}
          onChange={(e) => setSelectedDate(e.target.value || today)}
          style={{ flex: '1 1 150px', fontSize: 13, fontWeight: 600, color: 'var(--bw-ink)', border: '1px solid var(--bw-line)', borderRadius: 9, padding: '8px 10px', background: '#fff' }}
        />
        {selectedDate !== today && (
          <button
            onClick={() => setSelectedDate(today)}
            style={{ flex: 'none', border: 0, background: 'var(--bw-bg-subtle)', color: 'var(--bw-ink)', fontSize: 12.5, fontWeight: 700, padding: '8px 12px', borderRadius: 9, cursor: 'pointer' }}
          >
            Today
          </button>
        )}
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
