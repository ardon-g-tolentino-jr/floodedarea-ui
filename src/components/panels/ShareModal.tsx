import React from 'react';
import type { ShareLink } from '../../utils/share';
import { FB_GLYPH_PATH } from '../../utils/share';
import { useI18n, tFormat } from '../../i18n';

interface ShareModalProps {
  /** Full message including the URL — for clipboard / native share. */
  text: string;
  /** The page URL on its own — for the "Copy link" action. */
  url: string;
  /** Pre-built per-network share targets (see buildShareLinks). */
  links: ShareLink[];
  /** The app's official Facebook page — shown as a "Follow us" link. */
  fbPageUrl: string;
  /** Live (non-expired) report count, for the impact line. */
  activeCount: number;
  isMobile: boolean;
  /** Whether the device exposes the native share sheet (navigator.share). */
  canNativeShare: boolean;
  onNativeShare: () => void;
  /** Writes `textToCopy` to the clipboard and toasts `successMsg` — kept in App per convention. */
  onCopy: (textToCopy: string, successMsg: string) => void;
  onClose: () => void;
}

/** White brand glyphs (24×24 fill paths) keyed to ShareLink.key. */
const NET_GLYPH: Record<ShareLink['key'], string> = {
  facebook: FB_GLYPH_PATH,
  x:
    'M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z',
  whatsapp:
    'M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 0 1-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 0 1-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 0 1 2.893 6.994c-.003 5.45-4.437 9.885-9.885 9.885M20.52 3.449C18.24 1.245 15.24 0 12.045 0 5.463 0 .104 5.358.101 11.892c0 2.096.549 4.142 1.595 5.945L0 24l6.305-1.654a11.882 11.882 0 0 0 5.683 1.448h.005c6.582 0 11.94-5.358 11.944-11.892a11.821 11.821 0 0 0-3.495-8.411',
  telegram:
    'M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z',
  email:
    'M22 6c0-1.1-.9-2-2-2H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6zm-2 0-8 5-8-5h16zm0 12H4V8l8 5 8-5v10z',
};

const LINK_GLYPH =
  'M3.9 12c0-1.71 1.39-3.1 3.1-3.1h4V7H7c-2.76 0-5 2.24-5 5s2.24 5 5 5h4v-1.9H7c-1.71 0-3.1-1.39-3.1-3.1zM8 13h8v-2H8v2zm9-6h-4v1.9h4c1.71 0 3.1 1.39 3.1 3.1s-1.39 3.1-3.1 3.1h-4V17h4c2.76 0 5-2.24 5-5s-2.24-5-5-5z';
const SHARE_GLYPH =
  'M18 16.08c-.76 0-1.44.3-1.96.77L8.91 12.7c.05-.23.09-.46.09-.7s-.04-.47-.09-.7l7.05-4.11c.54.5 1.25.81 2.04.81 1.66 0 3-1.34 3-3s-1.34-3-3-3-3 1.34-3 3c0 .24.04.47.09.7L8.04 9.81C7.5 9.31 6.79 9 6 9c-1.66 0-3 1.34-3 3s1.34 3 3 3c.79 0 1.5-.31 2.04-.81l7.12 4.16c-.05.21-.08.43-.08.65 0 1.61 1.31 2.92 2.92 2.92s2.92-1.31 2.92-2.92-1.31-2.92-2.92-2.92z';

const Glyph: React.FC<{ d: string; size?: number; color?: string }> = ({ d, size = 26, color = '#fff' }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill={color} aria-hidden="true">
    <path d={d} />
  </svg>
);

/** "Spread the word" dialog. Frames sharing as a community-safety act, then offers one-tap
 *  social buttons, a native share sheet (mobile), and copy actions. Opened from the TopBar
 *  Share button. Bottom sheet on mobile, centered card on desktop — matching the app's other
 *  adaptive dialogs. */
const ShareModal: React.FC<ShareModalProps> = ({
  text,
  url,
  links,
  fbPageUrl,
  activeCount,
  isMobile,
  canNativeShare,
  onNativeShare,
  onCopy,
  onClose,
}) => {
  const { lang, t } = useI18n();
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
            ? { width: '100%', maxHeight: '90vh', overflowY: 'auto', background: '#fff', borderRadius: '20px 20px 0 0', boxShadow: '0 -10px 40px rgba(15,23,42,.35)', animation: 'sheetUp .22s ease-out' }
            : { width: 430, maxWidth: '100%', maxHeight: '92vh', overflowY: 'auto', background: '#fff', borderRadius: 20, boxShadow: '0 24px 70px rgba(15,23,42,.4)', animation: 'popIn .16s ease-out' }
        }
      >
        {/* Header */}
        <div style={{ background: 'linear-gradient(150deg,#0EA5E9,#0369A1)', padding: '20px 22px', color: '#fff', display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ width: 40, height: 40, borderRadius: 12, background: 'rgba(255,255,255,.18)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, flex: 'none' }}>📣</div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 'clamp(16px, 4.5vw, 18px)', fontWeight: 800, lineHeight: 1.25 }}>{t('share.title')}</div>
            <div style={{ fontSize: 12, opacity: 0.9 }}>{t('share.subtitle')}</div>
          </div>
          <button onClick={onClose} aria-label="Close" style={{ border: 0, background: 'rgba(255,255,255,.18)', color: '#fff', width: 28, height: 28, borderRadius: 8, fontSize: 17, cursor: 'pointer', flex: 'none' }}>×</button>
        </div>

        <div style={{ padding: 'clamp(16px, 4vw, 18px) clamp(16px, 5vw, 22px) clamp(18px, 5vw, 22px)' }}>
          {/* Why sharing matters */}
          <p style={{ margin: 0, fontSize: 13.5, lineHeight: 1.6, color: 'var(--bw-ink-soft)' }}>
            {t('share.intro')}
          </p>

          <div style={{ marginTop: 14, padding: '13px 14px', background: '#ECFDF5', border: '1px solid #A7F3D0', borderRadius: 12 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
              <span style={{ fontSize: 15 }}>🌊</span>
              <span style={{ fontSize: 13, fontWeight: 800, color: '#065F46' }}>{t('share.clearerMap')}</span>
            </div>
            <p style={{ margin: 0, fontSize: 12.5, lineHeight: 1.55, color: '#047857' }}>
              {activeCount > 0
                ? tFormat(lang, activeCount === 1 ? 'share.liveReportsOne' : 'share.liveReportsMany', { n: activeCount })
                : ''}
              {t('share.impact')}
            </p>
          </div>

          {/* Native share sheet — mobile's quickest path to Messenger / Viber / anything installed */}
          {canNativeShare && (
            <button
              onClick={onNativeShare}
              style={{ width: '100%', marginTop: 18, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 9, border: 0, background: 'var(--bw-primary)', color: '#fff', padding: 14, borderRadius: 13, fontSize: 15, fontWeight: 800, cursor: 'pointer', boxShadow: '0 6px 16px rgba(14,165,233,.3)' }}
            >
              <Glyph d={SHARE_GLYPH} size={19} /> {t('share.viaApps')}
            </button>
          )}

          {/* One-tap social targets */}
          <div style={{ marginTop: 18, fontSize: 11.5, fontWeight: 800, letterSpacing: '.04em', textTransform: 'uppercase', color: 'var(--bw-faint)' }}>
            {canNativeShare ? t('share.orDirectly') : t('share.directly')}
          </div>
          <div style={{ marginTop: 12, display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(64px, 1fr))', gap: 10 }}>
            {links.map((l) => (
              <a
                key={l.key}
                href={l.href}
                target="_blank"
                rel="noopener noreferrer"
                title={`${t('share.shareOn')} ${l.label}`}
                style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 7, textDecoration: 'none' }}
              >
                <span style={{ width: 52, height: 52, borderRadius: 16, background: l.color, display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 4px 12px rgba(15,23,42,.18)' }}>
                  <Glyph d={NET_GLYPH[l.key]} size={26} />
                </span>
                <span style={{ fontSize: 11.5, fontWeight: 700, color: 'var(--bw-ink-soft)' }}>{l.label}</span>
              </a>
            ))}
          </div>

          {/* Follow the app's official Facebook page */}
          <a
            href={fbPageUrl}
            target="_blank"
            rel="noopener noreferrer"
            style={{ marginTop: 16, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 9, textDecoration: 'none', border: '1px solid #C9DCFB', background: '#F0F5FF', color: '#1877F2', padding: '11px 12px', borderRadius: 12, fontSize: 13.5, fontWeight: 800 }}
          >
            <Glyph d={NET_GLYPH.facebook} size={18} color="#1877F2" />
            {t('share.followFb')}
          </a>

          {/* Copy actions */}
          <div style={{ marginTop: 12, display: 'flex', gap: 10 }}>
            <button
              onClick={() => onCopy(url, t('share.linkCopied'))}
              style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, border: '1px solid var(--bw-line)', background: '#fff', color: 'var(--bw-ink)', padding: '12px 10px', borderRadius: 12, fontSize: 13.5, fontWeight: 800, cursor: 'pointer' }}
            >
              <svg width="17" height="17" viewBox="0 0 24 24" fill="var(--bw-muted)" aria-hidden="true"><path d={LINK_GLYPH} /></svg>
              {t('share.copyLink')}
            </button>
            <button
              onClick={() => onCopy(text, t('share.messageCopied'))}
              style={{ flex: 1, border: '1px solid var(--bw-line)', background: '#fff', color: 'var(--bw-ink)', padding: '12px 10px', borderRadius: 12, fontSize: 13.5, fontWeight: 800, cursor: 'pointer' }}
            >
              {t('share.copyMessage')}
            </button>
          </div>

          {/* Preview of what gets shared */}
          <div style={{ marginTop: 14, padding: '11px 13px', background: 'var(--bw-bg-subtle)', border: '1px solid var(--bw-line)', borderRadius: 12, fontSize: 12, lineHeight: 1.5, color: 'var(--bw-muted)', whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
            {text}
          </div>

          <div style={{ marginTop: 14, textAlign: 'center', fontSize: 11, color: 'var(--bw-faint)' }}>
            {t('share.thanks')}
          </div>
        </div>
      </div>
    </div>
  );
};

export default ShareModal;
