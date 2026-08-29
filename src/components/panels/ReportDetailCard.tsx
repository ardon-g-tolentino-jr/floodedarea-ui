import React from 'react';
import type { NewReport, ReportStatus, Road } from '../../types';
import { affectedRiseRatio, REPORT_TTL_MIN, type EnrichedReport } from '../../utils/viewModel';
import { ADVICE, PROJECT_MAX_CM, ROAD_META, ROAD_ORDER, TREND_META, TTL_STOPS_MIN, drainMinutes, nearestTtlStop, projectedSeries, projectionRateCmPerHr, sparkPaths, trendNote } from '../../utils/floodMeta';
import { formatDepth, formatDuration, timeAgo } from '../../utils/format';
import { useI18n } from '../../i18n';
import DepthReference from './DepthReference';
import SliderRow from './SliderRow';

interface ReportDetailCardProps {
  report: EnrichedReport;
  isMobile: boolean;
  canConfirm: boolean;
  confirming: boolean;
  onConfirm: () => void;
  canRemove: boolean;
  removing: boolean;
  onRemove: () => void;
  /** Absolute URL to the report's flood photo, or null when none was attached. */
  photoSrc: string | null;
  /** Share this report (native photo share on mobile, web sharer fallback). */
  onShareReport: () => void;
  projectedRiseCm: number;
  onClose: () => void;
  /** Gates the admin override block (depth/road correction, +Extend 1 hour). */
  isAdmin: boolean;
  /** Global "rain is falling now" flag — flips the chart/note direction and surfaces a banner. */
  rainActive: boolean;
  /** The app's 15s clock tick — drives the chart's solid/dashed split without a dedicated timer. */
  now: number;
  /** Admin save — reuses App's onUpdateReport (adminAction → refetch → toast). */
  onAdminUpdate: (id: number, b: Partial<NewReport & { status: ReportStatus }>) => Promise<void>;
  /** Admin reopen — same shape as onAdminUpdate but wired to its own toast/tab handling in App
   *  (see onReopenReport), since bringing a report back is a different admin action than a plain
   *  correction even though both PATCH the same endpoint. */
  onReopenReport: (id: number, b: Partial<NewReport & { status: ReportStatus }>) => Promise<void>;
}

/** Neutral share glyph (24×24 fill path) — the share action isn't Facebook-specific: on mobile it
 *  opens the native sheet, so the button must not imply one network. */
const SHARE_GLYPH =
  'M18 16.08c-.76 0-1.44.3-1.96.77L8.91 12.7c.05-.23.09-.46.09-.7s-.04-.47-.09-.7l7.05-4.11c.54.5 1.25.81 2.04.81 1.66 0 3-1.34 3-3s-1.34-3-3-3-3 1.34-3 3c0 .24.04.47.09.7L8.04 9.81C7.5 9.31 6.79 9 6 9c-1.66 0-3 1.34-3 3s1.34 3 3 3c.79 0 1.5-.31 2.04-.81l7.12 4.16c-.05.21-.08.43-.08.65 0 1.61 1.31 2.92 2.92 2.92s2.92-1.31 2.92-2.92-1.31-2.92-2.92-2.92z';

const DEPTH_TICKS = [
  { l: 'Ankle', cm: 15 },
  { l: 'Knee', cm: 50 },
  { l: 'Waist', cm: 100 },
  { l: 'Chest', cm: 140 },
];

const ReportDetailCard: React.FC<ReportDetailCardProps> = ({ report, isMobile, canConfirm, confirming, onConfirm, canRemove, removing, onRemove, photoSrc, onShareReport, projectedRiseCm, onClose, isAdmin, rainActive, now, onAdminUpdate, onReopenReport }) => {
  const { t } = useI18n();
  const [confirmRemove, setConfirmRemove] = React.useState(false);
  const rise = projectedRiseCm > 0 ? affectedRiseRatio(report.depthCm, projectedRiseCm) : null;
  const sev = report.sev;
  const tm = TREND_META[report.trend];
  const ptm = TREND_META[report.projectedTrend]; // colors the note, which now describes the model's trajectory
  // ROADS cell + advice track the current (possibly projected) condition, matching the map overlay
  // and road directory — both already decay off projectedDepthCm, so this card must agree with them.
  const rm = ROAD_META[report.projectedRoad];
  const advice = ADVICE[report.projectedRoad];
  // Observed anchor point + one hourly point per PROJECT_HOURS forward; nowIndex splits the chart
  // into a solid observed segment and a dashed predictive tail (same model driving report.projectedDepthCm).
  const { points, nowIndex } = projectedSeries(report, rainActive, now);
  const series = points.map((p) => p.depthCm);
  const spark = sparkPaths(series, nowIndex);
  const note = trendNote(report.projectedDepthCm, report.projectedTrend, projectionRateCmPerHr(report, rainActive));
  const depthPct = Math.min(report.depthCm / 150, 1) * 100;
  const edgeLabel = report.edgeKm <= 0 ? 'you are inside this zone' : `${report.distKm.toFixed(1)} km away`;

  // ── Admin override: depth/road correction + TTL extension (or, for an expired report, reopen) ──
  // Seed from the OBSERVATION (report.depthCm), not the projection, when the report is expired: for
  // an expired report projectedDepthCm is the drained figure (≈0–2 cm — see DRAINED_CM), which would
  // make a reopen a no-op. A live report still seeds from the projection, as before.
  const [adminDepth, setAdminDepth] = React.useState(report.expired ? report.depthCm : report.projectedDepthCm);
  const [adminRoad, setAdminRoad] = React.useState<Road>(report.road);
  const [savingOverride, setSavingOverride] = React.useState(false);
  const [extending, setExtending] = React.useState(false);
  const [overrideError, setOverrideError] = React.useState<string | null>(null);
  // The reopen TTL as an OVERRIDE, not a snapshot: null means "fall through to the estimate for
  // whatever depth is currently in the stepper", so correcting the depth (or the global rain flag
  // flipping) re-times the lifetime until the admin pins a value on the slider. Same auto/pinned
  // rule AdminQuickReportView's per-row `ttls` map follows. Only meaningful while report.expired.
  const [reopenTtl, setReopenTtl] = React.useState<number | null>(null);
  // Reset the draft when a different report is opened — but not on every prop refresh of the SAME
  // report, or the admin's in-progress edit would get clobbered by the next 15s tick's re-projection.
  React.useEffect(() => {
    setAdminDepth(report.expired ? report.depthCm : report.projectedDepthCm);
    setAdminRoad(report.road);
    setReopenTtl(null);
    setOverrideError(null);
  }, [report.id]); // eslint-disable-line react-hooks/exhaustive-deps
  const effectiveTtlMin = report.ttlMinutes && report.ttlMinutes > 0 ? report.ttlMinutes : REPORT_TTL_MIN[report.severity];
  // How long the depth now in the stepper should take to drain, and the lifetime the reopen will
  // actually send — the admin's pinned value when there is one, otherwise that estimate.
  const reopenEstimateMin = drainMinutes(adminDepth, rainActive);
  const reopenTtlMin = reopenTtl ?? reopenEstimateMin;
  // Close on success, keep the sheet open with an inline error on failure — onClose() unmounts the
  // card, so it must run only after the finally has settled savingOverride, and only once the PATCH
  // is confirmed to have landed. Matches the AdminPanel.tsx submit() precedent.
  const handleSaveOverride = async (): Promise<void> => {
    setSavingOverride(true);
    setOverrideError(null);
    try {
      await onAdminUpdate(report.id, { depthCm: adminDepth, road: adminRoad });
    } catch {
      setOverrideError('Could not save. Please try again.');
      return;
    } finally {
      setSavingOverride(false);
    }
    onClose(); // only after the finally has run, only on success
  };
  const handleReopen = async (): Promise<void> => {
    setSavingOverride(true);
    setOverrideError(null);
    try {
      // depthCm is what re-anchors observationAnchorMs server-side (see the comment on `expired`
      // in viewModel.ts) — a ttlMinutes-only patch would leave the report `drained` and it would
      // never actually reappear. severity is deliberately not re-derived, matching Save override.
      await onReopenReport(report.id, { depthCm: adminDepth, road: adminRoad, ttlMinutes: reopenTtlMin });
    } catch {
      setOverrideError('Could not save. Please try again.');
      return;
    } finally {
      setSavingOverride(false);
    }
    onClose();
  };
  const handleExtend = async (): Promise<void> => {
    setExtending(true);
    try {
      await onAdminUpdate(report.id, { ttlMinutes: effectiveTtlMin + 60 });
    } finally {
      setExtending(false);
    }
  };

  const card = (
    <div style={{ background: 'var(--bw-surface)', borderRadius: 16, boxShadow: '0 14px 40px rgba(15,23,42,.3)', overflow: 'hidden', border: '1px solid var(--bw-line)' }}>
      <div style={{ padding: '14px 15px 12px', borderBottom: '1px solid var(--bw-line-soft)' }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 9 }}>
          <span style={{ width: 14, height: 14, borderRadius: '50%', marginTop: 3, flex: 'none', background: sev.color }} />
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 15, fontWeight: 800, lineHeight: 1.15 }}>{report.name}</div>
            <div style={{ fontSize: 11.5, color: 'var(--bw-muted)', fontWeight: 600 }}>{report.district} · {edgeLabel}</div>
          </div>
          <button onClick={onClose} style={{ border: 0, background: 'var(--bw-bg-subtle)', color: 'var(--bw-muted)', width: 26, height: 26, borderRadius: 7, fontSize: 15, cursor: 'pointer', flex: 'none' }}>×</button>
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 7, marginTop: 10 }}>
          <span style={{ background: sev.soft, color: sev.color, fontSize: 11, fontWeight: 800, padding: '4px 10px', borderRadius: 8 }}>
            {sev.label} flooding · {formatDepth(report.depthCm)} · <DepthReference depthCm={report.depthCm} color={sev.color} compact />
          </span>
          <span
            title="Reports stay live for a freshness window (longer for more severe floods, or a custom window for system reports), then drop off the map."
            style={{ background: report.expired ? 'var(--bw-bg-subtle)' : 'var(--bw-tint-warn)', color: report.expired ? 'var(--bw-faint)' : 'var(--bw-on-tint-warn)', fontSize: 11, fontWeight: 800, padding: '4px 10px', borderRadius: 8 }}
          >
            ⏳ {report.expired ? 'Expired' : `Expires in ${formatDuration(report.expiresInMin)}`}
          </span>
          {report.guest && (
            <span
              title="Posted by a guest (no account). Treat as unverified until others confirm it."
              style={{ background: 'var(--bw-tint-warn)', color: 'var(--bw-on-tint-warn)', fontSize: 11, fontWeight: 800, padding: '4px 10px', borderRadius: 8 }}
            >
              ⚠ Unverified
            </span>
          )}
          {report.system && (
            <span
              title="Logged by a FloodedArea admin from news or other sources."
              style={{ background: 'var(--bw-tint-info)', color: 'var(--bw-accent-indigo)', fontSize: 11, fontWeight: 800, padding: '4px 10px', borderRadius: 8 }}
            >
              🛈 System report
            </span>
          )}
        </div>
        {report.system && report.reportedAt && (
          <div style={{ marginTop: 8, fontSize: 11.5, color: 'var(--bw-muted)', fontWeight: 600 }}>
            🕑 Reported {timeAgo(report.reportedAt)} · from source
          </div>
        )}
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
        {rainActive && (
          <div style={{ marginBottom: 11, padding: '8px 11px', background: 'var(--bw-tint-info)', color: 'var(--bw-on-tint-info)', borderRadius: 10, fontSize: 11.5, fontWeight: 700, lineHeight: 1.4 }}>
            🌧 Rain is falling — projected levels here are climbing, not receding.
          </div>
        )}
        <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: '.1em', color: 'var(--bw-faint)', marginBottom: 7 }}>WATER DEPTH</div>
        <div style={{ position: 'relative', height: 10, background: 'var(--bw-bg-subtle)', borderRadius: 6, overflow: 'hidden', marginBottom: 4 }}>
          <div style={{ position: 'absolute', left: 0, top: 0, height: '100%', borderRadius: 6, width: `${depthPct}%`, background: sev.color }} />
        </div>
        <div style={{ position: 'relative', height: 26, marginBottom: 10 }}>
          {DEPTH_TICKS.map((t) => (
            <div key={t.l} style={{ position: 'absolute', transform: 'translateX(-50%)', textAlign: 'center', left: `${Math.min(t.cm / 150, 1) * 100}%` }}>
              <div style={{ width: 1, height: 5, background: 'var(--bw-line-strong)', margin: '0 auto' }} />
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

        <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: '.1em', color: 'var(--bw-faint)', margin: '2px 0 4px' }}>WATER LEVEL · OBSERVED → PROJECTED</div>
        <div style={{ fontSize: 11.5, fontWeight: 700, color: 'var(--bw-ink-soft)', marginBottom: 6 }}>
          Reported {formatDepth(report.depthCm)} ({report.ageMin < 1 ? 'just now' : `${formatDuration(report.ageMin)} ago`})
          {report.predictive && (
            <> · <span style={{ color: sev.color }}>Projected now {report.projectedDepthCm} cm · predictive</span></>
          )}
        </div>
        <div style={{ background: 'var(--bw-surface-sunken)', borderRadius: 11, padding: '10px 10px 6px', marginBottom: 10 }}>
          <svg viewBox="0 0 100 36" preserveAspectRatio="none" style={{ width: '100%', height: 46, display: 'block' }}>
            <path d={spark.area} fill={sev.soft} />
            {spark.dashedLine && (
              <line
                x1={(nowIndex / (series.length - 1)) * 100}
                x2={(nowIndex / (series.length - 1)) * 100}
                y1={0}
                y2={36}
                stroke="var(--bw-line-strong)"
                strokeWidth={1}
                strokeDasharray="2 2"
                vectorEffect="non-scaling-stroke"
              />
            )}
            <path d={spark.line} fill="none" stroke={sev.color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
            {spark.dashedLine && (
              <path d={spark.dashedLine} fill="none" stroke={sev.color} strokeWidth={2} strokeDasharray="4 3" strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
            )}
          </svg>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 9, color: 'var(--bw-faint)', fontWeight: 700, marginTop: 3 }}>
            {[0, 2, 4, 6].map((i) => {
              const offset = i - nowIndex;
              return <span key={i}>{offset === 0 ? 'now' : offset < 0 ? `${offset}h` : `+${offset}h`}</span>;
            })}
          </div>
        </div>
        <div style={{ marginTop: 9, fontSize: 12, fontWeight: 700, color: ptm.color, lineHeight: 1.4 }}>{note}</div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 9, marginTop: 11 }}>
          <Cell label="TREND"><span style={{ color: tm.color, fontSize: 13, fontWeight: 800, display: 'flex', alignItems: 'center', gap: 5 }}><span>{tm.sym}</span>{tm.label}</span></Cell>
          <Cell label="ROADS"><span style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12.5, fontWeight: 800 }}><span style={{ width: 9, height: 9, borderRadius: '50%', background: rm.color }} />{rm.label}</span></Cell>
          <Cell label="CONFIRMED BY"><span style={{ fontSize: 13, fontWeight: 800 }}>{report.reportsCount} {report.reportsCount === 1 ? 'report' : 'reports'}</span></Cell>
          <Cell label="LAST UPDATE"><span style={{ fontSize: 13, fontWeight: 800 }}>{report.time}</span></Cell>
        </div>

        <div style={{ marginTop: 11, padding: '10px 12px', background: advice.bg, color: advice.col, borderRadius: 11, fontSize: 12, fontWeight: 600, lineHeight: 1.4 }}>{advice.txt}</div>

        <button
          onClick={onShareReport}
          style={{ marginTop: 11, width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, border: 0, background: 'var(--bw-primary)', color: 'var(--bw-on-accent)', padding: 11, borderRadius: 11, fontSize: 13.5, fontWeight: 800, cursor: 'pointer' }}
        >
          <svg viewBox="0 0 24 24" width={15} height={15} fill="currentColor" aria-hidden="true" style={{ display: 'block' }}>
            <path d={SHARE_GLYPH} />
          </svg>
          Share Report
        </button>

        {canConfirm && (
          <button
            onClick={onConfirm}
            disabled={confirming}
            style={{ marginTop: 11, width: '100%', border: '1.5px solid var(--bw-primary)', background: 'var(--bw-surface)', color: 'var(--bw-primary-deep)', padding: 11, borderRadius: 11, fontSize: 13.5, fontWeight: 800, cursor: confirming ? 'wait' : 'pointer', opacity: confirming ? 0.7 : 1 }}
          >
            {confirming ? t('report.confirming') : t('report.confirmCta')}
          </button>
        )}

        {canRemove && (
          confirmRemove ? (
            <div style={{ marginTop: 11, padding: '11px 12px', background: 'var(--bw-tint-danger)', border: '1px solid var(--bw-tint-danger-border)', borderRadius: 11 }}>
              <div style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--bw-on-tint-danger)', lineHeight: 1.4 }}>Remove this report? It will disappear from the map for everyone.</div>
              <div style={{ display: 'flex', gap: 8, marginTop: 9 }}>
                <button
                  onClick={onRemove}
                  disabled={removing}
                  style={{ flex: 1, border: 0, background: 'var(--bw-danger)', color: 'var(--bw-on-accent)', padding: 10, borderRadius: 10, fontSize: 13, fontWeight: 800, cursor: removing ? 'wait' : 'pointer', opacity: removing ? 0.7 : 1 }}
                >
                  {removing ? 'Removing…' : 'Remove'}
                </button>
                <button
                  onClick={() => setConfirmRemove(false)}
                  disabled={removing}
                  style={{ flex: 1, border: '1.5px solid var(--bw-line)', background: 'var(--bw-surface)', color: 'var(--bw-ink-soft)', padding: 10, borderRadius: 10, fontSize: 13, fontWeight: 800, cursor: 'pointer' }}
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <button
              onClick={() => setConfirmRemove(true)}
              style={{ marginTop: 11, width: '100%', border: '1.5px solid var(--bw-tint-danger-border)', background: 'var(--bw-surface)', color: 'var(--bw-on-tint-danger)', padding: 11, borderRadius: 11, fontSize: 13.5, fontWeight: 800, cursor: 'pointer' }}
            >
              Remove my report
            </button>
          )
        )}

        {isAdmin && (
          <div style={{ marginTop: 14, padding: '11px 12px', background: 'var(--bw-surface-sunken)', border: '1px dashed var(--bw-line)', borderRadius: 11 }}>
            <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: '.08em', color: 'var(--bw-faint)', marginBottom: 9 }}>ADMIN OVERRIDE</div>

            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 9 }}>
              <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--bw-ink-soft)' }}>Depth</span>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <button
                  onClick={() => setAdminDepth((d) => Math.max(0, d - 5))}
                  style={{ width: 26, height: 26, border: '1px solid var(--bw-line)', background: 'var(--bw-surface)', borderRadius: 7, fontSize: 15, fontWeight: 800, color: 'var(--bw-ink)', cursor: 'pointer' }}
                >
                  −
                </button>
                <span style={{ fontSize: 13, fontWeight: 800, minWidth: 48, textAlign: 'center' }}>{formatDepth(adminDepth)}</span>
                <button
                  onClick={() => setAdminDepth((d) => Math.min(PROJECT_MAX_CM, d + 5))}
                  style={{ width: 26, height: 26, border: '1px solid var(--bw-line)', background: 'var(--bw-surface)', borderRadius: 7, fontSize: 15, fontWeight: 800, color: 'var(--bw-ink)', cursor: 'pointer' }}
                >
                  +
                </button>
              </div>
            </div>

            <div style={{ display: 'flex', gap: 6, marginBottom: 10 }}>
              {ROAD_ORDER.map((rd) => {
                const meta = ROAD_META[rd];
                const selected = adminRoad === rd;
                return (
                  <button
                    key={rd}
                    onClick={() => setAdminRoad(rd)}
                    style={{
                      flex: 1,
                      border: `1.5px solid ${selected ? meta.color : 'var(--bw-line)'}`,
                      background: selected ? meta.soft : 'var(--bw-surface)',
                      color: selected ? meta.color : 'var(--bw-muted)',
                      borderRadius: 8,
                      padding: '6px 4px',
                      fontSize: 11,
                      fontWeight: 800,
                      cursor: 'pointer',
                    }}
                  >
                    {meta.glyph} {meta.short}
                  </button>
                );
              })}
            </div>

            {overrideError && (
              <div style={{ marginBottom: 9, padding: '8px 10px', background: 'var(--bw-tint-danger)', color: 'var(--bw-on-tint-danger)', borderRadius: 8, fontSize: 11.5, fontWeight: 700 }}>
                {overrideError}
              </div>
            )}

            {report.expired ? (
              <>
                <div style={{ fontSize: 11.5, fontWeight: 600, color: 'var(--bw-ink-soft)', lineHeight: 1.4, marginBottom: 10 }}>
                  Water still there? Reopen it instead of filing a new report.
                </div>
                <div style={{ marginBottom: 11 }}>
                  <SliderRow
                    label="lasts"
                    min={0}
                    max={TTL_STOPS_MIN.length - 1}
                    step={1}
                    value={TTL_STOPS_MIN.indexOf(nearestTtlStop(reopenTtlMin))}
                    onChange={(i) => setReopenTtl(TTL_STOPS_MIN[i])}
                    color="var(--bw-primary)"
                    readout={formatDuration(reopenTtlMin)}
                    aside={
                      reopenTtl === null ? (
                        <span style={{ fontSize: 10.5, color: 'var(--bw-faint)', fontWeight: 700 }}>estimated</span>
                      ) : (
                        <button
                          type="button"
                          onClick={() => setReopenTtl(null)}
                          title="Back to the estimate from this depth"
                          style={{ border: 0, background: 'transparent', color: 'var(--bw-muted)', fontSize: 14, fontWeight: 800, cursor: 'pointer', padding: 0 }}
                        >
                          ⟲
                        </button>
                      )
                    }
                  />
                </div>
                <button
                  onClick={() => void handleReopen()}
                  disabled={savingOverride}
                  style={{ width: '100%', border: 0, background: 'var(--bw-primary)', color: 'var(--bw-on-accent)', padding: 10, borderRadius: 10, fontSize: 12.5, fontWeight: 800, cursor: savingOverride ? 'wait' : 'pointer', opacity: savingOverride ? 0.7 : 1 }}
                >
                  {savingOverride ? 'Reopening…' : `↻ Reopen for ${formatDuration(reopenTtlMin)}`}
                </button>
              </>
            ) : (
              <>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginBottom: 9 }}>
                  <button
                    onClick={() => void handleExtend()}
                    disabled={extending}
                    style={{ border: '1px solid var(--bw-line)', background: 'var(--bw-surface)', color: 'var(--bw-ink)', padding: '7px 11px', borderRadius: 8, fontSize: 11.5, fontWeight: 800, cursor: extending ? 'wait' : 'pointer', opacity: extending ? 0.7 : 1 }}
                  >
                    + Extend 1 hour
                  </button>
                  <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--bw-muted)' }}>
                    Expires in {formatDuration(report.expiresInMin)}
                  </span>
                </div>

                <button
                  onClick={() => void handleSaveOverride()}
                  disabled={savingOverride}
                  style={{ width: '100%', border: 0, background: 'var(--bw-primary)', color: 'var(--bw-on-accent)', padding: 10, borderRadius: 10, fontSize: 12.5, fontWeight: 800, cursor: savingOverride ? 'wait' : 'pointer', opacity: savingOverride ? 0.7 : 1 }}
                >
                  {savingOverride ? 'Saving…' : 'Save depth & road override'}
                </button>
              </>
            )}
          </div>
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
  // maxHeight/overflowY: a tall card (long advice text, many trend/road cells) can otherwise run
  // off the bottom of a short viewport with no way to scroll to its Confirm/Remove buttons.
  // top: 132, so 100vh - 148px leaves a 16px gutter to match the card's own left/top margins.
  return <div style={{ position: 'fixed', left: 16, top: 132, width: 330, maxHeight: 'calc(100vh - 148px)', overflowY: 'auto', zIndex: 1110, animation: 'popIn .14s ease-out' }}>{card}</div>;
};

const Cell: React.FC<{ label: string; children: React.ReactNode }> = ({ label, children }) => (
  <div style={{ background: 'var(--bw-surface-sunken)', borderRadius: 11, padding: '9px 11px' }}>
    <div style={{ fontSize: 10, color: 'var(--bw-faint)', fontWeight: 700, marginBottom: 3 }}>{label}</div>
    {children}
  </div>
);

export default ReportDetailCard;
