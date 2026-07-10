import React from 'react';
import type { Road, Severity } from '../../types';
import { formatDuration } from '../../utils/format';
import {
  type EnrichedReport,
  type SafetyStatus,
  affectedRiseRatio,
  WATER_RISE_MAX,
  WATER_RISE_MIN,
  WATER_RISE_STEP,
  MONITOR_RADIUS_MAX,
  MONITOR_RADIUS_MIN,
  MONITOR_RADIUS_STEP,
} from '../../utils/viewModel';
import { ROAD_META, ROAD_ORDER, SEV_META, TREND_META } from '../../utils/floodMeta';
import { useI18n, sevLabel, roadLabel, roadShort, trendLabel } from '../../i18n';
import ShelterIcon from './ShelterIcon';

type Tab = 'nearby' | 'activity' | 'archive';

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
  representativeDepthCm: number;
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
  /** Public all-time visit count; `null` while loading or if the stats endpoint is unavailable. */
  visitCount: number | null;
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
// v3: reset persisted state so Filters and Affected area start collapsed by default, discarding
// any previously-saved state from v2.
const SECTIONS_STORAGE_KEY = 'baha_sidebar_sections_v3';
const DEFAULT_OPEN: Record<SectionKey, boolean> = { filters: false, roads: true, affected: false, monitor: true };

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
  const { isMobile, status, list, tab, onTab, filters, filterCounts, onToggleFilter, roadFilters, roadCounts, onToggleRoad, onOpenRoads, projectedRiseCm, onChangeRise, representativeDepthCm, monitorRadiusKm, onChangeMonitor, notifyOn, notifyRadiusKm, onOpenNotify, showShelters, onToggleShelters, showRoads, onToggleRoads, impassableRoadCount, highCount, totalCount, selectedReportId, onSelectReport, visitCount } = props;
  const { lang, t } = useI18n();
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
        <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: '.13em', color: 'var(--bw-faint)', marginBottom: 9 }}>{t('sidebar.safetyStatus')}</div>
        <div style={{ background: tone.bg, border: `1px solid ${tone.border}`, borderRadius: 16, padding: '15px 16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 9, marginBottom: 9 }}>
            <span style={{ background: tone.badge, color: '#fff', fontSize: 10, fontWeight: 800, letterSpacing: '.08em', padding: '3px 9px', borderRadius: 7, whiteSpace: 'nowrap' }}>{status.badge}</span>
            <span style={{ fontSize: 11.5, color: 'var(--bw-muted)', fontWeight: 600, marginLeft: 'auto' }}>{t('sidebar.updatedLive')}</span>
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
      <CollapsibleSection title={t('sidebar.filters')} open={openSections.filters} onToggle={() => toggleSection('filters')}>
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
              {sevLabel(lang, k)}<span style={{ opacity: 0.6, fontWeight: 700 }}>{filterCounts[k]}</span>
            </button>
          );
        })}
        <button
          onClick={onToggleShelters}
          style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '7px 12px', borderRadius: 999, border: `1.5px solid ${showShelters ? 'var(--bw-shelter)' : '#E2E8F0'}`, background: showShelters ? 'rgba(14,116,144,.12)' : '#fff', color: showShelters ? '#0E5063' : '#9AA8B4', fontSize: 12.5, fontWeight: 700, cursor: 'pointer' }}
        >
          <span style={{ width: 13, height: 13, borderRadius: 4, background: 'var(--bw-shelter)', display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 'none' }}><ShelterIcon size={9} /></span>
          {t('sidebar.shelters')}
        </button>
        <button
          onClick={onToggleRoads}
          style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '7px 12px', borderRadius: 999, border: `1.5px solid ${showRoads ? ROAD_META.impassable.color : '#E2E8F0'}`, background: showRoads ? ROAD_META.impassable.soft : '#fff', color: showRoads ? 'var(--bw-ink)' : '#9AA8B4', fontSize: 12.5, fontWeight: 700, cursor: 'pointer' }}
        >
          <span style={{ width: 14, height: 4, borderRadius: 2, background: ROAD_META.impassable.color, opacity: showRoads ? 1 : 0.4, flex: 'none' }} />
          {t('sidebar.floodedRoads')}
        </button>
      </div>
      </CollapsibleSection>

      {/* ROAD FILTERS */}
      <CollapsibleSection title={t('sidebar.roads')} open={openSections.roads} onToggle={() => toggleSection('roads')}>
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
              {roadShort(lang, k)}
              <span style={{ opacity: 0.6, fontWeight: 700 }}>{roadCounts[k]}</span>
            </button>
          );
        })}
      </div>
      <button
        onClick={onOpenRoads}
        style={{ width: '100%', marginTop: 9, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7, padding: '9px 12px', borderRadius: 11, border: '1px solid var(--bw-line)', background: '#fff', color: 'var(--bw-primary-deep)', fontSize: 12.5, fontWeight: 800, cursor: 'pointer' }}
      >
        <span style={{ fontSize: 13 }}>⌕</span> {t('sidebar.searchRoads')}
      </button>
      </CollapsibleSection>

      {/* AFFECTED AREA — predictive water-rise projection */}
      <CollapsibleSection
        title={t('sidebar.affectedArea')}
        open={openSections.affected}
        onToggle={() => toggleSection('affected')}
        right={
          <span style={{ fontSize: 12.5, fontWeight: 800, color: projectedRiseCm > 0 ? 'var(--bw-primary-deep)' : 'var(--bw-muted)' }}>
            {projectedRiseCm > 0 ? `+${projectedRiseCm} cm` : t('sidebar.now')}
          </span>
        }
      >
        <div style={{ fontSize: 11.5, color: 'var(--bw-muted)', lineHeight: 1.4, marginBottom: 9 }}>
          {t('sidebar.affectedDesc')}
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
        {projectedRiseCm > 0 && representativeDepthCm > 0 && (() => {
          const { diameter, area } = affectedRiseRatio(representativeDepthCm, projectedRiseCm);
          return (
            <div style={{ marginTop: 9, padding: '8px 10px', background: 'var(--bw-bg-subtle)', borderRadius: 9, fontSize: 11.5, fontWeight: 600, color: 'var(--bw-ink-soft)', lineHeight: 1.4 }}>
              {t('sidebar.affectedAt')} <strong>+{projectedRiseCm} cm</strong>, {t('sidebar.affectedSpread')}{' '}
              <strong style={{ color: 'var(--bw-primary-deep)' }}>≈{diameter.toFixed(1)}× {t('sidebar.affectedWider')}</strong>{' '}
              (<strong style={{ color: 'var(--bw-primary-deep)' }}>≈{area.toFixed(1)}× {t('sidebar.theArea')}</strong>).
            </div>
          );
        })()}
      </CollapsibleSection>

      {/* MONITORING-AREA RADIUS */}
      <CollapsibleSection
        title={t('sidebar.monitoringArea')}
        open={openSections.monitor}
        onToggle={() => toggleSection('monitor')}
        right={<span style={{ fontSize: 12.5, fontWeight: 800, color: 'var(--bw-primary-deep)' }}>{fmtRadius(monitorRadiusKm)}</span>}
      >
        <div style={{ fontSize: 11.5, color: 'var(--bw-muted)', lineHeight: 1.45, marginBottom: 10 }}>
          {t('sidebar.monitorDesc')}
        </div>
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
        <div style={{ fontSize: 11.5, color: 'var(--bw-muted)', lineHeight: 1.45, marginBottom: 8 }}>
          {t('sidebar.alertsDesc')}
        </div>
        <button
          onClick={onOpenNotify}
          style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 11, padding: '11px 13px', borderRadius: 12, border: `1.5px solid ${notifyOn ? '#BAE2FB' : 'var(--bw-line)'}`, background: notifyOn ? '#EFF8FF' : '#fff', cursor: 'pointer', textAlign: 'left' }}
        >
          <span style={{ fontSize: 16, flex: 'none' }}>🔔</span>
          <span style={{ flex: 1, minWidth: 0 }}>
            <span style={{ display: 'block', fontSize: 13, fontWeight: 800, color: 'var(--bw-ink)' }}>{t('sidebar.floodAlerts')}</span>
            <span style={{ display: 'block', fontSize: 11.5, color: 'var(--bw-muted)', marginTop: 1 }}>
              {notifyOn ? `${t('sidebar.alertsOn')} ${fmtRadius(notifyRadiusKm)}` : t('sidebar.alertsOff')}
            </span>
          </span>
          <span style={{ fontSize: 11.5, fontWeight: 800, color: notifyOn ? 'var(--bw-primary-deep)' : 'var(--bw-muted)', flex: 'none' }}>
            {notifyOn ? t('sidebar.edit') : t('sidebar.setUp')}
          </span>
        </button>
      </div>

      {/* SUMMARY + TABS */}
      <div style={{ flex: 'none', padding: '0 18px 12px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 7, fontSize: 12.5, color: 'var(--bw-muted)', fontWeight: 600, marginBottom: 11 }}>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}><span style={{ width: 8, height: 8, borderRadius: '50%', background: '#EF4444' }} /><b style={{ color: 'var(--bw-ink)' }}>{highCount}</b> {t('sidebar.high')}</span>
          <span style={{ color: '#D5DDE3' }}>·</span>
          <span><b style={{ color: 'var(--bw-ink)' }}>{totalCount}</b> {t('sidebar.activeReports')}</span>
          {impassableRoadCount > 0 && (
            <>
              <span style={{ color: '#D5DDE3' }}>·</span>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                <span style={{ width: 14, height: 4, borderRadius: 2, background: ROAD_META.impassable.color }} />
                <b style={{ color: 'var(--bw-ink)' }}>{impassableRoadCount}</b> {impassableRoadCount === 1 ? t('sidebar.road') : t('sidebar.roadsPlural')} {t('sidebar.roadImpassable')}
              </span>
            </>
          )}
        </div>
        <div style={{ display: 'flex', gap: 4, padding: 4, background: 'var(--bw-bg-subtle)', borderRadius: 12 }}>
          {(['nearby', 'activity', 'archive'] as Tab[]).map((t2) => (
            <div
              key={t2}
              onClick={() => onTab(t2)}
              style={{ flex: 1, textAlign: 'center', padding: '8px 0', borderRadius: 9, fontSize: 13, fontWeight: 700, cursor: 'pointer', color: tab === t2 ? '#0F172A' : '#94A3B8', background: tab === t2 ? '#fff' : 'transparent', boxShadow: tab === t2 ? '0 1px 3px rgba(15,23,42,.12)' : 'none' }}
            >
              {t2 === 'nearby' ? t('sidebar.nearby') : t2 === 'archive' ? t('sidebar.archive') : t('sidebar.liveActivity')}
            </div>
          ))}
        </div>
      </div>

      {/* LIST */}
      <div style={isMobile
        ? { overflowY: 'visible', padding: '0 18px 14px', display: 'flex', flexDirection: 'column', gap: 9 }
        : { flex: 1, overflowY: 'auto', padding: '0 18px 12px', display: 'flex', flexDirection: 'column', gap: 9 }}>
        {list.map((r) => {
          const isArchive = tab === 'archive';
          const sel = !isArchive && r.id === selectedReportId;
          const tm = TREND_META[r.trend];
          const rm = ROAD_META[r.road];
          return (
            <div
              key={r.id}
              onClick={isArchive ? undefined : () => onSelectReport(r.id)}
              style={{ padding: '12px 13px', borderRadius: 14, cursor: isArchive ? 'default' : 'pointer', opacity: isArchive ? 0.72 : 1, display: 'block', border: sel ? `1.5px solid ${r.sev.color}` : '1px solid var(--bw-line-soft)', background: sel ? r.sev.soft : isArchive ? 'var(--bw-bg-subtle)' : '#fff', transition: 'all .12s' }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ width: 10, height: 10, borderRadius: '50%', flex: 'none', background: r.sev.color }} />
                <span style={{ fontSize: 14, fontWeight: 800, letterSpacing: '-.01em' }}>{r.name}</span>
                {r.mine && <span style={{ fontSize: 9.5, fontWeight: 800, color: '#0EA5E9', background: '#E3F4FC', padding: '2px 6px', borderRadius: 6 }}>{t('report.yours')}</span>}
                <span style={{ fontSize: 11, color: '#9AA8B4', fontWeight: 600, marginLeft: 'auto' }}>{r.time}</span>
              </div>
              <div style={{ fontSize: 11.5, color: 'var(--bw-muted)', fontWeight: 600, margin: '4px 0 9px 18px' }}>{r.district} · {r.distKm.toFixed(1)} {t('report.kmAway')}</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginLeft: 18 }}>
                <span style={{ background: r.sev.soft, color: r.sev.color, fontSize: 11, fontWeight: 800, padding: '3px 9px', borderRadius: 999 }}>{r.depthCm} cm</span>
                <span style={{ color: tm.color, fontSize: 11, fontWeight: 800, display: 'inline-flex', alignItems: 'center', gap: 4 }}><span>{tm.sym}</span>{trendLabel(lang, r.trend)}</span>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 11, fontWeight: 700, color: '#5A6875' }}><span style={{ width: 8, height: 8, borderRadius: '50%', background: rm.color }} />{roadLabel(lang, r.road)}</span>
                <span style={{ fontSize: 11, color: '#9AA8B4', fontWeight: 600 }}>{r.reportsCount}× {t('report.confirmed')}</span>
                {r.guest && (
                  <span style={{ fontSize: 11, fontWeight: 800, color: '#B45309', background: '#FFF7ED', padding: '2px 7px', borderRadius: 6 }}>⚠ {t('report.unverified')}</span>
                )}
                {r.system && (
                  <span style={{ fontSize: 11, fontWeight: 800, color: '#4338CA', background: '#EEF2FF', padding: '2px 7px', borderRadius: 6 }}>🛈 {t('report.system')}</span>
                )}
                {r.expired
                  ? <span style={{ fontSize: 11, fontWeight: 700, color: '#9AA8B4' }}>{t('report.expired')}</span>
                  : <span style={{ fontSize: 11, fontWeight: 700, color: '#C2620B' }}>⏳ {formatDuration(r.expiresInMin)} {t('report.left')}</span>}
              </div>
            </div>
          );
        })}
        {list.length === 0 && (
          <div style={{ textAlign: 'center', padding: '30px 10px', color: '#9AA8B4', fontSize: 13 }}>{tab === 'archive' ? t('sidebar.noArchive') : t('sidebar.noReports')}</div>
        )}
      </div>

      {/* FOOTER — public visit counter. Pinned to the sidebar bottom on desktop (the list above
          takes the remaining height); flows after the list on mobile. Hidden until the count loads. */}
      {visitCount != null && (
        <div
          title={`${visitCount.toLocaleString()} total visits`}
          style={{ flex: 'none', borderTop: '1px solid var(--bw-line-soft)', padding: '10px 18px', textAlign: 'center', fontSize: 11.5, fontWeight: 700, color: 'var(--bw-muted)', letterSpacing: '.01em' }}
        >
          <span aria-hidden="true">👁</span> {visitCount.toLocaleString()} {t('sidebar.totalVisits')}
        </div>
      )}
    </div>
  );
};

export default Sidebar;
