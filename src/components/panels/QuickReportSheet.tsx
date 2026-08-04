import React from 'react';
import type { Severity } from '../../types';
import { useI18n } from '../../i18n';
import { listenForSeverity, speak, speechSupported } from '../../utils/voiceReport';
import ReportModeToggle from './ReportModeToggle';
import TurnstileWidget from '../TurnstileWidget';

interface Option {
  sev: Severity;
  label: string;
  hint: string;
  dot: string;
  border: string;
  bg: string;
}

const OPTIONS: Option[] = [
  { sev: 'high', label: 'High', hint: 'Chest-deep or more · impassable', dot: '#EF4444', border: '#FBD2D2', bg: '#FEF4F4' },
  { sev: 'medium', label: 'Medium', hint: 'Knee to waist · risky to cross', dot: '#F59E0B', border: '#F8E2BB', bg: '#FFFAF0' },
  { sev: 'low', label: 'Low', hint: 'Ankle-deep · passable with care', dot: '#16A34A', border: '#BFE8CC', bg: '#F2FCF5' },
];

const VOICE_SPOKEN_KEY: Record<Severity, 'quick.voiceSpokenHigh' | 'quick.voiceSpokenMedium' | 'quick.voiceSpokenLow'> = {
  high: 'quick.voiceSpokenHigh',
  medium: 'quick.voiceSpokenMedium',
  low: 'quick.voiceSpokenLow',
};

interface QuickReportSheetProps {
  isMobile: boolean;
  /** Current report mode — always 'quick' here, but ReportModeToggle needs it to render the
   *  active state (rendered inline on mobile; see App.tsx for the desktop floating pill). */
  mode: 'report' | 'quick';
  onSwitchMode: (mode: 'report' | 'quick') => void;
  busy: boolean;
  detectedRoad: string | null;
  accuracyM: number | null;
  captchaRequired: boolean;
  onQuick: (sev: Severity, captchaToken?: string) => void;
  onDone: () => void;
}

/**
 * One-tap flood reporting for a passenger in transit. Three big severity buttons post instantly at
 * the live GPS location (depth/trend/road come from SEVERITY_PRESET — see App.tsx's quickPost) and
 * the sheet stays open so a passenger can mark several flooded points along the drive. A floating
 * "Voice Report" FAB (anchored above the sheet's top-right corner) is a progressive enhancement on
 * top of the buttons, never a replacement.
 */
const QuickReportSheet: React.FC<QuickReportSheetProps> = ({ isMobile, mode, onSwitchMode, busy, detectedRoad, accuracyM, captchaRequired, onQuick, onDone }) => {
  const { lang, t } = useI18n();
  const [captchaToken, setCaptchaToken] = React.useState<string | null>(null);
  const [justPosted, setJustPosted] = React.useState<Severity | null>(null);
  const [listening, setListening] = React.useState(false);
  const [voiceMsg, setVoiceMsg] = React.useState<string | null>(null);
  const cancelListenRef = React.useRef<(() => void) | null>(null);
  const flashTimer = React.useRef<number | undefined>(undefined);

  React.useEffect(() => () => {
    cancelListenRef.current?.();
    window.clearTimeout(flashTimer.current);
  }, []);

  const flashPosted = (sev: Severity): void => {
    window.clearTimeout(flashTimer.current);
    setJustPosted(sev);
    flashTimer.current = window.setTimeout(() => setJustPosted(null), 1600);
  };

  const post = (sev: Severity): void => {
    onQuick(sev, captchaToken ?? undefined);
    flashPosted(sev);
  };

  const startVoice = (): void => {
    if (busy || listening) return;
    setVoiceMsg(null);
    setListening(true);
    cancelListenRef.current = listenForSeverity({
      lang,
      onResult: (sev) => {
        if (sev) {
          post(sev);
          speak(t(VOICE_SPOKEN_KEY[sev]), lang);
        } else {
          setVoiceMsg(t('quick.voiceNoMatch'));
        }
      },
      onError: () => setVoiceMsg(t('quick.voiceError')),
      onEnd: () => setListening(false),
    });
  };

  const stopVoice = (): void => {
    cancelListenRef.current?.();
    setListening(false);
  };

  const locationLine = detectedRoad ?? t('quick.locating');
  const accSuffix = accuracyM != null ? ` · ±${Math.round(accuracyM)} m` : '';

  const card = (
    <div style={{ background: '#fff', borderRadius: 15, boxShadow: '0 12px 36px rgba(15,23,42,.28)', overflow: 'hidden', border: '1px solid var(--bw-line)' }}>
      {/* Mobile only — desktop keeps the floating pill above the map (App.tsx); see ReportModeToggle. */}
      {isMobile && (
        <div style={{ padding: '12px 15px 0' }}>
          <ReportModeToggle mode={mode} onSwitch={onSwitchMode} />
        </div>
      )}
      <div style={{ display: 'flex', gap: 9, padding: '11px 15px', background: '#FFF7ED', borderBottom: '1px solid #FED7AA' }}>
        <span style={{ fontSize: 14, flex: 'none', lineHeight: 1.3 }}>⚠️</span>
        <p style={{ margin: 0, fontSize: 11.5, lineHeight: 1.45, color: '#7C2D12', fontWeight: 600 }}>{t('quick.safety')}</p>
      </div>

      <div style={{ padding: '11px 15px 4px', fontSize: 12, fontWeight: 700, color: 'var(--bw-ink-soft)', display: 'flex', alignItems: 'center', gap: 6 }}>
        <span>📍</span>
        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{locationLine}{accSuffix}</span>
      </div>

      <div style={{ padding: '9px 15px 10px', fontSize: 13.5, fontWeight: 800 }}>{t('quick.howBad')}</div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 7, padding: '0 12px 10px' }}>
        {OPTIONS.map((o) => {
          const posted = justPosted === o.sev;
          return (
            <button
              key={o.sev}
              disabled={busy}
              onClick={() => post(o.sev)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 11,
                padding: '13px 12px',
                border: `1.5px solid ${posted ? o.dot : o.border}`,
                background: posted ? o.dot : o.bg,
                borderRadius: 11,
                cursor: busy ? 'wait' : 'pointer',
                textAlign: 'left',
                opacity: busy ? 0.7 : 1,
                transition: 'background .15s, border-color .15s',
              }}
            >
              <span style={{ width: 16, height: 16, borderRadius: '50%', background: posted ? '#fff' : o.dot, flex: 'none' }} />
              <span>
                <span style={{ fontSize: 13.5, fontWeight: 800, color: posted ? '#fff' : 'var(--bw-ink)', display: 'block' }}>
                  {posted ? '✓ ' + t('quick.reported') : o.label}
                </span>
                {!posted && <span style={{ fontSize: 11, color: 'var(--bw-muted)' }}>{o.hint}</span>}
              </span>
            </button>
          );
        })}
      </div>

      {captchaRequired && (
        <div style={{ padding: '0 15px 10px' }}>
          <TurnstileWidget onToken={setCaptchaToken} />
        </div>
      )}

      <div style={{ padding: '2px 12px 14px' }}>
        <button
          onClick={onDone}
          style={{ width: '100%', border: 0, background: 'transparent', color: 'var(--bw-muted)', fontSize: 12.5, fontWeight: 700, padding: 8, cursor: 'pointer' }}
        >
          {t('quick.done')}
        </button>
      </div>
    </div>
  );

  // Floating "Voice Report" FAB — a relocation of the old in-card mic button, styled after the
  // chat bubble (ChatWidget.tsx) so it reads as a distinct floating action, not a form control.
  // Anchored to the sheet wrapper (a sibling of `card`) at top:-64/right:16, i.e. just above the
  // card's top-right corner, so it floats clear of the card and the dimmer at any viewport.
  const voiceFab = speechSupported() && (
    <div style={{ position: 'absolute', right: 16, top: -64, display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 6 }}>
      <button
        type="button"
        disabled={busy}
        onClick={listening ? stopVoice : startVoice}
        aria-label={listening ? t('quick.voiceListening') : t('quick.voiceTap')}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 9,
          height: 54,
          padding: '0 20px 0 16px',
          border: 0,
          borderRadius: 27,
          background: listening ? 'linear-gradient(150deg,#EF4444,#B91C1C)' : 'linear-gradient(150deg,#0EA5E9,#0369A1)',
          color: '#fff',
          fontSize: 14,
          fontWeight: 800,
          cursor: busy ? 'wait' : 'pointer',
          boxShadow: listening ? '0 10px 26px rgba(185,28,28,.5)' : '0 10px 26px rgba(3,105,161,.5)',
          animation: listening ? 'floodPulse 1.3s ease-in-out infinite' : undefined,
          whiteSpace: 'nowrap',
        }}
      >
        <span style={{ fontSize: 18, lineHeight: 1 }}>🎤</span>
        {listening ? t('quick.voiceListening') : t('quick.voiceTap')}
      </button>
      {voiceMsg && (
        <div style={{ maxWidth: 220, background: '#0F172A', color: '#fff', fontSize: 10.5, fontWeight: 600, padding: '6px 10px', borderRadius: 9, textAlign: 'right', boxShadow: '0 6px 18px rgba(15,23,42,.3)' }}>
          {voiceMsg}
        </div>
      )}
    </div>
  );

  if (isMobile) {
    return (
      <>
        <div onClick={onDone} style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,.4)', zIndex: 1100 }} />
        {/* Outer wrapper has no overflow, so the FAB (positioned above it via top:-64) never gets
            clipped; the inner div owns the scroll/animation for the card itself. */}
        <div style={{ position: 'fixed', left: 0, right: 0, bottom: 0, zIndex: 1110 }}>
          {voiceFab}
          <div style={{ maxHeight: '82vh', overflowY: 'auto', animation: 'sheetUp .22s ease-out' }}>
            {card}
          </div>
        </div>
      </>
    );
  }
  return (
    <div style={{ position: 'fixed', left: '50%', bottom: 24, transform: 'translateX(-50%)', width: 300, zIndex: 1110, animation: 'popIn .14s ease-out' }}>
      {voiceFab}
      {card}
    </div>
  );
};

export default QuickReportSheet;
