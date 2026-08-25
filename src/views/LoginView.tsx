import React from 'react';
import { GoogleLogin } from '@react-oauth/google';
import { ApiError } from '../api/client';
import { useI18n, type Lang } from '../i18n';

const GOOGLE_ENABLED = Boolean((import.meta.env.VITE_GOOGLE_CLIENT_ID as string | undefined)?.trim());

interface LoginViewProps {
  reason?: string;
  onGoogle: (credential: string) => Promise<void>;
  onClose: () => void;
}

const LoginView: React.FC<LoginViewProps> = ({ reason, onGoogle, onClose }) => {
  const { lang, t, setLang } = useI18n();
  const [error, setError] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(false);

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
          ) : GOOGLE_ENABLED ? (
            <div style={{ display: 'flex', justifyContent: 'center' }}>
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

const ErrorBox: React.FC<{ msg: string }> = ({ msg }) => (
  <div style={{ padding: '10px 13px', background: 'var(--bw-tint-danger)', border: '1px solid var(--bw-tint-danger-border)', borderRadius: 8, fontSize: 12.5, color: 'var(--bw-on-tint-danger)', lineHeight: 1.5 }}>{msg}</div>
);

export default LoginView;
