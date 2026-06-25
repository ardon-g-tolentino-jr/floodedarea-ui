import React from 'react';
import type { Hotline } from '../../types';
import { useI18n } from '../../i18n';

interface SosModalProps {
  hotlines: Hotline[];
  sending: boolean;
  onSendRescue: () => void;
  onClose: () => void;
}

const SosModal: React.FC<SosModalProps> = ({ hotlines, sending, onSendRescue, onClose }) => {
  const { t } = useI18n();
  // The Send button stays disabled until the user confirms their LGU/DRRMO has activated the
  // rescue feature — a gate against requests that won't be monitored.
  const [acknowledged, setAcknowledged] = React.useState(false);
  const canSend = acknowledged && !sending;

  return (
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
          <div style={{ fontSize: 18, fontWeight: 800 }}>{t('sos.title')}</div>
          <div style={{ fontSize: 12, opacity: 0.9 }}>{t('topbar.region')}</div>
        </div>
        <button onClick={onClose} style={{ border: 0, background: 'rgba(255,255,255,.18)', color: '#fff', width: 28, height: 28, borderRadius: 8, fontSize: 17, cursor: 'pointer' }}>×</button>
      </div>

      <div style={{ padding: '16px 20px' }}>
        {/* Usage disclaimer — the rescue queue is only monitored once an LGU activates it. */}
        <div style={{ display: 'flex', gap: 9, padding: '11px 13px', background: '#FFF7ED', border: '1px solid #FED7AA', borderRadius: 12, marginBottom: 12 }}>
          <span style={{ fontSize: 15, flex: 'none', lineHeight: 1.3 }}>⚠️</span>
          <p style={{ margin: 0, fontSize: 12, lineHeight: 1.5, color: '#7C2D12' }}>
            <strong style={{ color: '#9A3412' }}>{t('sos.disclaimerBold')}</strong> {t('sos.disclaimer')}
          </p>
        </div>

        {/* Acknowledgment gate — the Send button is disabled until this is checked. */}
        <label style={{ display: 'flex', gap: 9, alignItems: 'flex-start', padding: '10px 12px', border: `1px solid ${acknowledged ? '#FCA5A5' : 'var(--bw-line)'}`, background: acknowledged ? '#FEF2F2' : '#fff', borderRadius: 12, marginBottom: 14, cursor: 'pointer' }}>
          <input
            type="checkbox"
            checked={acknowledged}
            onChange={(e) => setAcknowledged(e.target.checked)}
            style={{ marginTop: 1, width: 16, height: 16, accentColor: 'var(--bw-danger)', cursor: 'pointer', flex: 'none' }}
          />
          <span style={{ fontSize: 12, lineHeight: 1.45, color: 'var(--bw-ink-soft)', fontWeight: 600 }}>{t('sos.ack')}</span>
        </label>

        <button
          onClick={onSendRescue}
          disabled={!canSend}
          style={{ width: '100%', border: 0, background: 'var(--bw-danger)', color: '#fff', padding: 14, borderRadius: 13, fontSize: 15, fontWeight: 800, cursor: !canSend ? 'not-allowed' : 'pointer', marginBottom: 14, boxShadow: canSend ? '0 6px 16px rgba(239,68,68,.3)' : 'none', opacity: canSend ? 1 : 0.5 }}
        >
          {sending ? t('sos.sending') : t('sos.send')}
        </button>

        <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: '.12em', color: 'var(--bw-faint)', marginBottom: 9 }}>{t('sos.callHotline')}</div>
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
          {t('sos.danger911')}
        </div>
      </div>
    </div>
  </div>
  );
};

export default SosModal;
