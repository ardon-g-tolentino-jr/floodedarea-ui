import React from 'react';
import type { Severity, Trip, TripStop } from '../../types';
import type { StopMatch } from '../../utils/tripWatch';
import { MAX_STOPS, STOP_RADIUS_OPTIONS } from '../../utils/tripWatch';
import { SEV_META, SEV_RANK } from '../../utils/floodMeta';
import { useI18n, tFormat } from '../../i18n';

const fmtRadius = (km: number): string =>
  km < 1 ? `${Math.round(km * 1000)} m` : `${Number.isInteger(km) ? km : km.toFixed(1)} km`;

const worstSeverity = (matches: StopMatch[]): Severity | null => {
  if (!matches.length) return null;
  return matches.reduce<Severity>((worst, m) => (SEV_RANK[m.report.severity] > SEV_RANK[worst] ? m.report.severity : worst), matches[0].report.severity);
};

export interface TripPanelProps {
  trip: Trip;
  matches: Map<string, StopMatch[]>;
  notifyPermission: NotificationPermission | 'unsupported';
  onAddStop: () => void;
  onRemoveStop: (id: string) => void;
  onMoveStop: (id: string, dir: -1 | 1) => void;
  onChangeRadius: (id: string, km: number) => void;
  onFocusStop: (stop: TripStop) => void;
  onViewReport: (reportId: number) => void;
  onStartTrip: () => void;
  onEndTrip: () => void;
}

const TripPanel: React.FC<TripPanelProps> = ({
  trip, matches, notifyPermission, onAddStop, onRemoveStop, onMoveStop, onChangeRadius, onFocusStop, onViewReport, onStartTrip, onEndTrip,
}) => {
  const { lang, t } = useI18n();
  const [expandedId, setExpandedId] = React.useState<string | null>(null);

  // Body only — the sidebar's control strip owns the header, the open/closed state and the
  // alert badge (see Sidebar's `trip` chip).
  return (
    <>
      <div style={{ display: 'flex', alignItems: 'center', gap: 9, marginBottom: 10 }}>
        <div style={{ fontSize: 11.5, color: 'var(--bw-muted)', lineHeight: 1.45, flex: 1 }}>
          {trip.active ? t('trip.desc') : t('trip.empty')}
        </div>
        <button
          onClick={trip.active ? onEndTrip : onStartTrip}
          disabled={!trip.active && trip.stops.length === 0}
          style={{
            flex: 'none', padding: '8px 13px', borderRadius: 10, border: 0, cursor: trip.stops.length === 0 && !trip.active ? 'default' : 'pointer',
            fontSize: 12.5, fontWeight: 800, color: '#fff',
            background: trip.active ? '#EF4444' : trip.stops.length === 0 ? '#CBD5E1' : 'var(--bw-primary)',
          }}
        >
          {trip.active ? t('trip.end') : t('trip.start')}
        </button>
      </div>

      {trip.active && notifyPermission === 'denied' && (
        <div style={{ marginBottom: 10, padding: '8px 11px', background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: 9, fontSize: 11.5, color: '#B91C1C', lineHeight: 1.4 }}>
          {t('notify.permDenied')}
        </div>
      )}
      {trip.active && (
        <div style={{ marginBottom: 10, padding: '8px 11px', background: 'var(--bw-bg-subtle)', borderRadius: 9, fontSize: 11, color: 'var(--bw-muted)', lineHeight: 1.4 }}>
          {t('trip.independentNote')} {t('trip.keepOpen')}
        </div>
      )}

      {trip.stops.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 10 }}>
          {trip.stops.map((s, i) => {
            const stopMatches = matches.get(s.id) ?? [];
            const worst = worstSeverity(stopMatches);
            const badgeColor = worst ? SEV_META[worst].color : '#16A34A';
            const isExpanded = expandedId === s.id;
            const suffix = i === 0 ? t('trip.stopStart') : i === trip.stops.length - 1 ? t('trip.stopDestination') : null;
            return (
              <div key={s.id} style={{ border: '1px solid var(--bw-line-soft)', borderRadius: 12, overflow: 'hidden' }}>
                <div
                  onClick={() => { setExpandedId(isExpanded ? null : s.id); onFocusStop(s); }}
                  style={{ display: 'flex', alignItems: 'center', gap: 9, padding: '10px 11px', cursor: 'pointer' }}
                >
                  <span style={{ flex: 'none', width: 20, height: 20, borderRadius: 6, background: 'var(--bw-primary)', color: '#fff', fontSize: 11, fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    {i + 1}
                  </span>
                  <span style={{ flex: 1, minWidth: 0, fontSize: 13, fontWeight: 700, color: 'var(--bw-ink)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {s.label}{suffix ? <span style={{ color: 'var(--bw-muted)', fontWeight: 600 }}> ({suffix})</span> : null}
                  </span>
                  {stopMatches.length > 0 ? (
                    <span
                      onClick={(e) => { e.stopPropagation(); onViewReport(stopMatches[0].report.id); }}
                      style={{ flex: 'none', fontSize: 11.5, fontWeight: 800, color: badgeColor, cursor: 'pointer' }}
                    >
                      ⚠ {stopMatches.length === 1 ? t('trip.reportsOne') : tFormat(lang, 'trip.reportsMany', { n: stopMatches.length })}
                    </span>
                  ) : (
                    <span style={{ flex: 'none', fontSize: 11.5, fontWeight: 800, color: '#16A34A' }}>✓ {t('trip.clear')}</span>
                  )}
                </div>
                {isExpanded && (
                  <div style={{ padding: '0 11px 11px', borderTop: '1px solid var(--bw-line-soft)' }}>
                    <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', margin: '9px 0 6px' }}>
                      <span style={{ fontSize: 10, fontWeight: 800, letterSpacing: '.08em', color: 'var(--bw-faint)' }}>{t('trip.alertRadius')}</span>
                      <span style={{ fontSize: 12, fontWeight: 800, color: 'var(--bw-primary-deep)' }}>{fmtRadius(s.radiusKm)}</span>
                    </div>
                    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 10 }}>
                      {STOP_RADIUS_OPTIONS.map((km) => (
                        <button
                          key={km}
                          onClick={() => onChangeRadius(s.id, km)}
                          style={{ padding: '5px 10px', borderRadius: 999, border: `1.5px solid ${s.radiusKm === km ? 'var(--bw-primary)' : '#E2E8F0'}`, background: s.radiusKm === km ? 'var(--bw-bg-subtle)' : '#fff', color: s.radiusKm === km ? 'var(--bw-ink)' : '#9AA8B4', fontSize: 11.5, fontWeight: 700, cursor: 'pointer' }}
                        >
                          {fmtRadius(km)}
                        </button>
                      ))}
                    </div>
                    {s.roadName && (
                      <div style={{ fontSize: 11, color: 'var(--bw-muted)', marginBottom: 9 }}>
                        {tFormat(lang, 'trip.onRoad', { road: s.roadName })}
                      </div>
                    )}
                    <div style={{ display: 'flex', gap: 8 }}>
                      <button
                        onClick={() => onMoveStop(s.id, -1)}
                        disabled={i === 0}
                        aria-label={t('trip.moveUp')}
                        style={{ flex: 'none', width: 30, height: 30, borderRadius: 8, border: '1px solid var(--bw-line)', background: '#fff', color: i === 0 ? '#CBD5E1' : 'var(--bw-ink-soft)', cursor: i === 0 ? 'default' : 'pointer' }}
                      >▲</button>
                      <button
                        onClick={() => onMoveStop(s.id, 1)}
                        disabled={i === trip.stops.length - 1}
                        aria-label={t('trip.moveDown')}
                        style={{ flex: 'none', width: 30, height: 30, borderRadius: 8, border: '1px solid var(--bw-line)', background: '#fff', color: i === trip.stops.length - 1 ? '#CBD5E1' : 'var(--bw-ink-soft)', cursor: i === trip.stops.length - 1 ? 'default' : 'pointer' }}
                      >▼</button>
                      <button
                        onClick={() => onRemoveStop(s.id)}
                        style={{ flex: 1, borderRadius: 8, border: '1px solid #FECACA', background: '#FEF2F2', color: '#B91C1C', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}
                      >{t('trip.remove')}</button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      <button
        onClick={onAddStop}
        disabled={trip.stops.length >= MAX_STOPS}
        style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7, padding: '9px 12px', borderRadius: 11, border: '1px solid var(--bw-line)', background: trip.stops.length >= MAX_STOPS ? 'var(--bw-bg-subtle)' : '#fff', color: trip.stops.length >= MAX_STOPS ? 'var(--bw-muted)' : 'var(--bw-primary-deep)', fontSize: 12.5, fontWeight: 800, cursor: trip.stops.length >= MAX_STOPS ? 'default' : 'pointer' }}
      >
        {trip.stops.length >= MAX_STOPS ? tFormat(lang, 'trip.maxReached', { n: MAX_STOPS }) : t('trip.addStop')}
      </button>
    </>
  );
};

export default TripPanel;
