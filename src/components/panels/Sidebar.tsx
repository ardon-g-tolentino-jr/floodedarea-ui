import React from 'react';
import type { Road, Severity } from '../../types';
import {
  type EnrichedReport,
  type SafetyStatus,
  WATER_RISE_MAX,
  WATER_RISE_MIN,
  WATER_RISE_STEP,
  MONITOR_RADIUS_MAX,
  MONITOR_RADIUS_MIN,
  MONITOR_RADIUS_STEP,
} from '../../utils/viewModel';
import { ROAD_META, ROAD_ORDER, SEV_META, TREND_META } from '../../utils/floodMeta';
import ShelterIcon from './ShelterIcon';

type Tab = 'nearby' | 'activity';

interface SidebarProps {
  isMobile: boolean;
  status: SafetyStatus;
  list: EnrichedReport[];
  tab: Tab;
  onTab: (t: Tab) => void;
  filters: Record<Severity, boolean>;
  filterCounts: Record<Severity, number>;
  onToggleFilter: (s: Severity) => void;
  roadFilters: Record<Road, boolean>;
  roadCounts: Record<Road, number>;
  onToggleRoad: (r: Road) => void;
  onOpenRoads: () => void;
  projectedRiseCm: number;
  onChangeRise: (cm: number) => void;
  monitorRadiusKm: number;
  onChangeMonitor: (km: number) => void;
  notifyOn: boolean;
  notifyRadiusKm: number;
  onOpenNotify: () => void;
  showShelters: boolean;
  onToggleShelters: () => void;
  showRoads: boolean;
  onToggleRoads: () => void;
  impassableRoadCount: number;
  highCount: number;
  totalCount: number;
  selectedReportId: number | null;
  onSelectReport: (id: number) => void;
  onSOS: () => void;
}

const TONE: Record<SafetyStatus['tone'], { bg: string; border: string; title: string; badge: string }> = {
  danger: { bg: '#FEF2F2', border: '#FCA5A5', title: '#B91C1C', badge: '#EF4444' },
  warn: { bg: '#FFFBEB', border: '#FCD34D', title: '#B45309', badge: '#F59E0B' },
  ok: { bg: '#F0FDF4', border: '#86EFAC', title: '#15803D', badge: '#16A34A' },
};

/** Show metres under 1 km, kilometres otherwise (e.g. 200 m, 500 m, 1 km). */
const fmtRadius = (km: number): string =>
  km < 1 ? `${Math.round(km * 1000)} m` : `${Number.isInteger(km) ? km : km.toFixed(1)} km`;

type SectionKey = 'filters' | 'roads' | 'affected' | 'monitor';
const SECTIONS_STORAGE_KEY = 'baha_sidebar_sections_v1';
const DEFAULT_OPEN: Record<SectionKey, boolean> = { filters: true, roads: true, affected: true, monitor: true };

/** A sidebar control group with a clickable header that collapses its body. */
const CollapsibleSection: React.FC<{
  title: string;
  open: boolean;
  onToggle: () => void;
  right?: React.ReactNode;
  children: React.ReactNode;
}> = ({ title, open, onToggle, right, children }) => (
  <div style={{ flex: 'none', padding: '0 18px 12px' }}>
    <button
      onClick={onToggle}
      aria-expanded={open}
      style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 8, padding: '4px 0 8px', border: 0, background: 'transparent', cursor: 'pointer' }}
    >
      <span
        style={{ fontSize: 10, color: 'var(--bw-faint)', flex: 'none', transform: open ? 'rotate(90deg)' : 'none', transition: 'transform .15s' }}
      >
        ▶
      </span>
      <span style={{ fontSize: 10, fontWeight: 800, letterSpacing: '.1em', color: 'var(--bw-faint)' }}>{title}</span>
      {right != null && <span style={{ marginLeft: 'auto' }}>{right}</span>}
    </button>
    {open && children}
  </div>
);

const Sidebar: React.FC<SidebarProps> = (props) => {
  const { isMobile, status, list, tab, onTab, filters, filterCounts, onToggleFilter, roadFilters, roadCounts, onToggleRoad, onOpenRoads, projectedRiseCm, onChangeRise, monitorRadiusKm, onChangeMonitor, notifyOn, notifyRadiusKm, onOpenNotify, showShelters, onToggleShelters, showRoads, onToggleRoads, impassableRoadCount, highCount, totalCount, selectedReportId, onSelectReport, onSOS } = props;
  const tone = TONE[status.tone];

  const [openSections, setOpenSections] = React.useState<Record<SectionKey, boolean>>(() => {
    try {
      const raw = localStorage.getItem(SECTIONS_STORAGE_KEY);
      return raw ? { ...DEFAULT_OPEN, ...(JSON.parse(raw) as Record<SectionKey, boolean>) } : DEFAULT_OPEN;
    } catch {
      return DEFAULT_OPEN;
    }
  });
  const toggleSection = (k: SectionKey): void =>
    setOpenSections((o) => {
      const next = { ...o, [k]: !o[k] };
      try { localStorage.setItem(SECTIONS_STORAGE_KEY, JSON.stringify(next)); } catch {/* ignore */}
      return next;
    });

  const sidebarStyle: React.CSSProperties = isMobile
    ? { flex: 'none', width: '100%', background: '#fff', display: 'flex', flexDirection: 'column', paddingBottom: 80 }
    : { flex: 'none', width: 386, background: '#fff', borderLeft: '1px solid var(--bw-line)', display: 'flex', flexDirection: 'column', overflow: 'hidden' };

  return (
    <div style={sidebarStyle}>
      {/* STATUS */}
      <div style={{ flex: 'none', padding: '18px 18px 14px' }}>
        <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: '.13em', color: 'var(--bw-faint)', marginBottom: 9 }}>YOUR SAFETY STATUS</div>
        <div style={{ background: tone.bg, border: `1px solid ${tone.border}`, borderRadius: 16, padding: '15px 16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 9, marginBottom: 9 }}>
            <span style={{ background: tone.badge, color: '#fff', fontSize: 10, fontWeight: 800, letterSpacing: '.08em', padding: '3px 9px', borderRadius: 7, whiteSpace: 'nowrap' }}>{status.badge}</span>
            <span style={{ fontSize: 11.5, color: 'var(--bw-muted)', fontWeight: 600, marginLeft: 'auto' }}>Updated live</span>
          </div>
          <div style={{ color: tone.title, fontSize: 18, fontWeight: 800, letterSpacing: '-.01em', lineHeight: 1.2 }}>{status.title}</div>
          <div style={{ fontSize: 13, color: '#475563', marginTop: 6, lineHeight: 1.45 }}>{status.line}</div>
          <div style={{ fontSize: 12, color: 'var(--bw-muted)', marginTop: 7, lineHeight: 1.4 }}>{status.sub}</div>
          {status.eta && (
            <div style={{ marginTop: 11, paddingTop: 10, borderTop: '1px solid rgba(15,23,42,.08)', fontSize: 12, fontWeight: 700, color: '#475563', display: 'flex', gap: 7, lineHeight: 1.4 }}>
              <span style={{ flex: 'none' }}>⏱</span><span>{status.eta}</span>
            </div>
          )}
        </div>
      </div>

      {/* FILTERS */}
      <CollapsibleSection title="FILTERS" open={openSections.filters} onToggle={() => toggleSection('filters')}>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        {(['high', 'medium', 'low'] as Severity[]).map((k) => {
          const sm = SEV_META[k];
          const active = filters[k];
          return (
            <button
              key={k}
              onClick={() => onToggleFilter(k)}
              style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '7px 12px', borderRadius: 999, border: `1.5px solid ${active ? sm.color : '#E2E8F0'}`, background: active ? sm.soft : '#fff', color: active ? 'var(--bw-ink)' : '#9AA8B4', fontSize: 12.5, fontWeight: 700, cursor: 'pointer' }}
            >
              <span style={{ width: 9, height: 9, borderRadius: '50%', background: sm.color, opacity: active ? 1 : 0.4 }} />
              {sm.label}<span style={{ opacity: 0.6, fontWeight: 700 }}>{filterCounts[k]}</span>
            </button>
          );
        })}
        <button
          onClick={onToggleShelters}
          style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '7px 12px', borderRadius: 999, border: `1.5px solid ${showShelters ? 'var(--bw-shelter)' : '#E2E8F0'}`, background: showShelters ? 'rgba(14,116,144,.12)' : '#fff', color: showShelters ? '#0E5063' : '#9AA8B4', fontSize: 12.5, fontWeight: 700, cursor: 'pointer' }}
        >
          <span style={{ width: 13, height: 13, borderRadius: 4, background: 'var(--bw-shelter)', display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 'none' }}><ShelterIcon size={9} /></span>
          Shelters
        </button>
        <button
          onClick={onToggleRoads}
          style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '7px 12px', borderRadius: 999, border: `1.5px solid ${showRoads ? ROAD_META.impassable.color : '#E2E8F0'}`, background: showRoads ? ROAD_META.impassable.soft : '#fff', color: showRoads ? 'var(--bw-ink)' : '#9AA8B4', fontSize: 12.5, fontWeight: 700, cursor: 'pointer' }}
        >
          <span style={{ width: 14, height: 4, borderRadius: 2, background: ROAD_META.impassable.color, opacity: showRoads ? 1 : 0.4, flex: 'none' }} />
          Flooded roads
        </button>
      </div>
      </CollapsibleSection>

      {/* ROAD FILTERS */}
      <CollapsibleSection title="ROADS" open={openSections.roads} onToggle={() => toggleSection('roads')}>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
        {ROAD_ORDER.map((k) => {
          const rm = ROAD_META[k];
          const active = roadFilters[k];
          return (
            <button
              key={k}
              onClick={() => onToggleRoad(k)}
              style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '7px 11px', borderRadius: 999, border: `1.5px solid ${active ? rm.color : '#E2E8F0'}`, background: active ? rm.soft : '#fff', color: active ? 'var(--bw-ink)' : '#9AA8B4', fontSize: 12.5, fontWeight: 700, cursor: 'pointer' }}
            >
              <span style={{ color: active ? rm.color : '#B6C0CA', fontWeight: 800 }}>{rm.glyph}</span>
              {rm.short}
              <span style={{ opacity: 0.6, fontWeight: 700 }}>{roadCounts[k]}</span>
            </button>
          );
        })}
      </div>
      <button
        onClick={onOpenRoads}
        style={{ width: '100%', marginTop: 9, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7, padding: '9px 12px', borderRadius: 11, border: '1px solid var(--bw-line)', background: '#fff', color: 'var(--bw-primary-deep)', fontSize: 12.5, fontWeight: 800, cursor: 'pointer' }}
      >
        <span style={{ fontSize: 13 }}>⌕</span> Search roads by condition
      </button>
      </CollapsibleSection>

      {/* AFFECTED AREA — predictive water-rise projection */}
      <CollapsibleSection
        title="AFFECTED AREA"
        open={openSections.affected}
        onToggle={() => toggleSection('affected')}
        right={
          <span style={{ fontSize: 12.5, fontWeight: 800, color: projectedRiseCm > 0 ? 'var(--bw-primary-deep)' : 'var(--bw-muted)' }}>
            {projectedRiseCm > 0 ? `+${projectedRiseCm} cm` : 'Now'}
          </span>
        }
      >
        <div style={{ fontSize: 11.5, color: 'var(--bw-muted)', lineHeight: 1.4, marginBottom: 9 }}>
          Each report’s ring grows with its water depth. Drag to project how much higher the water
          rises — the dashed rings show how far flooding could spread.
        </div>
        <input
          type="range"
          min={WATER_RISE_MIN}
          max={WATER_RISE_MAX}
          step={WATER_RISE_STEP}
          value={projectedRiseCm}
          onChange={(e) => onChangeRise(parseFloat(e.target.value))}
          aria-label="Projected additional water rise in centimeters"
          style={{ width: '100%', accentColor: 'var(--bw-primary)', cursor: 'pointer' }}
        />
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: 'var(--bw-muted)', marginTop: 1 }}>
          <span>Now (+0)</span>
          <span>+{WATER_RISE_MAX} cm</span>
        </div>
      </CollapsibleSection>

      {/* MONITORING-AREA RADIUS */}
      <CollapsibleSection
        title="MONITORING AREA"
        open={openSections.monitor}
        onToggle={() => toggleSection('monitor')}
        right={<span style={{ fontSize: 12.5, fontWeight: 800, color: 'var(--bw-primary-deep)' }}>{fmtRadius(monitorRadiusKm)}</span>}
      >
        <input
          type="range"
          min={MONITOR_RADIUS_MIN}
          max={MONITOR_RADIUS_MAX}
          step={MONITOR_RADIUS_STEP}
          value={monitorRadiusKm}
          onChange={(e) => onChangeMonitor(parseFloat(e.target.value))}
          aria-label="Monitoring-area radius in kilometers"
          style={{ width: '100%', accentColor: 'var(--bw-primary)', cursor: 'pointer' }}
        />
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: 'var(--bw-muted)', marginTop: 1 }}>
          <span>{fmtRadius(MONITOR_RADIUS_MIN)}</span>
          <span>{fmtRadius(MONITOR_RADIUS_MAX)}</span>
        </div>
      </CollapsibleSection>

      {/* ALERTS */}
      <div style={{ flex: 'none', padding: '0 18px 14px' }}>
        <button
          onClick={onOpenNotify}
          style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 11, padding: '11px 13px', borderRadius: 12, border: `1.5px solid ${notifyOn ? '#BAE2FB' : 'var(--bw-line)'}`, background: notifyOn ? '#EFF8FF' : '#fff', cursor: 'pointer', textAlign: 'left' }}
        >
          <span style={{ fontSize: 16, flex: 'none' }}>🔔</span>
          <span style={{ flex: 1, minWidth: 0 }}>
            <span style={{ display: 'block', fontSize: 13, fontWeight: 800, color: 'var(--bw-ink)' }}>Flood alerts</span>
            <span style={{ display: 'block', fontSize: 11.5, color: 'var(--bw-muted)', marginTop: 1 }}>
              {notifyOn ? `On · new floods within ${fmtRadius(notifyRadiusKm)}` : 'Off · get notified about new floods nearby'}
            </span>
          </span>
          <span style={{ fontSize: 11.5, fontWeight: 800, color: notifyOn ? 'var(--bw-primary-deep)' : 'var(--bw-muted)', flex: 'none' }}>
            {notifyOn ? 'Edit' : 'Set up'}
          </span>
        </button>
      </div>

      {/* SUMMARY + TABS */}
      <div style={{ flex: 'none', padding: '0 18px 12px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 7, fontSize: 12.5, color: 'var(--bw-muted)', fontWeight: 600, marginBottom: 11 }}>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}><span style={{ width: 8, height: 8, borderRadius: '50%', background: '#EF4444' }} /><b style={{ color: 'var(--bw-ink)' }}>{highCount}</b> high</span>
          <span style={{ color: '#D5DDE3' }}>·</span>
          <span><b style={{ color: 'var(--bw-ink)' }}>{totalCount}</b> active reports nearby</span>
          {impassableRoadCount > 0 && (
            <>
              <span style={{ color: '#D5DDE3' }}>·</span>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                <span style={{ width: 14, height: 4, borderRadius: 2, background: ROAD_META.impassable.color }} />
                <b style={{ color: 'var(--bw-ink)' }}>{impassableRoadCount}</b> {impassableRoadCount === 1 ? 'road' : 'roads'} impassable
              </span>
            </>
          )}
        </div>
        <div style={{ display: 'flex', gap: 4, padding: 4, background: 'var(--bw-bg-subtle)', borderRadius: 12 }}>
          {(['nearby', 'activity'] as Tab[]).map((t) => (
            <div
              key={t}
              onClick={() => onTab(t)}
              style={{ flex: 1, textAlign: 'center', padding: '8px 0', borderRadius: 9, fontSize: 13, fontWeight: 700, cursor: 'pointer', color: tab === t ? '#0F172A' : '#94A3B8', background: tab === t ? '#fff' : 'transparent', boxShadow: tab === t ? '0 1px 3px rgba(15,23,42,.12)' : 'none' }}
            >
              {t === 'nearby' ? 'Nearby' : 'Live activity'}
            </div>
          ))}
        </div>
      </div>

      {/* LIST */}
      <div style={isMobile
        ? { overflowY: 'visible', padding: '0 18px 14px', display: 'flex', flexDirection: 'column', gap: 9 }
        : { flex: 1, overflowY: 'auto', padding: '0 18px 12px', display: 'flex', flexDirection: 'column', gap: 9 }}>
        {list.map((r) => {
          const sel = r.id === selectedReportId;
          const tm = TREND_META[r.trend];
          const rm = ROAD_META[r.road];
          return (
            <div
              key={r.id}
              onClick={() => onSelectReport(r.id)}
              style={{ padding: '12px 13px', borderRadius: 14, cursor: 'pointer', display: 'block', border: sel ? `1.5px solid ${r.sev.color}` : '1px solid var(--bw-line-soft)', background: sel ? r.sev.soft : '#fff', transition: 'all .12s' }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ width: 10, height: 10, borderRadius: '50%', flex: 'none', background: r.sev.color }} />
                <span style={{ fontSize: 14, fontWeight: 800, letterSpacing: '-.01em' }}>{r.name}</span>
                {r.mine && <span style={{ fontSize: 9.5, fontWeight: 800, color: '#0EA5E9', background: '#E3F4FC', padding: '2px 6px', borderRadius: 6 }}>YOURS</span>}
                <span style={{ fontSize: 11, color: '#9AA8B4', fontWeight: 600, marginLeft: 'auto' }}>{r.time}</span>
              </div>
              <div style={{ fontSize: 11.5, color: 'var(--bw-muted)', fontWeight: 600, margin: '4px 0 9px 18px' }}>{r.district} · {r.distKm.toFixed(1)} km away</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginLeft: 18 }}>
                <span style={{ background: r.sev.soft, color: r.sev.color, fontSize: 11, fontWeight: 800, padding: '3px 9px', borderRadius: 999 }}>{r.depthCm} cm</span>
                <span style={{ color: tm.color, fontSize: 11, fontWeight: 800, display: 'inline-flex', alignItems: 'center', gap: 4 }}><span>{tm.sym}</span>{tm.label}</span>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 11, fontWeight: 700, color: '#5A6875' }}><span style={{ width: 8, height: 8, borderRadius: '50%', background: rm.color }} />{rm.label}</span>
                <span style={{ fontSize: 11, color: '#9AA8B4', fontWeight: 600 }}>{r.reportsCount}× confirmed</span>
                <span style={{ fontSize: 11, fontWeight: 700, color: '#C2620B' }}>⏳ {r.expiresInMin}m left</span>
              </div>
            </div>
          );
        })}
        {list.length === 0 && (
          <div style={{ textAlign: 'center', padding: '30px 10px', color: '#9AA8B4', fontSize: 13 }}>No reports match the active filters.</div>
        )}
      </div>

      {/* FOOTER */}
      <div style={{ flex: 'none', padding: '13px 18px', borderTop: '1px solid var(--bw-line-soft)', display: 'flex', alignItems: 'center', gap: 11, background: '#FBFCFD' }}>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 12, fontWeight: 800 }}>In danger right now?</div>
          <div style={{ fontSize: 11, color: 'var(--bw-muted)' }}>Emergency hotlines &amp; rescue request</div>
        </div>
        <button onClick={onSOS} style={{ border: 0, background: 'var(--bw-danger)', color: '#fff', padding: '9px 16px', borderRadius: 11, fontSize: 13, fontWeight: 800, cursor: 'pointer', boxShadow: '0 4px 12px rgba(239,68,68,.28)' }}>Get help</button>
      </div>
    </div>
  );
};

export default Sidebar;
