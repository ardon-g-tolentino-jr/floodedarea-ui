import React from 'react';
import type { AlertLevel, EvacuationCenter, FloodAlert, LatLng, RescueRequest, RescueStatus, RoadSegment } from '../../types';
import { ApiError } from '../../api/client';
import { RESCUE_STATUS_META, ROAD_META, SEV_META } from '../../utils/floodMeta';
import {
  buildRoadDirectory,
  districtHotspots,
  enrichRescues,
  hourlySurge,
  rescueQueue,
  type EnrichedReport,
  type EnrichedRescue,
} from '../../utils/viewModel';
import { formatDuration } from '../../utils/format';
import FloodMap, { type MapFocus } from '../map/FloodMap';

interface ResponseConsoleProps {
  rescues: RescueRequest[];
  reports: EnrichedReport[];   // currently-active enriched reports
  centers: EvacuationCenter[];
  roadSegments: RoadSegment[];
  alerts: FloodAlert[];
  userLoc: LatLng;
  now: number;
  isMobile: boolean;
  loading?: boolean;
  error?: Error | null;
  busyId?: number | null;      // rescue id whose status update is in flight
  onUpdateRescueStatus: (id: number, status: RescueStatus) => void;
  onClose: () => void;
}

const ALERT_RANK: Record<AlertLevel, number> = { red: 3, orange: 2, yellow: 1 };

// KPI chip tones, drawn from the app's palette.
const TONE = {
  red: { fg: '#B91C1C', bg: '#FEF2F2' },
  amber: { fg: '#B45309', bg: '#FFFBEB' },
  blue: { fg: '#1D4ED8', bg: '#EFF6FF' },
  green: { fg: '#15803D', bg: '#F0FDF4' },
  slate: { fg: '#334155', bg: '#F1F5F9' },
} as const;
type Tone = keyof typeof TONE;

const Kpi: React.FC<{ label: string; value: React.ReactNode; tone?: Tone; emphasize?: boolean }> = ({ label, value, tone = 'slate', emphasize }) => {
  const t = TONE[tone];
  return (
    <div style={{ flex: '1 0 auto', minWidth: 92, padding: '9px 12px', borderRadius: 12, background: t.bg, border: '1px solid var(--bw-line-soft)' }}>
      <div style={{ fontSize: 9.5, fontWeight: 800, letterSpacing: '.09em', color: t.fg, textTransform: 'uppercase', opacity: 0.85 }}>{label}</div>
      <div style={{ fontSize: emphasize ? 23 : 20, fontWeight: 800, color: t.fg, lineHeight: 1.1, marginTop: 2 }}>{value}</div>
    </div>
  );
};

const Section: React.FC<{ title: string; sub?: string; children: React.ReactNode }> = ({ title, sub, children }) => (
  <div style={{ border: '1px solid var(--bw-line)', borderRadius: 14, overflow: 'hidden', background: '#fff' }}>
    <div style={{ padding: '11px 13px', borderBottom: '1px solid var(--bw-line-soft)' }}>
      <div style={{ fontSize: 13.5, fontWeight: 800 }}>{title}</div>
      {sub && <div style={{ fontSize: 11, color: 'var(--bw-muted)', marginTop: 1 }}>{sub}</div>}
    </div>
    <div style={{ padding: 13 }}>{children}</div>
  </div>
);

const Muted: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div style={{ fontSize: 12.5, color: 'var(--bw-muted)', textAlign: 'center', padding: '18px 8px' }}>{children}</div>
);

const StatusPill: React.FC<{ status: RescueStatus }> = ({ status }) => {
  const m = RESCUE_STATUS_META[status] ?? RESCUE_STATUS_META.pending;
  return (
    <span style={{ flex: 'none', fontSize: 10.5, fontWeight: 800, color: m.fg, background: m.bg, padding: '3px 8px', borderRadius: 999 }}>{m.label}</span>
  );
};

const ResponseConsole: React.FC<ResponseConsoleProps> = ({
  rescues,
  reports,
  centers,
  roadSegments,
  alerts,
  userLoc,
  now,
  isMobile,
  loading,
  error,
  busyId,
  onUpdateRescueStatus,
  onClose,
}) => {
  const [statusFilter, setStatusFilter] = React.useState<'all' | RescueStatus>('all');
  const [districtFilter, setDistrictFilter] = React.useState<string>('all');
  const [selectedRescueId, setSelectedRescueId] = React.useState<number | null>(null);
  const [mapFocus, setMapFocus] = React.useState<MapFocus | null>(null);

  const enriched = React.useMemo(() => enrichRescues(rescues, reports, now), [rescues, reports, now]);
  const queue = React.useMemo(() => rescueQueue(enriched), [enriched]);

  const counts = React.useMemo(() => {
    const c = { pending: 0, dispatched: 0, resolved: 0 };
    for (const r of enriched) c[r.status]++;
    return c;
  }, [enriched]);

  const districts = React.useMemo(
    () => [...new Set(enriched.map((r) => r.district?.trim() || 'Unknown area'))].sort((a, b) => a.localeCompare(b)),
    [enriched]
  );

  const filteredQueue = React.useMemo(
    () =>
      queue.filter(
        (r) =>
          (statusFilter === 'all' || r.status === statusFilter) &&
          (districtFilter === 'all' || (r.district?.trim() || 'Unknown area') === districtFilter)
      ),
    [queue, statusFilter, districtFilter]
  );

  const hotspots = React.useMemo(() => districtHotspots(reports, rescues), [reports, rescues]);
  const surge = React.useMemo(() => hourlySurge(reports, rescues, 12, now), [reports, rescues, now]);
  const impassableRoads = React.useMemo(
    () =>
      buildRoadDirectory(reports)
        .flatMap((d) => d.roads)
        .filter((r) => r.road === 'impassable')
        .sort((a, b) => b.depthCm - a.depthCm),
    [reports]
  );

  const highCount = React.useMemo(() => reports.filter((r) => r.severity === 'high').length, [reports]);
  const risingCount = React.useMemo(() => reports.filter((r) => r.trend === 'rising').length, [reports]);
  const worstAlert = React.useMemo(
    () => alerts.filter((a) => a.active).sort((a, b) => ALERT_RANK[b.level] - ALERT_RANK[a.level])[0],
    [alerts]
  );

  const focus = React.useCallback((r: EnrichedRescue): void => {
    setSelectedRescueId(r.id);
    setMapFocus({ lat: r.latitude, lng: r.longitude, key: Date.now() });
  }, []);

  const surgeMax = Math.max(1, ...surge.flatMap((b) => [b.rescues, b.reports]));

  const actionBtn = (label: string, onClick: () => void, kind: 'dispatch' | 'resolve' | 'ghost', busy: boolean): React.ReactNode => {
    const s =
      kind === 'dispatch'
        ? { bg: RESCUE_STATUS_META.dispatched.color, fg: '#fff', bd: RESCUE_STATUS_META.dispatched.color }
        : kind === 'resolve'
          ? { bg: RESCUE_STATUS_META.resolved.color, fg: '#fff', bd: RESCUE_STATUS_META.resolved.color }
          : { bg: '#fff', fg: 'var(--bw-ink-soft)', bd: 'var(--bw-line)' };
    return (
      <button
        disabled={busy}
        onClick={onClick}
        style={{ border: `1px solid ${s.bd}`, background: s.bg, color: s.fg, padding: '5px 11px', borderRadius: 8, fontSize: 11.5, fontWeight: 800, cursor: busy ? 'wait' : 'pointer', flex: 'none', opacity: busy ? 0.6 : 1 }}
      >
        {label}
      </button>
    );
  };

  // Queue body: surface auth/outage messaging the same way the rescue chart does.
  const status = error instanceof ApiError ? error.status : undefined;
  const queueBody =
    error && enriched.length === 0 ? (
      <div style={{ textAlign: 'center', padding: '28px 10px', color: '#B91C1C', fontSize: 13, lineHeight: 1.5 }}>
        {status === 401 ? 'Sign in to view rescue requests.' : status === 403 ? 'You don’t have access to rescue requests.' : 'Couldn’t load rescue requests.'}
        <div style={{ color: '#9AA8B4', fontSize: 12, marginTop: 4 }}>
          {status === 401 ? 'Your session may have expired — sign in again.' : status === 403 ? 'This view isn’t available for your account.' : 'Check the backend is running, then reopen.'}
        </div>
      </div>
    ) : loading && enriched.length === 0 ? (
      <Muted>Loading rescue requests…</Muted>
    ) : enriched.length === 0 ? (
      <Muted>No rescue requests right now.</Muted>
    ) : filteredQueue.length === 0 ? (
      <Muted>No requests match this filter.</Muted>
    ) : (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {filteredQueue.map((r) => {
          const busy = busyId === r.id;
          const sel = selectedRescueId === r.id;
          return (
            <div
              key={r.id}
              onClick={() => focus(r)}
              style={{ display: 'flex', flexDirection: 'column', gap: 8, padding: '10px 11px', borderRadius: 12, background: sel ? '#EFF8FF' : 'var(--bw-bg-subtle)', border: `1px solid ${sel ? '#BAE2FB' : 'transparent'}`, cursor: 'pointer' }}
            >
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 9 }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 800, color: 'var(--bw-ink)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={r.place}>
                    {r.place}
                  </div>
                  <div style={{ fontSize: 11.5, color: 'var(--bw-muted)', marginTop: 2, display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
                    <span>⏱ waiting {formatDuration(r.waitMin)}</span>
                    {r.reRequested && <span style={{ color: '#B45309', fontWeight: 800 }}>· asked again</span>}
                  </div>
                  {r.note && <div style={{ fontSize: 11.5, color: 'var(--bw-ink-soft)', marginTop: 3 }}>“{r.note}”</div>}
                </div>
                <StatusPill status={r.status} />
              </div>
              <div style={{ display: 'flex', gap: 7, flexWrap: 'wrap' }} onClick={(e) => e.stopPropagation()}>
                {r.status === 'pending' && actionBtn(busy ? '…' : 'Dispatch', () => onUpdateRescueStatus(r.id, 'dispatched'), 'dispatch', busy)}
                {(r.status === 'pending' || r.status === 'dispatched') && actionBtn(busy ? '…' : 'Resolve', () => onUpdateRescueStatus(r.id, 'resolved'), 'resolve', busy)}
                {r.status === 'resolved' && actionBtn(busy ? '…' : 'Reopen', () => onUpdateRescueStatus(r.id, 'pending'), 'ghost', busy)}
                {actionBtn('Focus', () => focus(r), 'ghost', false)}
              </div>
            </div>
          );
        })}
      </div>
    );

  const queueSection = (
    <Section title="Rescue triage" sub={`${counts.pending} pending · ${counts.dispatched} dispatched`}>
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 10 }}>
        {(['all', 'pending', 'dispatched', 'resolved'] as const).map((s) => {
          const on = statusFilter === s;
          const label = s === 'all' ? `All (${enriched.length})` : `${RESCUE_STATUS_META[s].label} (${counts[s]})`;
          return (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
              style={{ border: `1px solid ${on ? 'var(--bw-primary)' : 'var(--bw-line)'}`, background: on ? '#EFF8FF' : '#fff', color: on ? 'var(--bw-primary)' : 'var(--bw-ink-soft)', padding: '5px 10px', borderRadius: 999, fontSize: 11.5, fontWeight: 800, cursor: 'pointer' }}
            >
              {label}
            </button>
          );
        })}
      </div>
      {districts.length > 1 && (
        <select
          value={districtFilter}
          onChange={(e) => setDistrictFilter(e.target.value)}
          style={{ width: '100%', padding: '7px 9px', border: '1px solid var(--bw-line)', borderRadius: 9, fontSize: 12.5, color: 'var(--bw-ink)', background: '#fff', marginBottom: 11 }}
        >
          <option value="all">All districts</option>
          {districts.map((d) => (
            <option key={d} value={d}>{d}</option>
          ))}
        </select>
      )}
      {queueBody}
    </Section>
  );

  const mapSection = (
    <div style={{ height: isMobile ? 240 : 300, borderRadius: 14, overflow: 'hidden', border: '1px solid var(--bw-line)' }}>
      <FloodMap
        userLoc={userLoc}
        reports={reports}
        centers={centers}
        roadSegments={roadSegments}
        showRoads
        showShelters
        projectedRiseCm={0}
        monitorRadiusKm={0}
        selectedReportId={null}
        selEvacId={null}
        reportMode={false}
        pending={null}
        focus={mapFocus}
        searchMark={null}
        onMapClick={() => {}}
        onSelectReport={() => {}}
        onSelectEvac={() => {}}
        rescues={filteredQueue}
        selectedRescueId={selectedRescueId}
        onSelectRescue={(id) => {
          const r = enriched.find((x) => x.id === id);
          if (r) focus(r);
        }}
      />
    </div>
  );

  const hotspotsSection = (
    <Section title="Hotspots" sub="Districts by combined response load">
      {hotspots.length === 0 ? (
        <Muted>No active hotspots.</Muted>
      ) : (
        hotspots.slice(0, 6).map((h, i) => {
          const sevColor = h.worstSeverity ? SEV_META[h.worstSeverity].color : '#94A3B8';
          const pct = Math.max(8, (h.score / (hotspots[0].score || 1)) * 100);
          return (
            <div key={h.district} style={{ marginBottom: i === Math.min(5, hotspots.length - 1) ? 0 : 11 }}>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
                <div style={{ flex: 1, fontSize: 12.5, fontWeight: 800, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {i + 1}. {h.district}
                </div>
                <div style={{ fontSize: 11, color: 'var(--bw-muted)', fontWeight: 700, flex: 'none' }}>
                  {[h.rescueCount > 0 ? `${h.rescueCount} 🛟` : '', h.highCount > 0 ? `${h.highCount} high` : '', h.risingCount > 0 ? `${h.risingCount} ▲` : ''].filter(Boolean).join(' · ')}
                </div>
              </div>
              <div style={{ height: 8, background: 'var(--bw-bg-subtle)', borderRadius: 6, overflow: 'hidden', marginTop: 4 }}>
                <div style={{ width: `${pct}%`, height: '100%', background: sevColor, borderRadius: 6 }} />
              </div>
            </div>
          );
        })
      )}
    </Section>
  );

  const surgeSection = (
    <Section title="Activity (last 12 h)" sub="Reports & rescue requests per hour">
      <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 9, fontSize: 11, fontWeight: 700, color: 'var(--bw-muted)' }}>
        <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
          <span style={{ width: 9, height: 9, borderRadius: 2, background: '#F59E0B' }} /> Rescues
        </span>
        <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
          <span style={{ width: 9, height: 9, borderRadius: 2, background: '#0EA5E9' }} /> Reports
        </span>
      </div>
      <div style={{ display: 'flex', alignItems: 'flex-end', gap: 4, height: 84 }}>
        {surge.map((b, i) => (
          <div key={b.start} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3, height: '100%' }}>
            <div style={{ flex: 1, width: '100%', display: 'flex', alignItems: 'flex-end', justifyContent: 'center', gap: 2 }}>
              <div title={`${b.rescues} rescue${b.rescues === 1 ? '' : 's'}`} style={{ width: 5, height: `${(b.rescues / surgeMax) * 100}%`, minHeight: b.rescues ? 2 : 0, background: '#F59E0B', borderRadius: 2 }} />
              <div title={`${b.reports} report${b.reports === 1 ? '' : 's'}`} style={{ width: 5, height: `${(b.reports / surgeMax) * 100}%`, minHeight: b.reports ? 2 : 0, background: '#0EA5E9', borderRadius: 2 }} />
            </div>
            <div style={{ fontSize: 8.5, color: 'var(--bw-faint)', fontWeight: 700, height: 11 }}>{i % 3 === 0 ? b.label : ''}</div>
          </div>
        ))}
      </div>
    </Section>
  );

  const accessSection = (
    <Section title="Access — impassable roads" sub="Blocking routes to victims & shelters">
      {impassableRoads.length === 0 ? (
        <Muted>No impassable roads reported.</Muted>
      ) : (
        impassableRoads.slice(0, 8).map((rd) => (
          <div
            key={rd.key}
            onClick={() => setMapFocus({ lat: rd.latitude, lng: rd.longitude, key: Date.now() })}
            style={{ display: 'flex', alignItems: 'center', gap: 9, padding: '8px 10px', borderRadius: 10, background: 'var(--bw-bg-subtle)', marginBottom: 6, cursor: 'pointer' }}
          >
            <span style={{ color: ROAD_META.impassable.color, fontWeight: 800, fontSize: 13, flex: 'none' }}>{ROAD_META.impassable.glyph}</span>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 12.5, fontWeight: 800, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{rd.name}</div>
              <div style={{ fontSize: 11, color: 'var(--bw-muted)' }}>
                {rd.district} · {rd.depthCm} cm{rd.confirmed ? '' : ' · unconfirmed'}
              </div>
            </div>
          </div>
        ))
      )}
    </Section>
  );

  return (
    <div
      onClick={onClose}
      style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,.55)', backdropFilter: 'blur(3px)', zIndex: 1200, display: 'flex', alignItems: isMobile ? 'stretch' : 'center', justifyContent: 'center', padding: isMobile ? 0 : 18 }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{ width: isMobile ? '100%' : 'min(1180px, 96vw)', height: isMobile ? '100%' : '92vh', display: 'flex', flexDirection: 'column', background: '#fff', borderRadius: isMobile ? 0 : 18, boxShadow: '0 24px 70px rgba(15,23,42,.4)', overflow: 'hidden' }}
      >
        {/* Header */}
        <div style={{ background: 'linear-gradient(135deg,#0EA5E9,#0369A1)', padding: '15px 20px', color: '#fff', display: 'flex', alignItems: 'center', gap: 12, flex: 'none' }}>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 18, fontWeight: 800, display: 'flex', alignItems: 'center', gap: 9 }}>
              Response console
              <span style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11, fontWeight: 800, background: 'rgba(255,255,255,.18)', padding: '2px 9px', borderRadius: 999 }}>
                <span style={{ width: 7, height: 7, borderRadius: '50%', background: '#4ADE80', boxShadow: '0 0 0 3px rgba(74,222,128,.35)' }} /> Live
              </span>
            </div>
            <div style={{ fontSize: 12, opacity: 0.9 }}>Triage &amp; dispatch rescue requests across the flood zone</div>
          </div>
          <button onClick={onClose} aria-label="Close" style={{ border: 0, background: 'rgba(255,255,255,.18)', color: '#fff', width: 28, height: 28, borderRadius: 8, fontSize: 17, cursor: 'pointer', flex: 'none' }}>×</button>
        </div>

        {/* KPI strip */}
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', padding: '12px 16px', borderBottom: '1px solid var(--bw-line-soft)', flex: 'none', background: '#FBFDFE' }}>
          <Kpi label="Pending" value={counts.pending} tone={counts.pending > 0 ? 'red' : 'slate'} emphasize />
          <Kpi label="Dispatched" value={counts.dispatched} tone="blue" />
          <Kpi label="Resolved" value={counts.resolved} tone="green" />
          <Kpi label="Active reports" value={reports.length} tone="slate" />
          <Kpi label="High severity" value={highCount} tone={highCount > 0 ? 'red' : 'slate'} />
          <Kpi label="Rising" value={risingCount} tone={risingCount > 0 ? 'amber' : 'slate'} />
          <Kpi label="Impassable" value={impassableRoads.length} tone={impassableRoads.length > 0 ? 'red' : 'slate'} />
          <Kpi label="Rainfall" value={worstAlert ? worstAlert.level.toUpperCase() : 'None'} tone={worstAlert ? (worstAlert.level === 'red' ? 'red' : 'amber') : 'slate'} />
        </div>

        {/* Body */}
        <div style={{ flex: 1, overflowY: 'auto', padding: isMobile ? 12 : '16px 18px', display: 'flex', flexDirection: isMobile ? 'column' : 'row', gap: 16, alignItems: 'flex-start' }}>
          <div style={{ flex: isMobile ? undefined : 1.1, width: '100%', minWidth: 0 }}>{queueSection}</div>
          <div style={{ flex: isMobile ? undefined : 0.9, width: '100%', minWidth: 0, display: 'flex', flexDirection: 'column', gap: 14 }}>
            {mapSection}
            {hotspotsSection}
            {surgeSection}
            {accessSection}
          </div>
        </div>
      </div>
    </div>
  );
};

export default ResponseConsole;
