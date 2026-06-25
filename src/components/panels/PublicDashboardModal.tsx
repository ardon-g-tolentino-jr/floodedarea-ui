import React from 'react';
import type { FloodReport, LatLng } from '../../types';
import type { DistrictRoads, PossibleClosure, NearbyClosure } from '../../utils/viewModel';
import { closuresNearLocation, recentReportRows } from '../../utils/viewModel';
import { ROAD_META, SEV_META, TREND_META } from '../../utils/floodMeta';
import { searchPlaces, MIN_QUERY_LENGTH, type GeoResult } from '../../api/geocode';
import { useI18n, roadShort, trendLabel } from '../../i18n';

interface PublicDashboardModalProps {
  /** Raw reports — the table windows these to the last 12 h itself (not the short-TTL active set). */
  reports: FloodReport[];
  /** Directly-reported roads with their condition, grouped by district. */
  directory: DistrictRoads[];
  /** Inferred possible closures (roads inside nearby flooded areas). */
  closures: PossibleClosure[];
  isMobile: boolean;
  now: number;
  /** Fly the map to a location (and close the dashboard). */
  onShowOnMap: (loc: LatLng) => void;
  onClose: () => void;
}

const SEARCH_DEBOUNCE_MS = 350;
const RADIUS_OPTIONS = [1, 2, 3, 5, 10]; // km — the searched location's "impact radius"
const DEFAULT_RADIUS_KM = 3;
const PAGE_SIZE_OPTIONS = [10, 25, 50];
const REPORT_WINDOW_HOURS = 12;

/** A condition pill (Impassable / Risky) shared by the closure list. */
const ConditionPill: React.FC<{ status: NearbyClosure['status'] }> = ({ status }) => {
  const { lang } = useI18n();
  const rm = ROAD_META[status];
  return (
    <span
      style={{
        flex: 'none',
        display: 'inline-flex',
        alignItems: 'center',
        gap: 5,
        padding: '3px 9px',
        borderRadius: 999,
        background: rm.soft,
        color: rm.color,
        fontSize: 11,
        fontWeight: 800,
      }}
    >
      <span>{rm.glyph}</span>
      {roadShort(lang, status)}
    </span>
  );
};

/**
 * Public flood dashboard. Search any location to list every possible road closure within its impact
 * radius, plus a paginated table of cities/districts and user reports from the last 12 hours, ordered
 * by deepest water. No sign-in required — built for public, at-a-glance situational awareness.
 */
const PublicDashboardModal: React.FC<PublicDashboardModalProps> = ({
  reports,
  directory,
  closures,
  isMobile,
  now,
  onShowOnMap,
  onClose,
}) => {
  const { lang, t } = useI18n();
  // ── Location search (impact-radius closures) ──
  const [query, setQuery] = React.useState('');
  const [results, setResults] = React.useState<GeoResult[]>([]);
  const [searching, setSearching] = React.useState(false);
  const [open, setOpen] = React.useState(false);
  const [place, setPlace] = React.useState<GeoResult | null>(null);
  const [radiusKm, setRadiusKm] = React.useState(DEFAULT_RADIUS_KM);
  const abortRef = React.useRef<AbortController | null>(null);

  React.useEffect(() => {
    const q = query.trim();
    if (q.length < MIN_QUERY_LENGTH) {
      setResults([]);
      setSearching(false);
      abortRef.current?.abort();
      return;
    }
    setSearching(true);
    const timer = window.setTimeout(async () => {
      abortRef.current?.abort();
      const ac = new AbortController();
      abortRef.current = ac;
      const found = await searchPlaces(q, ac.signal);
      if (ac.signal.aborted) return;
      setResults(found);
      setSearching(false);
      setOpen(true);
    }, SEARCH_DEBOUNCE_MS);
    return () => window.clearTimeout(timer);
  }, [query]);

  const choosePlace = (r: GeoResult): void => {
    setPlace(r);
    setQuery(r.label);
    setOpen(false);
    setResults([]);
  };

  const nearbyClosures = React.useMemo(
    () => (place ? closuresNearLocation(directory, closures, { lat: place.lat, lng: place.lng }, radiusKm) : []),
    [place, directory, closures, radiusKm]
  );

  // ── Recent-reports table (last 12 h, deepest first, paginated) ──
  const rows = React.useMemo(() => recentReportRows(reports, REPORT_WINDOW_HOURS, now), [reports, now]);
  const [pageSize, setPageSize] = React.useState(PAGE_SIZE_OPTIONS[0]);
  const [page, setPage] = React.useState(0);
  const pageCount = Math.max(1, Math.ceil(rows.length / pageSize));
  // Keep the current page in range when the data or page size changes.
  React.useEffect(() => { setPage((p) => Math.min(p, pageCount - 1)); }, [pageCount]);
  const pageRows = React.useMemo(() => rows.slice(page * pageSize, page * pageSize + pageSize), [rows, page, pageSize]);
  const rangeStart = rows.length === 0 ? 0 : page * pageSize + 1;
  const rangeEnd = Math.min(rows.length, (page + 1) * pageSize);

  const flyTo = (loc: LatLng): void => { onShowOnMap(loc); onClose(); };

  const th: React.CSSProperties = {
    textAlign: 'left',
    padding: '9px 12px',
    fontSize: 10.5,
    fontWeight: 800,
    letterSpacing: '.06em',
    color: 'var(--bw-faint)',
    textTransform: 'uppercase',
    whiteSpace: 'nowrap',
    borderBottom: '1px solid var(--bw-line)',
    background: 'var(--bw-bg-subtle)',
    position: 'sticky',
    top: 0,
  };
  const td: React.CSSProperties = { padding: '10px 12px', fontSize: 12.5, color: 'var(--bw-ink)', borderBottom: '1px solid var(--bw-line-soft)', verticalAlign: 'middle' };

  const searchSection = (
    <div>
      <div style={{ fontSize: 13, fontWeight: 800, marginBottom: 8 }}>{t('dash.closuresNear')}</div>
      <div style={{ position: 'relative' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 9, padding: '0 13px', height: 42, background: 'var(--bw-bg-subtle)', border: '1px solid var(--bw-line)', borderRadius: 11 }}>
          <span style={{ fontSize: 14, color: '#9AA8B4', flex: 'none' }}>⌕</span>
          <input
            autoFocus={!isMobile}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onFocus={() => { if (results.length) setOpen(true); }}
            placeholder={t('dash.searchPlaceholder')}
            style={{ border: 0, background: 'transparent', outline: 'none', fontSize: 13.5, width: '100%', color: 'var(--bw-ink)' }}
          />
          {query && (
            <button
              type="button"
              aria-label="Clear search"
              onMouseDown={(e) => { e.preventDefault(); setQuery(''); setResults([]); setOpen(false); setPlace(null); }}
              style={{ border: 0, background: 'transparent', color: '#9AA8B4', fontSize: 15, cursor: 'pointer', flex: 'none', padding: 0, lineHeight: 1 }}
            >
              ×
            </button>
          )}
        </div>
        {open && (searching || results.length > 0) && (
          <div style={{ position: 'absolute', top: 'calc(100% + 6px)', left: 0, right: 0, zIndex: 30, background: '#fff', border: '1px solid var(--bw-line)', borderRadius: 11, boxShadow: '0 12px 34px rgba(15,23,42,.18)', overflow: 'hidden', maxHeight: 280, overflowY: 'auto' }}>
            {searching && results.length === 0 ? (
              <div style={{ padding: '12px 14px', fontSize: 12.5, color: 'var(--bw-muted)' }}>{t('dash.searching')}</div>
            ) : (
              results.map((r, i) => (
                <button
                  key={r.id}
                  type="button"
                  onMouseDown={(e) => { e.preventDefault(); choosePlace(r); }}
                  style={{ display: 'flex', alignItems: 'flex-start', gap: 9, width: '100%', textAlign: 'left', padding: '10px 13px', border: 0, borderTop: i === 0 ? 'none' : '1px solid var(--bw-line)', background: '#fff', cursor: 'pointer', fontSize: 13, color: 'var(--bw-ink)', lineHeight: 1.35 }}
                >
                  <span style={{ fontSize: 13, color: '#9AA8B4', flex: 'none', marginTop: 1 }}>⚲</span>
                  <span style={{ overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', wordBreak: 'break-word' }}>{r.label}</span>
                </button>
              ))
            )}
          </div>
        )}
      </div>

      {/* Impact-radius control */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 11, flexWrap: 'wrap' }}>
        <span style={{ fontSize: 11.5, fontWeight: 700, color: 'var(--bw-muted)' }}>{t('dash.impactRadius')}</span>
        {RADIUS_OPTIONS.map((km) => (
          <button
            key={km}
            onClick={() => setRadiusKm(km)}
            style={{
              padding: '5px 11px',
              borderRadius: 999,
              border: `1px solid ${radiusKm === km ? 'var(--bw-primary)' : 'var(--bw-line)'}`,
              background: radiusKm === km ? '#EFF8FF' : '#fff',
              color: radiusKm === km ? 'var(--bw-primary)' : 'var(--bw-ink-soft)',
              fontSize: 12,
              fontWeight: 800,
              cursor: 'pointer',
            }}
          >
            {km} km
          </button>
        ))}
      </div>

      {/* Results */}
      <div style={{ marginTop: 12 }}>
        {!place ? (
          <div style={{ padding: '22px 12px', textAlign: 'center', color: 'var(--bw-muted)', fontSize: 12.5, border: '1px dashed var(--bw-line)', borderRadius: 12 }}>
            {t('dash.searchPrompt')}
          </div>
        ) : nearbyClosures.length === 0 ? (
          <div style={{ padding: '22px 12px', textAlign: 'center', color: 'var(--bw-muted)', fontSize: 12.5, border: '1px dashed var(--bw-line)', borderRadius: 12 }}>
            {t('dash.noClosures')} {radiusKm} km {t('dash.ofThisLocation')}
          </div>
        ) : (
          <>
            <div style={{ fontSize: 11.5, color: 'var(--bw-muted)', fontWeight: 700, marginBottom: 8 }}>
              {nearbyClosures.length} {t('dash.possible')} {nearbyClosures.length === 1 ? t('dash.closure') : t('dash.closures')} {t('dash.within')} {radiusKm} km
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
              {nearbyClosures.map((c) => {
                const rm = ROAD_META[c.status];
                return (
                  <button
                    key={c.key}
                    onClick={() => flyTo({ lat: c.latitude, lng: c.longitude })}
                    style={{ display: 'flex', alignItems: 'center', gap: 10, width: '100%', textAlign: 'left', padding: '10px 12px', border: '1px solid var(--bw-line-soft)', borderLeft: `3px ${c.inferred ? 'dashed' : 'solid'} ${rm.color}`, borderRadius: 11, background: c.inferred ? 'var(--bw-bg-subtle)' : '#fff', cursor: 'pointer' }}
                  >
                    <span style={{ flex: 1, minWidth: 0 }}>
                      <span style={{ display: 'block', fontSize: 13.5, fontWeight: 800, color: 'var(--bw-ink)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.name}</span>
                      <span style={{ display: 'block', fontSize: 11.5, color: 'var(--bw-muted)', fontWeight: 600, marginTop: 2 }}>
                        {c.distanceKm.toFixed(1)} km {t('dash.away')} · ~{c.depthCm} cm{c.inferred ? ` ${t('dash.est')}` : c.reportCount ? ` · ${c.reportCount} ${c.reportCount === 1 ? t('dash.report') : t('dash.reports')}` : ''}
                        {c.inferred && <span style={{ color: '#B45309', fontWeight: 700 }}> · {t('dash.inferred')}</span>}
                      </span>
                    </span>
                    <ConditionPill status={c.status} />
                  </button>
                );
              })}
            </div>
          </>
        )}
      </div>
    </div>
  );

  const tableSection = (
    <div>
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap', marginBottom: 8 }}>
        <div style={{ fontSize: 13, fontWeight: 800 }}>{t('dash.reports12h')}</div>
        <div style={{ fontSize: 11.5, color: 'var(--bw-muted)', fontWeight: 600 }}>{t('dash.orderedByDepth')}</div>
      </div>

      {rows.length === 0 ? (
        <div style={{ padding: '26px 12px', textAlign: 'center', color: 'var(--bw-muted)', fontSize: 12.5, border: '1px dashed var(--bw-line)', borderRadius: 12 }}>
          {t('dash.noRecent')}
        </div>
      ) : (
        <>
          <div style={{ border: '1px solid var(--bw-line)', borderRadius: 12, overflow: 'hidden' }}>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 560 }}>
                <thead>
                  <tr>
                    <th style={{ ...th, width: 34, textAlign: 'right' }}>#</th>
                    <th style={th}>{t('dash.colCity')}</th>
                    <th style={th}>{t('dash.colDistrict')}</th>
                    <th style={th}>{t('dash.colReport')}</th>
                    <th style={{ ...th, textAlign: 'right' }}>{t('dash.colWaterLevel')}</th>
                    <th style={{ ...th, textAlign: 'right' }}>{t('dash.colReported')}</th>
                  </tr>
                </thead>
                <tbody>
                  {pageRows.map((r, i) => {
                    const sev = SEV_META[r.severity];
                    const tm = TREND_META[r.trend];
                    return (
                      <tr
                        key={r.id}
                        onClick={() => flyTo({ lat: r.latitude, lng: r.longitude })}
                        style={{ cursor: 'pointer' }}
                      >
                        <td style={{ ...td, textAlign: 'right', color: 'var(--bw-faint)', fontWeight: 700 }}>{page * pageSize + i + 1}</td>
                        <td style={{ ...td, fontWeight: 700 }}>{r.city}</td>
                        <td style={{ ...td, color: 'var(--bw-muted)' }}>{r.district}</td>
                        <td style={{ ...td, maxWidth: 220 }}>
                          <span style={{ display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.name}</span>
                          {r.reportsCount > 1 && (
                            <span style={{ fontSize: 11, color: 'var(--bw-muted)', fontWeight: 600 }}>{r.reportsCount} {t('dash.reports')}</span>
                          )}
                        </td>
                        <td style={{ ...td, textAlign: 'right', whiteSpace: 'nowrap' }}>
                          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, justifyContent: 'flex-end' }}>
                            <span style={{ fontWeight: 800, color: sev.color }}>{r.depthCm} cm</span>
                            <span title={trendLabel(lang, r.trend)} style={{ color: tm.color, fontSize: 11 }}>{tm.sym}</span>
                          </span>
                        </td>
                        <td style={{ ...td, textAlign: 'right', color: 'var(--bw-muted)', whiteSpace: 'nowrap' }}>{r.time}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Pagination */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap', marginTop: 10 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: 'var(--bw-muted)', fontWeight: 600 }}>
              <span>{t('dash.showing')} {rangeStart}–{rangeEnd} {t('dash.of')} {rows.length}</span>
              <span style={{ color: 'var(--bw-line)' }}>·</span>
              <label style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                {t('dash.rows')}
                <select
                  value={pageSize}
                  onChange={(e) => { setPageSize(Number(e.target.value)); setPage(0); }}
                  style={{ border: '1px solid var(--bw-line)', borderRadius: 8, padding: '4px 6px', fontSize: 12, fontWeight: 700, color: 'var(--bw-ink)', background: '#fff', cursor: 'pointer' }}
                >
                  {PAGE_SIZE_OPTIONS.map((n) => <option key={n} value={n}>{n}</option>)}
                </select>
              </label>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <button
                onClick={() => setPage((p) => Math.max(0, p - 1))}
                disabled={page === 0}
                style={{ padding: '6px 12px', borderRadius: 9, border: '1px solid var(--bw-line)', background: '#fff', fontSize: 12.5, fontWeight: 700, color: page === 0 ? 'var(--bw-faint)' : 'var(--bw-ink)', cursor: page === 0 ? 'default' : 'pointer' }}
              >
                {t('common.prev')}
              </button>
              <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--bw-muted)', minWidth: 64, textAlign: 'center' }}>{t('dash.page')} {page + 1} / {pageCount}</span>
              <button
                onClick={() => setPage((p) => Math.min(pageCount - 1, p + 1))}
                disabled={page >= pageCount - 1}
                style={{ padding: '6px 12px', borderRadius: 9, border: '1px solid var(--bw-line)', background: '#fff', fontSize: 12.5, fontWeight: 700, color: page >= pageCount - 1 ? 'var(--bw-faint)' : 'var(--bw-ink)', cursor: page >= pageCount - 1 ? 'default' : 'pointer' }}
              >
                {t('common.next')}
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );

  const card = (
    <div style={{ background: '#fff', borderRadius: isMobile ? '18px 18px 0 0' : 18, boxShadow: '0 18px 50px rgba(15,23,42,.32)', overflow: 'hidden', border: '1px solid var(--bw-line)', display: 'flex', flexDirection: 'column', maxHeight: isMobile ? '92vh' : '88vh' }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 9, padding: '16px 18px 12px', borderBottom: '1px solid var(--bw-line-soft)', flex: 'none' }}>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 16, fontWeight: 800, letterSpacing: '-.01em' }}>{t('dash.title')}</div>
          <div style={{ fontSize: 12, color: 'var(--bw-muted)', fontWeight: 600, marginTop: 2 }}>{t('dash.subtitle')}</div>
        </div>
        <button
          onClick={onClose}
          aria-label="Close"
          style={{ border: 0, background: 'var(--bw-bg-subtle)', color: '#7C8B98', width: 28, height: 28, borderRadius: 8, fontSize: 16, cursor: 'pointer', flex: 'none' }}
        >
          ×
        </button>
      </div>

      <div style={{ padding: '16px 18px 22px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 22 }}>
        {searchSection}
        {tableSection}
      </div>
    </div>
  );

  if (isMobile) {
    return (
      <>
        <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,.4)', zIndex: 1200 }} />
        <div style={{ position: 'fixed', left: 0, right: 0, bottom: 0, zIndex: 1210, animation: 'sheetUp .22s ease-out' }}>{card}</div>
      </>
    );
  }
  return (
    <>
      <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,.4)', zIndex: 1200 }} />
      <div style={{ position: 'fixed', left: '50%', top: '50%', transform: 'translate(-50%,-50%)', width: 'min(880px, 94vw)', zIndex: 1210, animation: 'popIn .14s ease-out' }}>{card}</div>
    </>
  );
};

export default PublicDashboardModal;
