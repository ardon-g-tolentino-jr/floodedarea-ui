import React from 'react';
import { GoogleLogin } from '@react-oauth/google';
import { ApiError } from '../api/client';
import { useI18n, tFormat, type Lang, type MsgKey } from '../i18n';
import { canOpenInSystemBrowser, detectInAppBrowser, inAppLabel, openInSystemBrowser } from '../utils/inAppBrowser';

const GOOGLE_ENABLED = Boolean((import.meta.env.VITE_GOOGLE_CLIENT_ID as string | undefined)?.trim());

// How long to wait for Google Identity Services to draw its button before deciding it never will.
// In an embedded webview (X, Facebook) Google refuses the origin outright and nothing is ever
// inserted, leaving a silent empty gap where the only sign-in control should be.
const GSI_RENDER_TIMEOUT_MS = 2500;
/** How often to re-check, so a healthy load clears the placeholder without waiting out the timeout. */
const GSI_POLL_MS = 150;
/**
 * Whether GIS actually drew its button inside `el`. Deliberately *not* a height check: the
 * `@react-oauth/google` wrapper gives its own container a fixed height from the `size` prop, so the
 * container measures the same 38px whether Google filled it or ignored it. A real render inserts a
 * subtree whose clickable root carries role="button" (older GIS builds use an iframe instead); a
 * refused one leaves that container empty.
 */
function gsiButtonRendered(el: HTMLElement | null): boolean {
  return Boolean(el?.querySelector('[role="button"], iframe'));
}

interface LoginViewProps {
  reason?: string;
  onGoogle: (credential: string) => Promise<void>;
  onClose: () => void;
}

const LoginView: React.FC<LoginViewProps> = ({ reason, onGoogle, onClose }) => {
  const { lang, t, setLang } = useI18n();
  const [error, setError] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(false);
  // Whether Google's button actually rendered. Keyed off the DOM, never off the user agent: UA
  // sniffing alone would risk hiding a perfectly good sign-in button (the Play Store TWA shell is a
  // real case). Watching for the render also covers a blocked script or a dead network.
  const [gsiState, setGsiState] = React.useState<'pending' | 'ready' | 'failed'>('pending');
  const gsiRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    if (!GOOGLE_ENABLED) return;
    const startedAt = Date.now();
    const poll = window.setInterval(() => {
      if (gsiButtonRendered(gsiRef.current)) {
        setGsiState('ready');
        window.clearInterval(poll);
      } else if (Date.now() - startedAt >= GSI_RENDER_TIMEOUT_MS) {
        setGsiState('failed');
        window.clearInterval(poll);
      }
    }, GSI_POLL_MS);
    return () => window.clearInterval(poll);
  }, []);

  const errMessage = (e: unknown, fallback: string): string =>
    e instanceof ApiError ? e.message : e instanceof Error ? e.message : fallback;

  const submitGoogle = async (credential: string): Promise<void> => {
    setError(null);
    setLoading(true);
    try {
      await onGoogle(credential);
      onClose();
    } catch (e2) {
      setError(errMessage(e2, 'Google sign-in failed. Please try again.'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      onClick={onClose}
      style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,.55)', backdropFilter: 'blur(3px)', zIndex: 1200, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 18 }}
    >
      <div onClick={(e) => e.stopPropagation()} style={{ width: 400, maxWidth: '100%', maxHeight: '92vh', overflowY: 'auto', background: 'var(--bw-surface)', borderRadius: 18, boxShadow: '0 24px 70px rgba(15,23,42,.4)', animation: 'popIn .16s ease-out' }}>
        {/* Header */}
        <div style={{ padding: '22px 24px 0', display: 'flex', alignItems: 'center', gap: 11 }}>
          <div style={{ width: 36, height: 36, borderRadius: 11, background: 'linear-gradient(150deg,var(--bw-primary),var(--bw-primary-deep))', display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 'none' }}>
            <div style={{ width: 13, height: 13, background: 'var(--bw-surface)', borderRadius: '50% 50% 50% 0', transform: 'rotate(45deg)' }} />
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 17, fontWeight: 800 }}>FloodedArea</div>
            <div style={{ fontSize: 11.5, color: 'var(--bw-muted)', fontWeight: 600 }}>{t('login.subtitle')}</div>
          </div>
          <button onClick={onClose} style={{ border: 0, background: 'var(--bw-bg-subtle)', color: 'var(--bw-muted)', width: 28, height: 28, borderRadius: 8, fontSize: 16, cursor: 'pointer' }}>×</button>
        </div>

        <div style={{ padding: 24 }}>
          {/* Language picker — choose once; remembered for next time. Default is English. */}
          <div style={{ marginBottom: 18 }}>
            <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: '.1em', color: 'var(--bw-faint)', marginBottom: 7 }}>
              {t('lang.label').toUpperCase()}
            </div>
            <div role="group" aria-label={t('lang.label')} style={{ display: 'flex', gap: 4, padding: 4, background: 'var(--bw-bg-subtle)', borderRadius: 12 }}>
              {(['en', 'fil'] as Lang[]).map((l) => (
                <button
                  key={l}
                  onClick={() => setLang(l)}
                  aria-pressed={lang === l}
                  style={{ flex: 1, textAlign: 'center', padding: '8px 0', borderRadius: 9, border: 0, fontSize: 13, fontWeight: 700, cursor: 'pointer', color: lang === l ? 'var(--bw-ink)' : 'var(--bw-faint)', background: lang === l ? 'var(--bw-surface)' : 'transparent', boxShadow: lang === l ? '0 1px 3px rgba(15,23,42,.12)' : 'none' }}
                >
                  {t(l === 'en' ? 'lang.en' : 'lang.fil')}
                </button>
              ))}
            </div>
            <div style={{ fontSize: 11, color: 'var(--bw-muted)', marginTop: 6, lineHeight: 1.4 }}>{t('lang.hint')}</div>
          </div>

          {reason && (
            <div style={{ marginBottom: 16, padding: '10px 13px', background: 'var(--bw-tint-info)', border: '1px solid var(--bw-tint-info-border)', borderRadius: 8, fontSize: 12.5, color: 'var(--bw-on-tint-info)', lineHeight: 1.5 }}>
              {reason}
            </div>
          )}

          <p style={{ margin: '0 0 18px', fontSize: 13, color: 'var(--bw-muted)', lineHeight: 1.55 }}>
            {t('login.intro')}
          </p>

          {loading ? (
            <div style={{ textAlign: 'center', padding: '14px 0', fontSize: 13, color: 'var(--bw-muted)' }}>{t('login.verifying')}</div>
          ) : GOOGLE_ENABLED && gsiState === 'failed' ? (
            <InAppSignInHelp lang={lang} t={t} />
          ) : GOOGLE_ENABLED ? (
            <>
              <div ref={gsiRef} style={{ display: 'flex', justifyContent: 'center' }}>
                <GoogleLogin
                  onSuccess={(res) => { if (res.credential) void submitGoogle(res.credential); }}
                  onError={() => setError('Google sign-in was cancelled or failed.')}
                  useOneTap={false}
                  shape="rectangular"
                  size="large"
                  text="signin_with"
                  width="336"
                />
              </div>
              {/* Placeholder under the (initially empty) container so the modal never shows a bare
                  gap while GIS is still loading. Clears the moment the button lays out. */}
              {gsiState === 'pending' && (
                <div style={{ textAlign: 'center', padding: '10px 0 0', fontSize: 12.5, color: 'var(--bw-faint)' }}>
                  {t('login.gsiLoading')}
                </div>
              )}
            </>
          ) : (
            <div style={{ padding: '11px 14px', background: 'var(--bw-bg-subtle)', border: '1px solid var(--bw-line)', borderRadius: 8, fontSize: 12.5, color: 'var(--bw-muted)', lineHeight: 1.5 }}>
              {t('login.notConfigured')}
            </div>
          )}

          {error && <div style={{ marginTop: 14 }}><ErrorBox msg={error} /></div>}

          <button
            onClick={onClose}
            style={{ display: 'block', width: '100%', marginTop: 18, border: 0, background: 'transparent', color: 'var(--bw-muted)', padding: '4px 0', fontSize: 12.5, fontWeight: 700, textDecoration: 'underline', cursor: 'pointer' }}
          >
            {t('guest.keepBrowsing')}
          </button>
        </div>
      </div>
    </div>
  );
};

/**
 * Shown in place of Google's button when it never rendered. On Android we can hand the current URL
 * (deep-link and all) to the system browser outright; iOS has no equivalent API, so it gets the
 * written steps plus a copyable link.
 */
const InAppSignInHelp: React.FC<{ lang: Lang; t: (k: MsgKey) => string }> = ({ lang, t }) => {
  const app = React.useMemo(detectInAppBrowser, []);
  const canHandOff = React.useMemo(canOpenInSystemBrowser, []);
  const label = inAppLabel(app);
  const [copied, setCopied] = React.useState(false);

  const copyLink = async (): Promise<void> => {
    try {
      await navigator.clipboard?.writeText(window.location.href);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      /* clipboard blocked — the written steps below still get the user out */
    }
  };

  return (
    <div style={{ padding: '13px 15px', background: 'var(--bw-tint-info)', border: '1px solid var(--bw-tint-info-border)', borderRadius: 10, color: 'var(--bw-on-tint-info)' }}>
      <div style={{ fontSize: 13.5, fontWeight: 800, marginBottom: 6 }}>{t('login.inApp.title')}</div>
      <div style={{ fontSize: 12.5, lineHeight: 1.55 }}>
        {label ? tFormat(lang, 'login.inApp.body', { app: label }) : t('login.inApp.bodyGeneric')}
      </div>

      <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
        {canHandOff && (
          <button
            onClick={() => { openInSystemBrowser(); }}
            style={{ flex: 1, border: 0, background: 'var(--bw-primary)', color: 'var(--bw-on-accent)', borderRadius: 9, padding: '10px 12px', fontSize: 12.5, fontWeight: 800, cursor: 'pointer' }}
          >
            {t('login.inApp.openBrowser')}
          </button>
        )}
        <button
          onClick={() => void copyLink()}
          style={{ flex: canHandOff ? 'none' : 1, border: '1px solid var(--bw-tint-info-border)', background: 'var(--bw-surface)', color: 'var(--bw-ink-soft)', borderRadius: 9, padding: '10px 14px', fontSize: 12.5, fontWeight: 700, cursor: 'pointer' }}
        >
          {copied ? t('login.inApp.copied') : t('login.inApp.copyLink')}
        </button>
      </div>

      <div style={{ fontSize: 11.5, lineHeight: 1.5, marginTop: 10, opacity: 0.85 }}>
        {t(canHandOff ? 'login.inApp.stepsAndroid' : 'login.inApp.stepsIos')}
      </div>

      <div style={{ fontSize: 11.5, lineHeight: 1.5, marginTop: 10, paddingTop: 10, borderTop: '1px solid var(--bw-tint-info-border)' }}>
        {t('login.inApp.guestNote')}
      </div>
    </div>
  );
};

const ErrorBox: React.FC<{ msg: string }> = ({ msg }) => (
  <div style={{ padding: '10px 13px', background: 'var(--bw-tint-danger)', border: '1px solid var(--bw-tint-danger-border)', borderRadius: 8, fontSize: 12.5, color: 'var(--bw-on-tint-danger)', lineHeight: 1.5 }}>{msg}</div>
);

export default LoginView;
