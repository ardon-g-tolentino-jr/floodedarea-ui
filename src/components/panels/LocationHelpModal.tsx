import React from 'react';
import { useI18n } from '../../i18n';
import { detectHelpBucket, locationHelpSteps } from '../../utils/locationHelp';

interface LocationHelpModalProps {
  /** Re-run the locate flow after the user grants permission. */
  onRetry: () => void;
  onClose: () => void;
}

/**
 * Step-by-step help for re-enabling a blocked Geolocation permission, tailored to the user's
 * browser/OS (see utils/locationHelp). Opened from the "location denied" toast's action.
 * Presentational — App owns the open/close state and supplies onRetry (which re-runs locateMe).
 */
const LocationHelpModal: React.FC<LocationHelpModalProps> = ({ onRetry, onClose }) => {
  const { t } = useI18n();
  // Detect once on mount — the browser can't change mid-session.
  const steps = React.useMemo(() => locationHelpSteps(detectHelpBucket()), []);

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
        <div style={{ background: 'linear-gradient(135deg,#0EA5E9,#0284C7)', padding: '18px 20px', color: '#fff', display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ width: 40, height: 40, borderRadius: 12, background: 'rgba(255,255,255,.18)', display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 'none' }}>
            {/* Material "location_on" pin */}
            <svg viewBox="0 0 24 24" width="22" height="22" fill="currentColor" aria-hidden="true">
              <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5a2.5 2.5 0 110-5 2.5 2.5 0 010 5z" />
            </svg>
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 18, fontWeight: 800 }}>{t('locHelp.title')}</div>
            <div style={{ fontSize: 12, opacity: 0.9 }}>{t('topbar.region')}</div>
          </div>
          <button onClick={onClose} aria-label={t('common.close')} style={{ border: 0, background: 'rgba(255,255,255,.18)', color: '#fff', width: 28, height: 28, borderRadius: 8, fontSize: 17, cursor: 'pointer' }}>×</button>
        </div>

        <div style={{ padding: '16px 20px' }}>
          <p style={{ margin: '0 0 14px', fontSize: 13, lineHeight: 1.5, color: 'var(--bw-ink-soft)' }}>{t('locHelp.intro')}</p>

          <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: '.12em', color: 'var(--bw-faint)', marginBottom: 10 }}>{t('locHelp.stepsFor')}</div>
          <ol style={{ margin: '0 0 16px', padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 10 }}>
            {steps.map((key, i) => (
              <li key={key} style={{ display: 'flex', gap: 11, alignItems: 'flex-start' }}>
                <span style={{ flex: 'none', width: 22, height: 22, borderRadius: '50%', background: '#E0F2FE', color: '#0284C7', fontSize: 12, fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{i + 1}</span>
                <span style={{ fontSize: 13, lineHeight: 1.45, color: 'var(--bw-ink)', paddingTop: 1 }}>{t(key)}</span>
              </li>
            ))}
          </ol>

          <button
            onClick={onRetry}
            style={{ width: '100%', border: 0, background: 'var(--bw-primary)', color: '#fff', padding: 14, borderRadius: 13, fontSize: 15, fontWeight: 800, cursor: 'pointer', marginBottom: 12, boxShadow: '0 6px 16px rgba(14,165,233,.3)' }}
          >
            {t('locHelp.tryAgain')}
          </button>

          <p style={{ margin: 0, fontSize: 11, color: '#9AA8B4', textAlign: 'center', lineHeight: 1.4 }}>{t('locHelp.privacy')}</p>
        </div>
      </div>
    </div>
  );
};

export default LocationHelpModal;
