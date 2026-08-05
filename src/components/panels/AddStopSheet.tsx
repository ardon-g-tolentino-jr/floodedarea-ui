import React from 'react';
import type { LatLng } from '../../types';
import { STOP_RADIUS_OPTIONS } from '../../utils/tripWatch';
import { useI18n } from '../../i18n';
import PlaceField from './PlaceField';
import MapPickField from './MapPickField';

const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '9px 11px',
  border: '1px solid var(--bw-line)',
  borderRadius: 9,
  fontSize: 13,
  color: 'var(--bw-ink)',
  background: '#fff',
  boxSizing: 'border-box',
};

const labelStyle: React.CSSProperties = { fontSize: 11, fontWeight: 700, color: 'var(--bw-muted)', marginBottom: 4, display: 'block' };

const fmtRadius = (km: number): string =>
  km < 1 ? `${Math.round(km * 1000)} m` : `${Number.isInteger(km) ? km : km.toFixed(1)} km`;

export interface AddStopSheetProps {
  isMobile: boolean;
  near: LatLng;
  defaultRadiusKm: number;
  busy: boolean;
  onAdd: (pick: { lat: number; lng: number; label: string; radiusKm: number }) => void;
  onClose: () => void;
}

/** Shortens a Nominatim `display_name` ("Ortigas Avenue, San Juan, Metro Manila, 1500,
 *  Philippines") to its first two segments for a readable default stop label. */
const shortLabel = (label: string): string => label.split(',').slice(0, 2).join(',').trim();

const AddStopSheet: React.FC<AddStopSheetProps> = ({ isMobile, near, defaultRadiusKm, busy, onAdd, onClose }) => {
  const { t } = useI18n();
  // The mini-map is shown from the start, centered on the user, so a stop can be tapped directly
  // without searching first — `picked` distinguishes "map centered on you" from "you chose a spot".
  const [lat, setLat] = React.useState(near.lat);
  const [lng, setLng] = React.useState(near.lng);
  const [picked, setPicked] = React.useState(false);
  const [placeLabel, setPlaceLabel] = React.useState('');
  const [label, setLabel] = React.useState('');
  const [radiusKm, setRadiusKm] = React.useState(defaultRadiusKm);

  const pick = (pLat: number, pLng: number, pLabel?: string): void => {
    setLat(pLat);
    setLng(pLng);
    setPicked(true);
    if (pLabel) {
      setPlaceLabel(pLabel);
      setLabel((prev) => (prev.trim() ? prev : shortLabel(pLabel)));
    }
  };

  const canSave = picked && label.trim().length > 0;

  const save = (): void => {
    if (!canSave) return;
    onAdd({ lat, lng, label: label.trim(), radiusKm });
  };

  return (
    <div
      onClick={onClose}
      style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,.55)', backdropFilter: 'blur(3px)', zIndex: 1200, display: 'flex', alignItems: isMobile ? 'flex-end' : 'center', justifyContent: 'center', padding: isMobile ? 0 : 18 }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: isMobile ? '100%' : 420, maxWidth: '100%', maxHeight: '90vh', overflowY: 'auto', background: '#fff',
          borderRadius: isMobile ? '18px 18px 0 0' : 18, boxShadow: '0 24px 70px rgba(15,23,42,.4)',
          animation: isMobile ? 'sheetUp .22s ease-out' : 'popIn .16s ease-out',
        }}
      >
        <div style={{ padding: '20px 22px 0', display: 'flex', alignItems: 'center', gap: 11 }}>
          <div style={{ width: 36, height: 36, borderRadius: 11, background: 'linear-gradient(150deg,#7C3AED,#5B21B6)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, flex: 'none' }}>📍</div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 16.5, fontWeight: 800 }}>{t('trip.addTitle')}</div>
            <div style={{ fontSize: 11.5, color: 'var(--bw-muted)', fontWeight: 600 }}>{t('trip.addSubtitle')}</div>
          </div>
          <button onClick={onClose} style={{ border: 0, background: 'var(--bw-bg-subtle)', color: '#7C8B98', width: 28, height: 28, borderRadius: 8, fontSize: 16, cursor: 'pointer' }}>×</button>
        </div>

        <div style={{ padding: 22 }}>
          <div style={{ marginBottom: 14 }}>
            <PlaceField
              lat={picked ? String(lat) : ''}
              lng={picked ? String(lng) : ''}
              placeLabel={placeLabel}
              onPick={pick}
              placeholder={t('trip.searchPlaceholder')}
              currentLabel={t('trip.useCurrent')}
            />
          </div>

          <div style={{ marginBottom: 14 }}>
            <MapPickField lat={lat} lng={lng} onPick={pick} />
            <div style={{ fontSize: 11, color: 'var(--bw-muted)', marginTop: 6 }}>{t('trip.adjustHint')}</div>
          </div>

          {picked && (
            <>
              <div style={{ marginBottom: 14 }}>
                <span style={labelStyle}>{t('trip.stopLabel')}</span>
                <input value={label} onChange={(e) => setLabel(e.target.value)} style={inputStyle} maxLength={80} />
              </div>

              <div style={{ marginBottom: 4 }}>
                <span style={labelStyle}>{t('trip.alertRadius')}</span>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  {STOP_RADIUS_OPTIONS.map((km) => (
                    <button
                      key={km}
                      onClick={() => setRadiusKm(km)}
                      style={{ padding: '7px 13px', borderRadius: 999, border: `1.5px solid ${radiusKm === km ? '#7C3AED' : '#E2E8F0'}`, background: radiusKm === km ? 'rgba(124,58,237,.08)' : '#fff', color: radiusKm === km ? 'var(--bw-ink)' : '#9AA8B4', fontSize: 12.5, fontWeight: 700, cursor: 'pointer' }}
                    >
                      {fmtRadius(km)}
                    </button>
                  ))}
                </div>
              </div>
            </>
          )}

          <button
            onClick={save}
            disabled={!canSave || busy}
            style={{ width: '100%', marginTop: 18, padding: '12px 14px', borderRadius: 12, border: 0, background: canSave && !busy ? '#7C3AED' : '#CBD5E1', color: '#fff', fontSize: 13.5, fontWeight: 800, cursor: canSave && !busy ? 'pointer' : 'default' }}
          >
            {t('trip.saveStop')}
          </button>
        </div>
      </div>
    </div>
  );
};

export default AddStopSheet;
