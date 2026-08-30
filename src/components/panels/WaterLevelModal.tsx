import React from 'react';
import type { FloodReport, LatLng } from '../../types';
import { DEPTH_TICKS, SEV_META } from '../../utils/floodMeta';
import { buildDailyWaterBars } from '../../utils/waterChart';
import { localDateKey } from '../../utils/viewModel';
import { kmBetween } from '../../utils/geo';
import { useReportHistory } from '../../hooks/useDomainData';
import { formatDepth, formatDepthAxis } from '../../utils/format';

interface WaterLevelModalProps {
  userLoc: LatLng;
  isMobile: boolean;
  onClose: () => void;
  /** Currently-active reports — feeds the projected (dashed) bars for hours after "now" on today. */
  activeReports: FloodReport[];
  rainActive: boolean;
  now: number;
}

// SVG plot geometry (viewBox units). Margins leave room for tick + axis-title labels.
const VB_W = 560;
const VB_H = 322;
const M = { top: 14, right: 16, bottom: 50, left: 66 };
const PLOT_W = VB_W - M.left - M.right;
const PLOT_H = VB_H - M.top - M.bottom;

const ACCENT = 'var(--bw-primary)'; // fallback bar color when a bucket has no severity

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

const WaterLevelModal: React.FC<WaterLevelModalProps> = ({ userLoc, isMobile, onClose, activeReports, rainActive, now }) => {
  const today = React.useMemo(() => localDateKey(new Date()), []);
  const [selectedDate, setSelectedDate] = React.useState(today);
  // Free-text search across a report's name (street/barangay) and district. Empty = all areas.
  const [query, setQuery] = React.useState('');
  const queryTouched = React.useRef(false);

  const history = useReportHistory(selectedDate);
  const dayReports = history.data ?? [];

  // Autocomplete suggestions: every street/area name and district that has reports this day.
  const suggestions = React.useMemo(() => {
    const set = new Set<string>();
    for (const r of dayReports) {
      if (r.name) set.add(r.name);
      if (r.district) set.add(r.district);
    }
    return [...set].sort((a, b) => a.localeCompare(b));
  }, [dayReports]);

  // The district of the report nearest the user — used to seed the search on first load.
  const nearestDistrict = React.useMemo(() => {
    let best: { d: string; km: number } | null = null;
    for (const r of dayReports) {
      const km = kmBetween(userLoc, { lat: r.latitude, lng: r.longitude });
      if (!best || km < best.km) best = { d: r.district, km };
    }
    return best?.d ?? null;
  }, [dayReports, userLoc]);

  // Seed the search with the nearest district once reports load, until the user edits it.
  React.useEffect(() => {
    if (!queryTouched.current && !query && nearestDistrict) setQuery(nearestDistrict);
  }, [nearestDistrict, query]);

  const q = query.trim().toLowerCase();
  // Only today gets a predictive tail — a past day's remaining hours already happened, nothing to project.
  const isToday = selectedDate === today;
  const { bars, depthMax } = React.useMemo(
    () =>
      buildDailyWaterBars(
        dayReports,
        selectedDate,
        (r) => q === '' || `${r.name} ${r.district}`.toLowerCase().includes(q),
        isToday ? { now, rainActive, activeReports } : undefined
      ),
    [dayReports, selectedDate, q, isToday, now, rainActive, activeReports]
  );
  const hasData = bars.some((b) => b.depthCm > 0);

  const y = (cm: number): number => M.top + (1 - Math.min(cm, depthMax) / depthMax) * PLOT_H;
  const slotW = PLOT_W / 24;
  const barW = slotW * 0.62;
  const yBands = DEPTH_TICKS.filter((d) => d.cm <= depthMax);

  const chartBody =
    history.loading && dayReports.length === 0 ? (
      <div style={{ textAlign: 'center', padding: '46px 10px', color: 'var(--bw-faint)', fontSize: 13 }}>
        Loading water levels…
      </div>
    ) : history.error ? (
      <div style={{ textAlign: 'center', padding: '46px 10px', color: 'var(--bw-on-tint-danger)', fontSize: 13 }}>
        Couldn’t load water levels.
        <div style={{ color: 'var(--bw-faint)', fontSize: 12, marginTop: 4 }}>Check the backend is running, then reopen.</div>
      </div>
    ) : !hasData ? (
      <div style={{ textAlign: 'center', padding: '46px 10px', color: 'var(--bw-faint)', fontSize: 13 }}>
        No water-level reports for “{query.trim() || 'any area'}” on {dateLabel(selectedDate, today)}.
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
              stroke="var(--bw-line)"
              strokeWidth={1}
              strokeDasharray={b.cm >= 100 ? '4 4' : undefined}
            />
            <text x={M.left - 6} y={y(b.cm) + 3} textAnchor="end" fontSize={9} fontWeight={700} fill="var(--bw-faint)">
              {formatDepthAxis(b.cm)}
            </text>
          </g>
        ))}
        {/* Baseline */}
        <line x1={M.left} x2={VB_W - M.right} y1={M.top + PLOT_H} y2={M.top + PLOT_H} stroke="var(--bw-line-strong)" strokeWidth={1} />
        {/* Bars + every-3h X labels */}
        {bars.map((b) => {
          const cx = M.left + (b.hour + 0.5) * slotW;
          const color = b.severity ? SEV_META[b.severity].color : ACCENT;
          const top = y(b.depthCm);
          const h = M.top + PLOT_H - top;
          return (
            <g key={b.hour}>
              {b.depthCm > 0 && (
                b.projected ? (
                  <rect x={cx - barW / 2} y={top} width={barW} height={Math.max(0, h)} rx={2} fill="none" stroke={color} strokeWidth={1.5} strokeDasharray="3 2">
                    <title>{`${hourLabel(b.hour)} · ${formatDepth(b.depthCm)} · predictive`}</title>
                  </rect>
                ) : (
                  <rect x={cx - barW / 2} y={top} width={barW} height={Math.max(0, h)} rx={2} fill={color}>
                    <title>{`${hourLabel(b.hour)} · ${formatDepth(b.depthCm)}`}</title>
                  </rect>
                )
              )}
              {b.hour % 3 === 0 && (
                <text x={cx} y={M.top + PLOT_H + 14} textAnchor="middle" fontSize={9} fontWeight={700} fill="var(--bw-faint)">
                  {hourLabel(b.hour)}
                </text>
              )}
            </g>
          );
        })}
        {/* Axis titles */}
        <text x={M.left + PLOT_W / 2} y={M.top + PLOT_H + 34} textAnchor="middle" fontSize={10.5} fontWeight={800} fill="var(--bw-muted)">
          Time of day
        </text>
        <text
          x={14}
          y={M.top + PLOT_H / 2}
          textAnchor="middle"
          fontSize={10.5}
          fontWeight={800}
          fill="var(--bw-muted)"
          transform={`rotate(-90 14 ${M.top + PLOT_H / 2})`}
        >
          Water depth (cm / in)
        </text>
      </svg>
    );

  const card = (
    <div style={{ background: 'var(--bw-surface)', borderRadius: 18, boxShadow: '0 18px 50px rgba(15,23,42,.32)', overflow: 'hidden', border: '1px solid var(--bw-line)' }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 9, padding: '16px 18px 12px', borderBottom: '1px solid var(--bw-line-soft)' }}>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 16, fontWeight: 800, letterSpacing: '-.01em' }}>Water level over time</div>
          <div style={{ fontSize: 12, color: 'var(--bw-muted)', fontWeight: 600, marginTop: 2 }}>
            {query.trim() || 'All areas'} · {dateLabel(selectedDate, today)}
          </div>
        </div>
        <button
          onClick={onClose}
          aria-label="Close"
          style={{ border: 0, background: 'var(--bw-bg-subtle)', color: 'var(--bw-muted)', width: 28, height: 28, borderRadius: 8, fontSize: 16, cursor: 'pointer', flex: 'none' }}
        >
          ×
        </button>
      </div>

      {/* Controls: search (street / district) + date */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '12px 18px', borderBottom: '1px solid var(--bw-line-soft)', flexWrap: 'wrap' }}>
        <div style={{ flex: '1 1 200px', position: 'relative', display: 'flex', alignItems: 'center' }}>
          <span style={{ position: 'absolute', left: 10, fontSize: 13, color: 'var(--bw-faint)', pointerEvents: 'none' }}>⌕</span>
          <input
            list="bw-water-areas"
            value={query}
            onChange={(e) => { queryTouched.current = true; setQuery(e.target.value); }}
            disabled={dayReports.length === 0}
            placeholder={dayReports.length === 0 ? 'No reports this day' : 'Search a street or district…'}
            aria-label="Search water levels by street or district"
            style={{ width: '100%', boxSizing: 'border-box', fontSize: 13, fontWeight: 700, color: 'var(--bw-ink)', border: '1px solid var(--bw-line)', borderRadius: 9, padding: '8px 28px', background: 'var(--bw-surface)' }}
          />
          {query && (
            <button
              onClick={() => { queryTouched.current = true; setQuery(''); }}
              aria-label="Clear search"
              style={{ position: 'absolute', right: 6, border: 0, background: 'transparent', color: 'var(--bw-faint)', fontSize: 16, cursor: 'pointer', padding: 2, lineHeight: 1 }}
            >
              ×
            </button>
          )}
          <datalist id="bw-water-areas">
            {suggestions.map((s) => (
              <option key={s} value={s} />
            ))}
          </datalist>
        </div>
        <input
          type="date"
          value={selectedDate}
          max={today}
          onChange={(e) => setSelectedDate(e.target.value || today)}
          style={{ flex: '1 1 150px', fontSize: 13, fontWeight: 600, color: 'var(--bw-ink)', border: '1px solid var(--bw-line)', borderRadius: 9, padding: '8px 10px', background: 'var(--bw-surface)' }}
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
