import React from 'react';
import { FB_PAGE_URL, FB_GLYPH_PATH } from '../../utils/share';
import { useI18n } from '../../i18n';

interface SupportModalProps {
  /** Path to the bundled GCash donation QR (passed from App as `${BASE_URL}gcash-qr.png`). */
  qrSrc: string;
  isMobile: boolean;
  onClose: () => void;
}

/** A warm welcome / thank-you dialog: explains what FloodedArea is for, asks people to report
 *  only the truth (lives depend on it), and offers an optional GCash donation to keep the app
 *  running. Opened on demand from the TopBar heart. Renders as a bottom sheet on mobile and a
 *  centered card on desktop, matching the app's other adaptive dialogs. */
// NOTE: the `qrSrc` prop is intentionally not destructured while the donation section is hidden
// (see below). Re-add it to the params and restore the QR state when re-enabling that section.
const SupportModal: React.FC<SupportModalProps> = ({ isMobile, onClose }) => {
  const { t } = useI18n();
  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(15,23,42,.55)',
        backdropFilter: 'blur(3px)',
        zIndex: 1300,
        display: 'flex',
        alignItems: isMobile ? 'flex-end' : 'center',
        justifyContent: 'center',
        padding: isMobile ? 0 : 18,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={
          isMobile
            ? { width: '100%', maxHeight: '90vh', overflowY: 'auto', background: 'var(--bw-surface)', borderRadius: '20px 20px 0 0', boxShadow: '0 -10px 40px rgba(15,23,42,.35)', animation: 'sheetUp .22s ease-out' }
            : { width: 430, maxWidth: '100%', maxHeight: '92vh', overflowY: 'auto', background: 'var(--bw-surface)', borderRadius: 20, boxShadow: '0 24px 70px rgba(15,23,42,.4)', animation: 'popIn .16s ease-out' }
        }
      >
        {/* Header */}
        <div style={{ background: 'linear-gradient(150deg,var(--bw-primary),var(--bw-primary-deep))', padding: '20px 22px', color: 'var(--bw-on-accent)', display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ width: 40, height: 40, borderRadius: 12, background: 'rgba(255,255,255,.18)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, flex: 'none' }}>💙</div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 'clamp(16px, 4.5vw, 18px)', fontWeight: 800, lineHeight: 1.25 }}>Salamat — thank you for being here</div>
            <div style={{ fontSize: 12, opacity: 0.9 }}>FloodedArea · Philippines</div>
          </div>
          <button onClick={onClose} aria-label="Close" style={{ border: 0, background: 'rgba(255,255,255,.18)', color: 'var(--bw-on-accent)', width: 28, height: 28, borderRadius: 8, fontSize: 17, cursor: 'pointer', flex: 'none' }}>×</button>
        </div>

        <div style={{ padding: 'clamp(16px, 4vw, 18px) clamp(16px, 5vw, 22px) clamp(18px, 5vw, 22px)' }}>
          {/* What this is for */}
          <p style={{ margin: 0, fontSize: 13.5, lineHeight: 1.6, color: 'var(--bw-ink-soft)' }}>
            FloodedArea is a free, community-powered flood watch. Neighbors report flooding in real
            time, find the nearest evacuation center, follow rainfall alerts, and call for rescue —
            so everyone can make safer decisions, faster. It only works because of people like you.
          </p>

          {/* Truthful info — lives depend on it */}
          <div style={{ marginTop: 16, padding: '13px 14px', background: 'var(--bw-tint-warn)', border: '1px solid var(--bw-tint-warn-border)', borderRadius: 12 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
              <span style={{ fontSize: 15 }}>⚠️</span>
              <span style={{ fontSize: 13, fontWeight: 800, color: 'var(--bw-on-tint-warn)' }}>Please report only the truth</span>
            </div>
            <p style={{ margin: 0, fontSize: 12.5, lineHeight: 1.55, color: 'var(--bw-on-tint-warn)' }}>
              People decide whether to evacuate, which roads to avoid, and where to send rescuers
              based on what you post. Honest, accurate reports save lives — false ones can cost them.
            </p>
          </div>

          {/* Follow us on Facebook — the app's official page, surfaced here so it's discoverable
              without having to open Share first (mirrors the row in ShareModal.tsx). */}
          <a
            href={FB_PAGE_URL}
            target="_blank"
            rel="noopener noreferrer"
            style={{ marginTop: 16, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 9, textDecoration: 'none', border: '1px solid var(--bw-tint-info-border)', background: 'var(--bw-tint-info)', color: '#1877F2', padding: '11px 12px', borderRadius: 12, fontSize: 13.5, fontWeight: 800 }}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="#1877F2" aria-hidden="true"><path d={FB_GLYPH_PATH} /></svg>
            {t('share.followFb')}
          </a>

          {/* Support / donate — HIDDEN FOR NOW. Re-enable this block (and the `qrSrc` prop +
              `qrOpen` state above) to show the "keep the lights on" GCash donation section. */}
          {/*
          <div style={{ marginTop: 18 }}>
            <div style={{ fontSize: 14, fontWeight: 800, color: 'var(--bw-ink)' }}>Help keep the lights on</div>
            <p style={{ margin: '5px 0 0', fontSize: 12.5, lineHeight: 1.55, color: 'var(--bw-muted)' }}>
              FloodedArea is free and ad-free, built and run by one person. If it has helped you and
              you&apos;d like to keep it alive longer, you can chip in <strong>any amount</strong> via
              GCash — every peso goes to the servers that keep it online. No pressure at all. 🙏
            </p>

            <div style={{ marginTop: 14, border: '1px solid var(--bw-line)', borderRadius: 14, overflow: 'hidden', background: 'var(--bw-bg-subtle)' }}>
              <button
                onClick={() => setQrOpen((o) => !o)}
                aria-expanded={qrOpen}
                style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 10, padding: '12px 14px', border: 0, background: 'transparent', cursor: 'pointer', textAlign: 'left' }}
              >
                <span style={{ fontSize: 18, flex: 'none' }}>📱</span>
                <span style={{ flex: 1, minWidth: 0 }}>
                  <span style={{ display: 'block', fontSize: 13, fontWeight: 800, color: 'var(--bw-ink)' }}>
                    {qrOpen ? 'Hide GCash donation QR' : 'Show GCash donation QR'}
                  </span>
                  <span style={{ display: 'block', fontSize: 11, color: 'var(--bw-muted)', marginTop: 1 }}>
                    Scan with GCash or any InstaPay-enabled app
                  </span>
                </span>
                <span style={{ fontSize: 11, color: 'var(--bw-faint)', flex: 'none', transform: qrOpen ? 'rotate(90deg)' : 'none', transition: 'transform .15s' }}>▶</span>
              </button>
              {qrOpen && (
                <div style={{ padding: '2px 14px 16px', textAlign: 'center' }}>
                  <img
                    src={qrSrc}
                    alt="GCash InstaPay donation QR code for AR**N T."
                    style={{ width: 'min(280px, 82vw)', height: 'auto', borderRadius: 12, display: 'block', margin: '0 auto' }}
                  />
                </div>
              )}
            </div>
          </div>
          */}

          <button
            onClick={onClose}
            style={{ width: '100%', marginTop: 18, border: 0, background: 'var(--bw-primary)', color: 'var(--bw-on-accent)', padding: 14, borderRadius: 13, fontSize: 15, fontWeight: 800, cursor: 'pointer', boxShadow: '0 6px 16px rgba(14,165,233,.3)' }}
          >
            Continue to the map
          </button>
          <div style={{ marginTop: 10, textAlign: 'center', fontSize: 11, color: 'var(--bw-faint)' }}>
            Stay safe out there. Maraming salamat! 💙
          </div>
        </div>
      </div>
    </div>
  );
};

export default SupportModal;
