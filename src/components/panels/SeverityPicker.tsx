import React from 'react';
import type { Severity } from '../../types';
import { DEPTH_RANGE, SEVERITY_PRESET, SEV_META } from '../../utils/floodMeta';
import { fileToCompressedDataUrl } from '../../utils/image';
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

interface SeverityPickerProps {
  isMobile: boolean;
  busy: boolean;
  reporterName: string;
  /** Road auto-detected from the pin (reverse-geocoded); prefills the editable road field. */
  detectedRoad: string | null;
  /** True while the reverse-geocode lookup is in flight. */
  detecting: boolean;
  /** Show a CAPTCHA the reporter must clear before posting (guest submits with Turnstile enabled). */
  captchaRequired: boolean;
  onPick: (sev: Severity, depthCm: number, identify: boolean, road: string, captchaToken?: string, photoDataUrl?: string) => void;
  onCancel: () => void;
}

const SeverityPicker: React.FC<SeverityPickerProps> = ({ isMobile, busy, reporterName, detectedRoad, detecting, captchaRequired, onPick, onCancel }) => {
  // Solved Turnstile token (Managed widget below); required before posting when captchaRequired.
  const [captchaToken, setCaptchaToken] = React.useState<string | null>(null);
  // Step 1: choose a category. Step 2: dial in the depth (seeded from the category's preset).
  const [sev, setSev] = React.useState<Severity | null>(null);
  const [depth, setDepth] = React.useState(0);
  // Whether to attach the reporter's name to the report (vs. posting anonymously).
  const [identify, setIdentify] = React.useState(true);
  const nameLabel = reporterName.trim() || 'My name';

  // Editable road name, prefilled from the reverse-geocoded detection. Keep syncing with new
  // detections until the reporter edits it themselves.
  const [road, setRoad] = React.useState(detectedRoad ?? '');
  const roadEdited = React.useRef(false);
  React.useEffect(() => {
    if (!roadEdited.current && detectedRoad) setRoad(detectedRoad);
  }, [detectedRoad]);

  // Optional flood photo, held as a compressed JPEG data-URL. Compression runs on select so the
  // preview and the eventual upload use the same shrunk image.
  const [photo, setPhoto] = React.useState<string | null>(null);
  const [photoBusy, setPhotoBusy] = React.useState(false);
  const [photoError, setPhotoError] = React.useState<string | null>(null);
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  const onPickPhoto = async (e: React.ChangeEvent<HTMLInputElement>): Promise<void> => {
    const file = e.target.files?.[0];
    e.target.value = ''; // allow re-selecting the same file after a remove
    if (!file) return;
    setPhotoError(null);
    setPhotoBusy(true);
    try {
      setPhoto(await fileToCompressedDataUrl(file));
    } catch (err) {
      setPhotoError(err instanceof Error ? err.message : 'Could not add that photo.');
      setPhoto(null);
    } finally {
      setPhotoBusy(false);
    }
  };

  const photoField = (
    <div style={{ padding: '10px 15px 4px' }}>
      <label style={{ display: 'block', fontSize: 10, fontWeight: 800, letterSpacing: '.1em', color: 'var(--bw-faint)', marginBottom: 6 }}>
        PHOTO <span style={{ fontWeight: 700, letterSpacing: 0 }}>(optional)</span>
      </label>
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        onChange={(e) => void onPickPhoto(e)}
        style={{ display: 'none' }}
      />
      {photo ? (
        <div style={{ position: 'relative', borderRadius: 10, overflow: 'hidden', border: '1.5px solid #E2E8F0' }}>
          <img src={photo} alt="Flood photo preview" style={{ width: '100%', maxHeight: 150, objectFit: 'cover', display: 'block' }} />
          <button
            type="button"
            disabled={busy}
            onClick={() => { setPhoto(null); setPhotoError(null); }}
            style={{ position: 'absolute', top: 6, right: 6, border: 0, background: 'rgba(15,23,42,.62)', color: '#fff', borderRadius: 8, padding: '4px 9px', fontSize: 11, fontWeight: 800, cursor: busy ? 'wait' : 'pointer' }}
          >
            Remove
          </button>
        </div>
      ) : (
        <button
          type="button"
          disabled={busy || photoBusy}
          onClick={() => fileInputRef.current?.click()}
          style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, padding: '11px', border: '1.5px dashed #CBD5E1', borderRadius: 10, background: '#F8FAFC', color: 'var(--bw-ink-soft)', fontSize: 12.5, fontWeight: 800, cursor: busy || photoBusy ? 'wait' : 'pointer' }}
        >
          {photoBusy ? 'Processing photo…' : '📷 Add a photo'}
        </button>
      )}
      <div style={{ fontSize: 10.5, color: photoError ? 'var(--bw-danger)' : 'var(--bw-faint)', fontWeight: 600, marginTop: 4 }}>
        {photoError ?? 'Attach a photo of the flooding as proof — optional.'}
      </div>
    </div>
  );

  const roadField = (
    <div style={{ padding: '13px 15px 4px' }}>
      <label style={{ display: 'block', fontSize: 10, fontWeight: 800, letterSpacing: '.1em', color: 'var(--bw-faint)', marginBottom: 6 }}>
        ROAD / STREET
      </label>
      <input
        value={road}
        disabled={busy}
        onChange={(e) => { roadEdited.current = true; setRoad(e.target.value); }}
        placeholder={detecting ? 'Detecting street…' : 'e.g. Lilac Street'}
        style={{ width: '100%', boxSizing: 'border-box', padding: '9px 11px', border: '1.5px solid #E2E8F0', borderRadius: 10, fontSize: 13, fontWeight: 700, color: 'var(--bw-ink)', outline: 'none', background: busy ? '#F8FAFC' : '#fff' }}
      />
      <div style={{ fontSize: 10.5, color: 'var(--bw-faint)', fontWeight: 600, marginTop: 4 }}>
        {detecting ? 'Finding the street from your pin…' : 'Auto-detected from the pin — edit if it’s wrong.'}
      </div>
    </div>
  );

  const chooseSeverity = (s: Severity): void => {
    setSev(s);
    setDepth(SEVERITY_PRESET[s].depthCm);
  };

  const categoryStep = (
    <>
      <div style={{ padding: '13px 15px 10px' }}>
        <div style={{ fontSize: 13.5, fontWeight: 800 }}>How bad is the flooding here?</div>
        <div style={{ fontSize: 11.5, color: 'var(--bw-muted)', marginTop: 2 }}>Pick a level, then set the water depth.</div>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 7, padding: '0 12px 14px' }}>
        {OPTIONS.map((o) => (
          <button
            key={o.sev}
            disabled={busy}
            onClick={() => chooseSeverity(o.sev)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 11,
              padding: '11px 12px',
              border: `1.5px solid ${o.border}`,
              background: o.bg,
              borderRadius: 11,
              cursor: busy ? 'wait' : 'pointer',
              textAlign: 'left',
              opacity: busy ? 0.7 : 1,
            }}
          >
            <span style={{ width: 14, height: 14, borderRadius: '50%', background: o.dot, flex: 'none' }} />
            <span>
              <span style={{ fontSize: 13, fontWeight: 800, color: 'var(--bw-ink)', display: 'block' }}>{o.label}</span>
              <span style={{ fontSize: 11, color: 'var(--bw-muted)' }}>{o.hint}</span>
            </span>
          </button>
        ))}
        <button
          onClick={onCancel}
          style={{ border: 0, background: 'transparent', color: 'var(--bw-muted)', fontSize: 12, fontWeight: 700, padding: 6, cursor: 'pointer' }}
        >
          Move pin / cancel
        </button>
      </div>
    </>
  );

  const depthStep = (() => {
    if (sev == null) return null;
    const o = OPTIONS.find((x) => x.sev === sev)!;
    const range = DEPTH_RANGE[sev];
    return (
      <>
        <div style={{ padding: '13px 15px 8px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ width: 12, height: 12, borderRadius: '50%', background: o.dot, flex: 'none' }} />
            <span style={{ fontSize: 13.5, fontWeight: 800 }}>{o.label} flooding — how deep?</span>
          </div>
          <div style={{ fontSize: 11.5, color: 'var(--bw-muted)', marginTop: 3 }}>Drag to match what you see.</div>
        </div>

        <div style={{ padding: '0 15px 6px' }}>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 7, marginBottom: 8 }}>
            <span style={{ fontSize: 26, fontWeight: 800, color: 'var(--bw-ink)', letterSpacing: '-.02em' }}>{depth}</span>
            <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--bw-muted)' }}>cm</span>
            <span style={{ fontSize: 11.5, color: o.dot, fontWeight: 700, marginLeft: 'auto' }}>{SEV_META[sev].depthLabel}</span>
          </div>
          <input
            type="range"
            min={range.min}
            max={range.max}
            step={range.step}
            value={depth}
            disabled={busy}
            onChange={(e) => setDepth(Number(e.target.value))}
            style={{ width: '100%', accentColor: o.dot, cursor: busy ? 'wait' : 'pointer' }}
          />
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10.5, color: 'var(--bw-faint)', fontWeight: 600, marginTop: 2 }}>
            <span>{range.min} cm</span>
            <span>{range.max} cm</span>
          </div>
        </div>

        <div style={{ padding: '8px 15px 2px' }}>
          <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: '.1em', color: 'var(--bw-faint)', marginBottom: 6 }}>POST AS</div>
          <div style={{ display: 'flex', gap: 7 }}>
            {[
              { on: true, label: nameLabel, sub: 'Shown on your report' },
              { on: false, label: 'Anonymous', sub: 'Hide your name' },
            ].map((opt) => {
              const active = identify === opt.on;
              return (
                <button
                  key={String(opt.on)}
                  disabled={busy}
                  onClick={() => setIdentify(opt.on)}
                  style={{ flex: 1, minWidth: 0, textAlign: 'left', padding: '9px 11px', borderRadius: 10, cursor: busy ? 'wait' : 'pointer', border: `1.5px solid ${active ? 'var(--bw-primary)' : '#E2E8F0'}`, background: active ? 'rgba(14,165,233,.08)' : '#fff' }}
                >
                  <span style={{ display: 'block', fontSize: 12.5, fontWeight: 800, color: active ? 'var(--bw-primary-deep)' : 'var(--bw-ink)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{opt.label}</span>
                  <span style={{ display: 'block', fontSize: 10.5, color: 'var(--bw-muted)', marginTop: 1 }}>{opt.sub}</span>
                </button>
              );
            })}
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 7, padding: '10px 12px 14px' }}>
          {captchaRequired && (
            <div style={{ padding: '0 3px' }}>
              <TurnstileWidget onToken={setCaptchaToken} />
              {!captchaToken && (
                <div style={{ fontSize: 10.5, color: 'var(--bw-faint)', fontWeight: 600, marginTop: 2 }}>
                  Quick security check — confirms you’re human before posting.
                </div>
              )}
            </div>
          )}
          <button
            disabled={busy || photoBusy || (captchaRequired && !captchaToken)}
            onClick={() => onPick(sev, depth, identify, road.trim(), captchaToken ?? undefined, photo ?? undefined)}
            style={{ border: 0, background: 'var(--bw-primary)', color: '#fff', padding: '12px', borderRadius: 11, fontSize: 13.5, fontWeight: 800, cursor: busy || photoBusy || (captchaRequired && !captchaToken) ? 'not-allowed' : 'pointer', opacity: busy || photoBusy || (captchaRequired && !captchaToken) ? 0.6 : 1 }}
          >
            {busy ? 'Posting…' : photoBusy ? 'Processing photo…' : 'Post flood report'}
          </button>
          <button
            onClick={() => setSev(null)}
            disabled={busy}
            style={{ border: 0, background: 'transparent', color: 'var(--bw-muted)', fontSize: 12, fontWeight: 700, padding: 6, cursor: busy ? 'wait' : 'pointer' }}
          >
            ← Back to levels
          </button>
        </div>
      </>
    );
  })();

  const card = (
    <div style={{ background: '#fff', borderRadius: 15, boxShadow: '0 12px 36px rgba(15,23,42,.28)', overflow: 'hidden', border: '1px solid var(--bw-line)' }}>
      {roadField}
      {photoField}
      {sev == null ? categoryStep : depthStep}
    </div>
  );

  if (isMobile) {
    return (
      <>
        <div onClick={onCancel} style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,.4)', zIndex: 1100 }} />
        <div style={{ position: 'fixed', left: 0, right: 0, bottom: 0, zIndex: 1110, maxHeight: '82vh', overflowY: 'auto', animation: 'sheetUp .22s ease-out' }}>
          {card}
        </div>
      </>
    );
  }
  return (
    <div style={{ position: 'fixed', left: '50%', bottom: 24, transform: 'translateX(-50%)', width: 280, zIndex: 1110, animation: 'popIn .14s ease-out' }}>
      {card}
    </div>
  );
};

export default SeverityPicker;
