import React from 'react';
import type { FeedbackType, NewFeedback } from '../../types';
import TurnstileWidget from '../TurnstileWidget';

interface FeedbackFormModalProps {
  isMobile: boolean;
  sending: boolean;
  /** When true (a no-login guest with Turnstile configured), the CAPTCHA must be solved before submit. */
  captchaRequired: boolean;
  onSubmit: (body: NewFeedback) => void;
  onClose: () => void;
}

const TYPES: { value: FeedbackType; icon: string; label: string }[] = [
  { value: 'feature', icon: '💡', label: 'Feature request' },
  { value: 'bug', icon: '🐞', label: 'Bug report' },
];

/** Lets a signed-in user file a bug report or feature request. Opened from the Features modal;
 *  renders above it (a bottom sheet on mobile, a centered card on desktop). */
const FeedbackFormModal: React.FC<FeedbackFormModalProps> = ({ isMobile, sending, captchaRequired, onSubmit, onClose }) => {
  const [type, setType] = React.useState<FeedbackType>('feature');
  const [title, setTitle] = React.useState('');
  const [details, setDetails] = React.useState('');
  const [captchaToken, setCaptchaToken] = React.useState<string | null>(null);
  const canSubmit = title.trim().length > 0 && !sending && (!captchaRequired || !!captchaToken);

  const submit = (): void => {
    if (!canSubmit) return;
    onSubmit({ type, title: title.trim(), details: details.trim() || undefined, captchaToken: captchaToken ?? undefined });
  };

  return (
    <div
      onClick={onClose}
      style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,.55)', backdropFilter: 'blur(3px)', zIndex: 1350, display: 'flex', alignItems: isMobile ? 'flex-end' : 'center', justifyContent: 'center', padding: isMobile ? 0 : 18 }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={
          isMobile
            ? { width: '100%', maxHeight: '92vh', overflowY: 'auto', background: '#fff', borderRadius: '20px 20px 0 0', boxShadow: '0 -10px 40px rgba(15,23,42,.35)', animation: 'sheetUp .22s ease-out' }
            : { width: 440, maxWidth: '100%', maxHeight: '92vh', overflowY: 'auto', background: '#fff', borderRadius: 20, boxShadow: '0 24px 70px rgba(15,23,42,.4)', animation: 'popIn .16s ease-out' }
        }
      >
        {/* Header */}
        <div style={{ background: 'linear-gradient(150deg,#0EA5E9,#0369A1)', padding: '20px 22px', color: '#fff', display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ width: 40, height: 40, borderRadius: 12, background: 'rgba(255,255,255,.18)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, flex: 'none' }}>💡</div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 'clamp(16px, 4.5vw, 18px)', fontWeight: 800, lineHeight: 1.25 }}>Share feedback</div>
            <div style={{ fontSize: 12, opacity: 0.9 }}>Report a bug or request a feature</div>
          </div>
          <button onClick={onClose} aria-label="Close" style={{ border: 0, background: 'rgba(255,255,255,.18)', color: '#fff', width: 28, height: 28, borderRadius: 8, fontSize: 17, cursor: 'pointer', flex: 'none' }}>×</button>
        </div>

        <div style={{ padding: 'clamp(16px, 4vw, 18px) clamp(16px, 5vw, 22px) clamp(18px, 5vw, 22px)' }}>
          {/* Type toggle */}
          <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
            {TYPES.map((t) => {
              const on = type === t.value;
              return (
                <button
                  key={t.value}
                  onClick={() => setType(t.value)}
                  style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7, padding: '10px 8px', borderRadius: 11, fontSize: 13, fontWeight: 800, cursor: 'pointer', border: `1px solid ${on ? '#BAE2FB' : 'var(--bw-line)'}`, background: on ? '#EFF8FF' : '#fff', color: on ? 'var(--bw-primary)' : 'var(--bw-ink-soft)' }}
                >
                  <span>{t.icon}</span> {t.label}
                </button>
              );
            })}
          </div>

          <label style={{ display: 'block', fontSize: 11, fontWeight: 800, letterSpacing: '.06em', color: 'var(--bw-faint)', marginBottom: 5 }}>TITLE</label>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            maxLength={120}
            placeholder={type === 'bug' ? 'What went wrong?' : 'What would you like?'}
            style={{ width: '100%', boxSizing: 'border-box', padding: '11px 13px', border: '1px solid var(--bw-line)', borderRadius: 11, fontSize: 13.5, color: 'var(--bw-ink)', outline: 'none', background: 'var(--bw-bg-subtle)' }}
          />

          <label style={{ display: 'block', fontSize: 11, fontWeight: 800, letterSpacing: '.06em', color: 'var(--bw-faint)', margin: '13px 0 5px' }}>DETAILS <span style={{ fontWeight: 600, color: 'var(--bw-muted)' }}>(optional)</span></label>
          <textarea
            value={details}
            onChange={(e) => setDetails(e.target.value)}
            maxLength={2000}
            rows={4}
            placeholder={type === 'bug' ? 'Steps to reproduce, what you expected…' : 'How would it help? Any details…'}
            style={{ width: '100%', boxSizing: 'border-box', padding: '11px 13px', border: '1px solid var(--bw-line)', borderRadius: 11, fontSize: 13.5, color: 'var(--bw-ink)', outline: 'none', background: 'var(--bw-bg-subtle)', resize: 'vertical', fontFamily: 'inherit', lineHeight: 1.5 }}
          />

          {captchaRequired && (
            <div style={{ marginTop: 14, display: 'flex', justifyContent: 'center' }}>
              <TurnstileWidget onToken={setCaptchaToken} />
            </div>
          )}

          <button
            onClick={submit}
            disabled={!canSubmit}
            style={{ width: '100%', marginTop: 16, border: 0, background: 'var(--bw-primary)', color: '#fff', padding: 14, borderRadius: 13, fontSize: 15, fontWeight: 800, cursor: canSubmit ? 'pointer' : 'not-allowed', opacity: canSubmit ? 1 : 0.6, boxShadow: '0 6px 16px rgba(14,165,233,.3)' }}
          >
            {sending ? 'Sending…' : 'Submit'}
          </button>
          <div style={{ marginTop: 10, textAlign: 'center', fontSize: 11, color: 'var(--bw-faint)', lineHeight: 1.4 }}>
            Once an admin accepts it, it appears on the Community feedback board for everyone to upvote.
          </div>
        </div>
      </div>
    </div>
  );
};

export default FeedbackFormModal;
