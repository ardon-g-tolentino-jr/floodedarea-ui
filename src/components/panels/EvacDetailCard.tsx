import React from 'react';
import type { EvacuationCenter, LatLng } from '../../types';
import { kmBetween, walkMinutes } from '../../utils/geo';
import ShelterIcon from './ShelterIcon';

interface EvacDetailCardProps {
  center: EvacuationCenter;
  userLoc: LatLng;
  isMobile: boolean;
  onClose: () => void;
}

const EvacDetailCard: React.FC<EvacDetailCardProps> = ({ center, userLoc, isMobile, onClose }) => {
  const distKm = kmBetween(userLoc, { lat: center.latitude, lng: center.longitude });

  const card = (
    <div style={{ background: '#fff', borderRadius: 16, boxShadow: '0 14px 40px rgba(15,23,42,.3)', overflow: 'hidden', border: '1px solid var(--bw-line)' }}>
      <div style={{ padding: '14px 15px 12px', borderBottom: '1px solid var(--bw-line-soft)' }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
          <div style={{ width: 30, height: 30, borderRadius: 9, background: 'var(--bw-shelter)', display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 'none' }}>
            <ShelterIcon size={16} />
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 15, fontWeight: 800, lineHeight: 1.15 }}>{center.name}</div>
            <div style={{ fontSize: 11.5, color: 'var(--bw-muted)', fontWeight: 600 }}>
              Evacuation center · {distKm.toFixed(1)} km away · ~{walkMinutes(distKm)} min walk
            </div>
          </div>
          <button onClick={onClose} style={{ border: 0, background: 'var(--bw-bg-subtle)', color: '#7C8B98', width: 26, height: 26, borderRadius: 7, fontSize: 15, cursor: 'pointer', flex: 'none' }}>×</button>
        </div>
      </div>

      <div style={{ padding: '13px 15px' }}>
        <a href={`tel:${center.contact.replace(/[^0-9+]/g, '')}`} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', textDecoration: 'none', background: 'var(--bw-shelter)', color: '#fff', padding: 12, borderRadius: 11, fontSize: 13.5, fontWeight: 800 }}>
          Call
        </a>
        <div style={{ marginTop: 9, fontSize: 11.5, color: 'var(--bw-muted)' }}>
          Hotline: <b style={{ color: 'var(--bw-ink)' }}>{center.contact}</b>
        </div>
      </div>
    </div>
  );

  if (isMobile) {
    return (
      <>
        <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,.4)', zIndex: 1100 }} />
        <div style={{ position: 'fixed', left: 0, right: 0, bottom: 0, zIndex: 1110, maxHeight: '86vh', overflowY: 'auto', animation: 'sheetUp .22s ease-out' }}>{card}</div>
      </>
    );
  }
  return <div style={{ position: 'fixed', left: 16, top: 132, width: 320, zIndex: 1110, animation: 'popIn .14s ease-out' }}>{card}</div>;
};

export default EvacDetailCard;
