import React from 'react';
import type { Hotline } from '../../types';

interface SosModalProps {
  hotlines: Hotline[];
  sending: boolean;
  onSendRescue: () => void;
  onClose: () => void;
}

const SosModal: React.FC<SosModalProps> = ({ hotlines, sending, onSendRescue, onClose }) => (
  <div
    onClick={onClose}
    style={{
      position: 'fixed',
      inset: 0,
      background: 'rgba(15,23,42,.55)',
      backdropFilter: 'blur(3px)',
      zIndex: 1200,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: 18,
    }}
  >
    <div
      onClick={(e) => e.stopPropagation()}
      style={{ width: 420, maxWidth: '100%', maxHeight: '90vh', overflowY: 'auto', background: '#fff', borderRadius: 20, boxShadow: '0 24px 70px rgba(15,23,42,.4)', animation: 'popIn .16s ease-out' }}
    >
      <div style={{ background: 'linear-gradient(135deg,#EF4444,#DC2626)', padding: '18px 20px', color: '#fff', display: 'flex', alignItems: 'center', gap: 12 }}>
        <div style={{ width: 40, height: 40, borderRadius: 12, background: 'rgba(255,255,255,.18)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, fontWeight: 800, flex: 'none' }}>!</div>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 18, fontWeight: 800 }}>Emergency help</div>
          <div style={{ fontSize: 12, opacity: 0.9 }}>Philippines</div>
        </div>
        <button onClick={onClose} style={{ border: 0, background: 'rgba(255,255,255,.18)', color: '#fff', width: 28, height: 28, borderRadius: 8, fontSize: 17, cursor: 'pointer' }}>×</button>
      </div>

      <div style={{ padding: '16px 20px' }}>
        <button
          onClick={onSendRescue}
          disabled={sending}
          style={{ width: '100%', border: 0, background: 'var(--bw-danger)', color: '#fff', padding: 14, borderRadius: 13, fontSize: 15, fontWeight: 800, cursor: sending ? 'wait' : 'pointer', marginBottom: 14, boxShadow: '0 6px 16px rgba(239,68,68,.3)', opacity: sending ? 0.7 : 1 }}
        >
          {sending ? 'Sending your location…' : 'Send rescue request with my location'}
        </button>

        <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: '.12em', color: 'var(--bw-faint)', marginBottom: 9 }}>CALL A HOTLINE</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {hotlines.map((h) => (
            <a
              key={h.id}
              href={`tel:${h.phoneNumber.replace(/[^0-9+]/g, '')}`}
              style={{ display: 'flex', alignItems: 'center', padding: '11px 13px', background: '#F7FAFB', borderRadius: 12, textDecoration: 'none', color: 'inherit' }}
            >
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 13.5, fontWeight: 800 }}>{h.name}</div>
                {h.description && <div style={{ fontSize: 11.5, color: 'var(--bw-muted)' }}>{h.description}</div>}
              </div>
              <div style={{ fontSize: 15, fontWeight: 800, color: 'var(--bw-ink)' }}>{h.phoneNumber}</div>
            </a>
          ))}
        </div>
        <div style={{ fontSize: 11, color: '#9AA8B4', marginTop: 13, textAlign: 'center', lineHeight: 1.4 }}>
          If you are in immediate danger, move to the highest safe floor and call 911.
        </div>
      </div>
    </div>
  </div>
);

export default SosModal;
