import React from 'react';
import { GoogleLogin } from '@react-oauth/google';
import { ApiError } from '../api/client';

const GOOGLE_ENABLED = Boolean((import.meta.env.VITE_GOOGLE_CLIENT_ID as string | undefined)?.trim());

interface LoginViewProps {
  reason?: string;
  onGoogle: (credential: string) => Promise<void>;
  onClose: () => void;
}

const LoginView: React.FC<LoginViewProps> = ({ reason, onGoogle, onClose }) => {
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
      <div onClick={(e) => e.stopPropagation()} style={{ width: 400, maxWidth: '100%', maxHeight: '92vh', overflowY: 'auto', background: '#fff', borderRadius: 18, boxShadow: '0 24px 70px rgba(15,23,42,.4)', animation: 'popIn .16s ease-out' }}>
        {/* Header */}
        <div style={{ padding: '22px 24px 0', display: 'flex', alignItems: 'center', gap: 11 }}>
          <div style={{ width: 36, height: 36, borderRadius: 11, background: 'linear-gradient(150deg,#0EA5E9,#0369A1)', display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 'none' }}>
            <div style={{ width: 13, height: 13, background: '#fff', borderRadius: '50% 50% 50% 0', transform: 'rotate(45deg)' }} />
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 17, fontWeight: 800 }}>FloodedArea</div>
            <div style={{ fontSize: 11.5, color: 'var(--bw-muted)', fontWeight: 600 }}>Sign in to report &amp; get help</div>
          </div>
          <button onClick={onClose} style={{ border: 0, background: 'var(--bw-bg-subtle)', color: '#7C8B98', width: 28, height: 28, borderRadius: 8, fontSize: 16, cursor: 'pointer' }}>×</button>
        </div>

        <div style={{ padding: 24 }}>
          {reason && (
            <div style={{ marginBottom: 16, padding: '10px 13px', background: '#EFF6FF', border: '1px solid #BFDBFE', borderRadius: 8, fontSize: 12.5, color: '#1D4ED8', lineHeight: 1.5 }}>
              {reason}
            </div>
          )}

          <p style={{ margin: '0 0 18px', fontSize: 13, color: 'var(--bw-muted)', lineHeight: 1.55 }}>
            Sign in with your Google account. A FloodedArea account is created automatically on first use.
          </p>

          {loading ? (
            <div style={{ textAlign: 'center', padding: '14px 0', fontSize: 13, color: 'var(--bw-muted)' }}>Verifying…</div>
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
              Google SSO isn’t configured. Set <code>VITE_GOOGLE_CLIENT_ID</code> to enable sign-in.
            </div>
          )}

          {error && <div style={{ marginTop: 14 }}><ErrorBox msg={error} /></div>}
        </div>
      </div>
    </div>
  );
};

const ErrorBox: React.FC<{ msg: string }> = ({ msg }) => (
  <div style={{ padding: '10px 13px', background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: 8, fontSize: 12.5, color: '#B91C1C', lineHeight: 1.5 }}>{msg}</div>
);

export default LoginView;
