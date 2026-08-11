import React from 'react';
import type { Road, Severity } from '../../types';
import type { AuthState } from '../../hooks/useAuth';
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
  /** Layer toggle for the flood-prone zone circles + map name bubbles. */
  showFloodProne: boolean;
  onToggleFloodProne: () => void;
  impassableRoadCount: number;
  highCount: number;
  totalCount: number;
  selectedReportId: number | null;
  onSelectReport: (id: number) => void;
  /** Public all-time visit count; `null` while loading or if the stats endpoint is unavailable. */
  visitCount: number | null;
  /** Trip-monitoring panel body (TripPanel), rendered inside the strip's `trip` chip — App
   *  composes it so Sidebar stays presentational. */
  tripSlot?: React.ReactNode;
  /** Trip state for the `trip` chip's badge; the body itself is only mounted while that chip is
   *  open, so the counts have to come in from App (see `tripAlertCount` in TripPanel). */
  tripActive: boolean;
  tripAlertCount: number;
  /** The real session (not the TopBar's guest-hidden version) — needed to distinguish a guest from
   *  no session at all for the dismissible guest nudge card below. */
  auth: AuthState | null;
  /** Whether the guest nudge card has been dismissed for this device (`baha_guest_nudge_v1`). */
  guestNudgeDismissed: boolean;
  onDismissGuestNudge: () => void;
  onSignIn: (reason?: string) => void;
}

const TONE: Record<SafetyStatus['tone'], { bg: string; border: string; title: string; badge: string }> = {
  danger: { bg: '#FEF2F2', border: '#FCA5A5', title: '#B91C1C', badge: '#EF4444' },
  warn: { bg: '#FFFBEB', border: '#FCD34D', title: '#B45309', badge: '#F59E0B' },
  ok: { bg: '#F0FDF4', border: '#86EFAC', title: '#15803D', badge: '#16A34A' },
};

/** Show metres under 1 km, kilometres otherwise (e.g. 200 m, 500 m, 1 km). */
const fmtRadius = (km: number): string =>
  km < 1 ? `${Math.round(km * 1000)} m` : `${Number.isInteger(km) ? km : km.toFixed(1)} km`;

/** The three control groups above the report tabs. At most one is open at a time — collapsing five
 *  stacked sections into one chip row is what leaves the tab list its half of the sidebar. */
type PanelKey = 'trip' | 'filters' | 'area';
const PANEL_STORAGE_KEY = 'baha_sidebar_panel_v1';

const SUBHEAD: React.CSSProperties = {
  fontSize: 10, fontWeight: 800, letterSpacing: '.1em', color: 'var(--bw-faint)', marginBottom: 9,
};

/** One chip in the control strip: a label plus an at-a-glance badge for the state hidden inside. */
const StripChip: React.FC<{
  label: string;
  badge?: React.ReactNode;
  open: boolean;
  onClick: () => void;
}> = ({ label, badge, open, onClick }) => (
  <button
    onClick={onClick}
    aria-expanded={open}
    style={{
      flex: 1, minWidth: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5,
      padding: '8px 6px', borderRadius: 999, cursor: 'pointer',
      border: `1.5px solid ${open ? 'var(--bw-primary)' : '#E2E8F0'}`,
      background: open ? 'rgba(14,165,233,.10)' : '#fff',
      color: open ? 'var(--bw-ink)' : '#5A6875',
      fontSize: 12.5, fontWeight: 700, whiteSpace: 'nowrap',
    }}
  >
    {label}
    {badge}
  </button>
);

const Sidebar: React.FC<SidebarProps> = (props) => {
  const { isMobile, status, list, tab, onTab, filters, filterCounts, onToggleFilter, roadFilters, roadCounts, onToggleRoad, onOpenRoads, projectedRiseCm, onChangeRise, representativeDepthCm, monitorRadiusKm, onChangeMonitor, notifyOn, notifyRadiusKm, onOpenNotify, showShelters, onToggleShelters, showRoads, onToggleRoads, showFloodProne, onToggleFloodProne, impassableRoadCount, highCount, totalCount, selectedReportId, onSelectReport, visitCount, tripSlot, tripActive, tripAlertCount, auth, guestNudgeDismissed, onDismissGuestNudge, onSignIn } = props;
  const { lang, t } = useI18n();
  const tone = TONE[status.tone];

  const [openPanel, setOpenPanel] = React.useState<PanelKey | null>(() => {
    try {
      const raw = localStorage.getItem(PANEL_STORAGE_KEY);
      return raw === 'trip' || raw === 'filters' || raw === 'area' ? raw : null;
    } catch {
      return null;
    }
  });
  const togglePanel = (k: PanelKey): void =>
    setOpenPanel((cur) => {
      const next = cur === k ? null : k;
      try {
        if (next) localStorage.setItem(PANEL_STORAGE_KEY, next);
        else localStorage.removeItem(PANEL_STORAGE_KEY);
      } catch {/* ignore */}
      return next;
    });

  /** How many of the eight map toggles are currently hiding something. Badged on the Filters chip
   *  because "why can't I see a report?" is the only question the collapsed group needs to answer. */
  const filtersOff =
    (['high', 'medium', 'low'] as Severity[]).filter((k) => !filters[k]).length +
    ROAD_ORDER.filter((k) => !roadFilters[k]).length +
    (showShelters ? 0 : 1) + (showRoads ? 0 : 1) + (showFloodProne ? 0 : 1);

  const sidebarStyle: React.CSSProperties = isMobile
    ? { flex: 'none', width: '100%', background: '#fff', display: 'flex', flexDirection: 'column', paddingBottom: 80 }
    : { flex: 'none', width: 386, background: '#fff', borderLeft: '1px solid var(--bw-line)', display: 'flex', flexDirection: 'column', overflow: 'hidden' };

  /** Desktop: the controls are the only shrinkable child, so any overflow scrolls here instead of
   *  squeezing the report list below its 50% floor. Mobile keeps everything in normal flow. */
  const controlsStyle: React.CSSProperties = isMobile
    ? { flex: 'none' }
    : { flex: '0 1 auto', minHeight: 0, overflowY: 'auto' };

  return (
    <div style={sidebarStyle}>
      <div style={controlsStyle}>
        {/* STATUS — the badge already says "your safety status", so no separate label. The grey
            advisory sub-line only earns its height when the news isn't good. */}
        <div style={{ flex: 'none', padding: '14px 18px 10px' }}>
          <div style={{ background: tone.bg, border: `1px solid ${tone.border}`, borderRadius: 16, padding: '13px 16px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 9, marginBottom: 8 }}>
              <span style={{ background: tone.badge, color: '#fff', fontSize: 10, fontWeight: 800, letterSpacing: '.08em', padding: '3px 9px', borderRadius: 7, whiteSpace: 'nowrap' }}>{status.badge}</span>
              <span style={{ fontSize: 11.5, color: 'var(--bw-muted)', fontWeight: 600, marginLeft: 'auto' }}>{t('sidebar.updatedLive')}</span>
            </div>
            <div style={{ color: tone.title, fontSize: 18, fontWeight: 800, letterSpacing: '-.01em', lineHeight: 1.2 }}>{status.title}</div>
            <div style={{ fontSize: 13, color: '#475563', marginTop: 6, lineHeight: 1.45 }}>{status.line}</div>
            {status.tone !== 'ok' && (
              <div style={{ fontSize: 12, color: 'var(--bw-muted)', marginTop: 7, lineHeight: 1.4 }}>{status.sub}</div>
            )}
            {status.eta && (
              <div style={{ marginTop: 10, paddingTop: 9, borderTop: '1px solid rgba(15,23,42,.08)', fontSize: 12, fontWeight: 700, color: '#475563', display: 'flex', gap: 7, lineHeight: 1.4 }}>
                <span style={{ flex: 'none' }}>⏱</span><span>{status.eta}</span>
              </div>
            )}
          </div>
        </div>

        {/* CONTROL STRIP — Trip / Filters / My area, one body open at a time */}
        <div style={{ flex: 'none', padding: '0 18px 12px' }}>
          <div style={{ display: 'flex', gap: 6 }}>
            <StripChip
              label={t('sidebar.panelTrip')}
              open={openPanel === 'trip'}
              onClick={() => togglePanel('trip')}
              badge={!tripActive ? undefined : tripAlertCount > 0
                ? <span style={{ fontWeight: 800, color: '#B45309' }}>⚠ {tripAlertCount}</span>
                : <span style={{ fontWeight: 800, color: '#16A34A' }}>✓</span>}
            />
            <StripChip
              label={t('sidebar.panelFilters')}
              open={openPanel === 'filters'}
              onClick={() => togglePanel('filters')}
              badge={filtersOff > 0 ? <span style={{ fontWeight: 800, color: '#B45309' }}>{filtersOff}</span> : undefined}
            />
            <StripChip
              label={t('sidebar.panelArea')}
              open={openPanel === 'area'}
              onClick={() => togglePanel('area')}
              badge={
                <span style={{ fontWeight: 800, color: 'var(--bw-primary-deep)' }}>
                  {projectedRiseCm > 0 ? `+${projectedRiseCm}cm` : fmtRadius(monitorRadiusKm)}
                </span>
              }
            />
          </div>

          {openPanel && (
            <div style={{ marginTop: 10, padding: '13px 14px', border: '1px solid var(--bw-line-soft)', borderRadius: 14, background: '#fff' }}>
              {openPanel === 'trip' && tripSlot}

              {openPanel === 'filters' && (
                <>
                  <div style={SUBHEAD}>{t('sidebar.showOnMap')}</div>
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
                    <button
                      onClick={onToggleFloodProne}
                      style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '7px 12px', borderRadius: 999, border: `1.5px solid ${showFloodProne ? '#EAB308' : '#E2E8F0'}`, background: showFloodProne ? 'rgba(234,179,8,.12)' : '#fff', color: showFloodProne ? '#854D0E' : '#9AA8B4', fontSize: 12.5, fontWeight: 700, cursor: 'pointer' }}
                    >
                      <span style={{ width: 9, height: 9, borderRadius: '50%', background: '#EAB308', opacity: showFloodProne ? 1 : 0.4, flex: 'none' }} />
                      {t('sidebar.floodProne')}
                    </button>
                  </div>

                  <div style={{ ...SUBHEAD, marginTop: 14 }}>{t('sidebar.roadCondition')}</div>
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
                </>
              )}

              {openPanel === 'area' && (
                <>
                  {/* MONITORING-AREA RADIUS */}
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 9 }}>
                    <span style={{ ...SUBHEAD, marginBottom: 0 }}>{t('sidebar.monitoringArea')}</span>
                    <span style={{ marginLeft: 'auto', fontSize: 12.5, fontWeight: 800, color: 'var(--bw-primary-deep)' }}>{fmtRadius(monitorRadiusKm)}</span>
                  </div>
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

                  {/* AFFECTED AREA — predictive water-rise projection */}
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, margin: '16px 0 9px', paddingTop: 14, borderTop: '1px solid var(--bw-line-soft)' }}>
                    <span style={{ ...SUBHEAD, marginBottom: 0 }}>{t('sidebar.affectedArea')}</span>
                    <span style={{ marginLeft: 'auto', fontSize: 12.5, fontWeight: 800, color: projectedRiseCm > 0 ? 'var(--bw-primary-deep)' : 'var(--bw-muted)' }}>
                      {projectedRiseCm > 0 ? `+${projectedRiseCm} cm` : t('sidebar.now')}
                    </span>
                  </div>
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

                  {/* ALERTS — radius-scoped like the two sliders above it */}
                  <button
                    onClick={onOpenNotify}
                    style={{ width: '100%', marginTop: 16, display: 'flex', alignItems: 'center', gap: 11, padding: '11px 13px', borderRadius: 12, border: `1.5px solid ${notifyOn ? '#BAE2FB' : 'var(--bw-line)'}`, background: notifyOn ? '#EFF8FF' : '#fff', cursor: 'pointer', textAlign: 'left' }}
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
                </>
              )}
            </div>
          )}
        </div>

        {/* GUEST NUDGE — only for a guest session or no session at all; dismissible for the device. */}
        {!guestNudgeDismissed && (auth === null || auth.role === 'GUEST') && (
          <div style={{ flex: 'none', margin: '0 18px 14px', padding: '11px 12px', background: '#EFF6FF', border: '1px solid #BFDBFE', borderRadius: 12, position: 'relative' }}>
            <button
              onClick={onDismissGuestNudge}
              aria-label={t('common.close')}
              style={{ position: 'absolute', top: 8, right: 8, border: 0, background: 'transparent', color: '#7C8B98', width: 22, height: 22, borderRadius: 6, fontSize: 14, cursor: 'pointer' }}
            >
              ×
            </button>
            <div style={{ fontSize: 12, fontWeight: 600, color: '#1D4ED8', lineHeight: 1.5, paddingRight: 20 }}>
              {t('guest.nudgeBody')}
            </div>
            <button
              onClick={() => onSignIn(t('guest.defaultReason'))}
              style={{ marginTop: 9, border: 0, background: 'var(--bw-primary)', color: '#fff', padding: '8px 13px', borderRadius: 9, fontSize: 12.5, fontWeight: 800, cursor: 'pointer' }}
            >
              {t('guest.signInGoogle')}
            </button>
          </div>
        )}
      </div>

      {/* SUMMARY + TABS */}
      <div style={{ flex: 'none', padding: '0 18px 12px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 7, fontSize: 12.5, color: 'var(--bw-muted)', fontWeight: 600, marginBottom: 10, whiteSpace: 'nowrap' }}>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}><span style={{ width: 8, height: 8, borderRadius: '50%', background: '#EF4444' }} /><b style={{ color: 'var(--bw-ink)' }}>{highCount}</b> {t('sidebar.high')}</span>
          <span style={{ color: '#D5DDE3' }}>·</span>
          <span><b style={{ color: 'var(--bw-ink)' }}>{totalCount}</b> {t('sidebar.activeShort')}</span>
          {impassableRoadCount > 0 && (
            <>
              <span style={{ color: '#D5DDE3' }}>·</span>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                <span style={{ width: 14, height: 4, borderRadius: 2, background: ROAD_META.impassable.color }} />
                <b style={{ color: 'var(--bw-ink)' }}>{impassableRoadCount}</b> {t('sidebar.roadImpassable')}
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

      {/* LIST — with every panel closed (the common case) `flex-shrink: 0` against a 50% basis
          guarantees the tabs and their list half the sidebar, and the controls above absorb the
          overflow by scrolling. While a panel is open the user has asked for that panel, so the
          list yields down to a still-usable floor instead of squeezing the panel into a slit. */}
      <div style={isMobile
        ? { overflowY: 'visible', padding: '0 18px 14px', display: 'flex', flexDirection: 'column', gap: 9 }
        : openPanel
          ? { flex: '1 1 auto', minHeight: 168, overflowY: 'auto', padding: '0 18px 12px', display: 'flex', flexDirection: 'column', gap: 9 }
          : { flex: '1 0 50%', minHeight: 0, overflowY: 'auto', padding: '0 18px 12px', display: 'flex', flexDirection: 'column', gap: 9 }}>
        {list.map((r) => {
          const isArchive = tab === 'archive';
          const sel = !isArchive && r.id === selectedReportId;
          const tm = TREND_META[r.trend];
          const rm = ROAD_META[r.road];
          return (
            <div
              key={r.id}
              onClick={isArchive ? undefined : () => onSelectReport(r.id)}
              style={{ padding: '12px 13px', borderRadius: 14, cursor: isArchive ? 'default' : 'pointer', opacity: isArchive ? 0.72 : 1, display: 'block', border: sel ? `1.5px solid ${r.sev.color}` : '1px solid var(--bw-line-soft)', background: sel ? r.sev.soft : isArchive ? 'var(--bw-bg-subtle)' : '#fff', transition: 'all .12s', flex: 'none' }}
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
