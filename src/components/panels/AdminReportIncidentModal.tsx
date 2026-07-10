import React from 'react';
import type { NewReport, Severity } from '../../types';
import { DEPTH_RANGE, SEVERITY_PRESET, SEV_META } from '../../utils/floodMeta';
import { reverseGeocode } from '../../api/geocode';
import { fileToCompressedDataUrl } from '../../utils/image';
import PlaceField from './PlaceField';
import DepthReference from './DepthReference';

/**
 * Admin-only "Report a flood incident" modal. Lets an admin log a flood known from news or other
 * sources: pick any location worldwide, set severity/depth, optionally attach a screenshot, and
 * post it. The parent tags it as a system report (reporterTrust: 'system') and, on success, offers
 * to share it to social media.
 */
interface Props {
  isMobile: boolean;
  /** Post the report. Throws on failure so the modal keeps the form open and shows an error. */
  onSubmit: (b: NewReport) => Promise<void>;
  onClose: () => void;
}

const SEV_ORDER: Severity[] = ['high', 'medium', 'low'];

// How long a system report stays live. '' = fall back to the severity-scaled default; else minutes.
const TTL_OPTIONS: { value: string; label: string }[] = [
  { value: '', label: 'Default (by severity)' },
  { value: '60', label: '1 hour' },
  { value: '180', label: '3 hours' },
  { value: '360', label: '6 hours' },
  { value: '720', label: '12 hours' },
  { value: '1440', label: '24 hours' },
  { value: '2880', label: '48 hours' },
];

const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '9px 11px',
  border: '1px solid var(--bw-line)',
  borderRadius: 9,
  fontSize: 13,
  color: 'var(--bw-ink)',
  background: '#fff',
  boxSizing: 'border-box',
};

const labelStyle: React.CSSProperties = { fontSize: 11, fontWeight: 700, color: 'var(--bw-muted)', marginBottom: 4, display: 'block' };

const AdminReportIncidentModal: React.FC<Props> = ({ isMobile, onSubmit, onClose }) => {
  const [lat, setLat] = React.useState('');
  const [lng, setLng] = React.useState('');
  const [placeLabel, setPlaceLabel] = React.useState('');
  const [name, setName] = React.useState('');
  const [district, setDistrict] = React.useState('');
  const [severity, setSeverity] = React.useState<Severity>('high');
  const [depth, setDepth] = React.useState(SEVERITY_PRESET.high.depthCm);
  const [note, setNote] = React.useState('');
  // When the source reported the flood ("N hours ago", 0 = now) and how long the report stays live
  // ('' = default by severity, else minutes). Both anchor the client-side TTL countdown.
  const [reportedHoursAgo, setReportedHoursAgo] = React.useState('0');
  const [ttl, setTtl] = React.useState('');

  const [photo, setPhoto] = React.useState<string | null>(null);
  const [photoBusy, setPhotoBusy] = React.useState(false);
  const [photoError, setPhotoError] = React.useState<string | null>(null);
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const onPickPlace = (la: number, ln: number, label: string): void => {
    setLat(String(la));
    setLng(String(ln));
    setPlaceLabel(label);
    // Seed name/district from the picked label, then refine with a reverse-geocode.
    const firstSeg = label.split(',')[0]?.trim();
    if (firstSeg) setName((n) => n || firstSeg);
    void reverseGeocode(la, ln).then((g) => {
      const street = g.road ?? g.barangay ?? firstSeg ?? '';
      if (street) setName(street);
      if (g.district) setDistrict(g.district);
    });
  };

  const chooseSeverity = (s: Severity): void => {
    setSeverity(s);
    setDepth(SEVERITY_PRESET[s].depthCm);
  };

  const onPickPhoto = async (e: React.ChangeEvent<HTMLInputElement>): Promise<void> => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setPhotoError(null);
    setPhotoBusy(true);
    try {
      setPhoto(await fileToCompressedDataUrl(file));
    } catch (err) {
      setPhotoError(err instanceof Error ? err.message : 'Could not add that screenshot.');
      setPhoto(null);
    } finally {
      setPhotoBusy(false);
    }
  };

  const hasCoords = lat !== '' && lng !== '';
  const canPost = hasCoords && name.trim() !== '' && !busy && !photoBusy;

  const submit = async (): Promise<void> => {
    if (!canPost) {
      if (!hasCoords) setError('Search and select a location.');
      else if (name.trim() === '') setError('Give the incident a name.');
      return;
    }
    const preset = SEVERITY_PRESET[severity];
    const label = note.trim() ? `${name.trim()} (${note.trim()})` : name.trim();
    // Convert "N hours ago" to an absolute report time; a chosen TTL preset overrides the default.
    const hoursAgo = Math.max(0, Number(reportedHoursAgo) || 0);
    const ttlMinutes = ttl ? Number(ttl) : undefined;
    const payload: NewReport = {
      name: label,
      district: district.trim() || 'Unknown area',
      latitude: Number(lat),
      longitude: Number(lng),
      severity,
      depthCm: depth,
      trend: preset.trend,
      road: preset.road,
      photoDataUrl: photo ?? undefined,
      reportedAt: new Date(Date.now() - hoursAgo * 3600_000).toISOString(),
      ttlMinutes,
    };
    setBusy(true);
    setError(null);
    try {
      await onSubmit(payload);
      onClose();
    } catch {
      setError('Could not post the incident. Please try again.');
    } finally {
      setBusy(false);
    }
  };

  const range = DEPTH_RANGE[severity];

  const card = (
    <div
      onClick={(e) => e.stopPropagation()}
      style={{ width: 460, maxWidth: '100%', maxHeight: '90vh', display: 'flex', flexDirection: 'column', background: '#fff', borderRadius: isMobile ? '20px 20px 0 0' : 20, boxShadow: '0 24px 70px rgba(15,23,42,.4)', overflow: 'hidden', animation: isMobile ? 'sheetUp .22s ease-out' : 'popIn .16s ease-out' }}
    >
      {/* Header */}
      <div style={{ background: 'linear-gradient(135deg,#4F46E5,#4338CA)', padding: '16px 20px', color: '#fff', display: 'flex', alignItems: 'center', gap: 12 }}>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 16, fontWeight: 800 }}>🗞 Report a flood incident</div>
          <div style={{ fontSize: 12, opacity: 0.9 }}>Log a flood from news or other sources — posts as a system report.</div>
        </div>
        <button onClick={onClose} style={{ border: 0, background: 'rgba(255,255,255,.18)', color: '#fff', width: 28, height: 28, borderRadius: 8, fontSize: 16, cursor: 'pointer', flex: 'none' }}>×</button>
      </div>

      {/* Body */}
      <div style={{ padding: '15px 20px', overflowY: 'auto', flex: 1, display: 'flex', flexDirection: 'column', gap: 12 }}>
        {error && (
          <div style={{ background: '#FEF2F2', color: '#B91C1C', padding: '8px 11px', borderRadius: 9, fontSize: 12.5, fontWeight: 600 }}>{error}</div>
        )}

        <div>
          <label style={labelStyle}>Location</label>
          <PlaceField lat={lat} lng={lng} placeLabel={placeLabel} onPick={onPickPlace} />
        </div>

        <div>
          <label style={labelStyle}>Name / place</label>
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Marikina Bridge" style={inputStyle} />
        </div>

        <div>
          <label style={labelStyle}>District</label>
          <input value={district} onChange={(e) => setDistrict(e.target.value)} placeholder="Auto-filled from the location" style={inputStyle} />
        </div>

        <div>
          <label style={labelStyle}>Severity</label>
          <div style={{ display: 'flex', gap: 7 }}>
            {SEV_ORDER.map((s) => {
              const active = severity === s;
              const m = SEV_META[s];
              return (
                <button
                  key={s}
                  type="button"
                  onClick={() => chooseSeverity(s)}
                  style={{ flex: 1, padding: '9px 8px', borderRadius: 10, cursor: 'pointer', border: `1.5px solid ${active ? m.color : '#E2E8F0'}`, background: active ? m.soft : '#fff', color: active ? m.color : 'var(--bw-ink)', fontSize: 12.5, fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}
                >
                  <span style={{ width: 9, height: 9, borderRadius: '50%', background: m.color, flex: 'none' }} />
                  {m.label}
                </button>
              );
            })}
          </div>
        </div>

        <div>
          <label style={labelStyle}>Water depth — {depth} cm</label>
          <input
            type="range"
            min={range.min}
            max={range.max}
            step={range.step}
            value={depth}
            onChange={(e) => setDepth(Number(e.target.value))}
            style={{ width: '100%', accentColor: SEV_META[severity].color }}
          />
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10.5, color: 'var(--bw-faint)', fontWeight: 600 }}>
            <span>{range.min} cm</span>
            <span>{range.max} cm</span>
          </div>
          <div style={{ marginTop: 9 }}>
            <DepthReference depthCm={depth} color={SEV_META[severity].color} />
          </div>
        </div>

        <div>
          <label style={labelStyle}>Screenshot <span style={{ fontWeight: 600 }}>(optional)</span></label>
          <input ref={fileInputRef} type="file" accept="image/*" onChange={(e) => void onPickPhoto(e)} style={{ display: 'none' }} />
          {photo ? (
            <div style={{ position: 'relative', borderRadius: 10, overflow: 'hidden', border: '1px solid var(--bw-line)' }}>
              <img src={photo} alt="Incident screenshot preview" style={{ width: '100%', maxHeight: 160, objectFit: 'cover', display: 'block' }} />
              <button type="button" onClick={() => { setPhoto(null); setPhotoError(null); }} style={{ position: 'absolute', top: 6, right: 6, border: 0, background: 'rgba(15,23,42,.62)', color: '#fff', borderRadius: 8, padding: '4px 9px', fontSize: 11, fontWeight: 800, cursor: 'pointer' }}>Remove</button>
            </div>
          ) : (
            <button type="button" disabled={photoBusy} onClick={() => fileInputRef.current?.click()} style={{ width: '100%', padding: 11, border: '1.5px dashed #CBD5E1', borderRadius: 10, background: '#F8FAFC', color: 'var(--bw-ink-soft)', fontSize: 12.5, fontWeight: 800, cursor: photoBusy ? 'wait' : 'pointer' }}>
              {photoBusy ? 'Processing screenshot…' : '📷 Attach a screenshot'}
            </button>
          )}
          {photoError && <div style={{ fontSize: 10.5, color: 'var(--bw-danger)', fontWeight: 600, marginTop: 4 }}>{photoError}</div>}
        </div>

        <div>
          <label style={labelStyle}>Source / note <span style={{ fontWeight: 600 }}>(optional)</span></label>
          <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="e.g. via DZMM report" style={inputStyle} />
        </div>

        <div style={{ display: 'flex', gap: 11 }}>
          <div style={{ flex: 1 }}>
            <label style={labelStyle}>Reported how long ago?</label>
            <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
              <input
                type="number"
                min={0}
                value={reportedHoursAgo}
                onChange={(e) => setReportedHoursAgo(e.target.value)}
                style={{ ...inputStyle, width: 80 }}
              />
              <span style={{ fontSize: 12.5, color: 'var(--bw-muted)', fontWeight: 600 }}>hours ago</span>
            </div>
            <div style={{ fontSize: 10.5, color: 'var(--bw-faint)', fontWeight: 600, marginTop: 4 }}>0 = just now. The countdown runs from here.</div>
          </div>
          <div style={{ flex: 1 }}>
            <label style={labelStyle}>Keep live for</label>
            <select value={ttl} onChange={(e) => setTtl(e.target.value)} style={inputStyle}>
              {TTL_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </div>
        </div>
      </div>

      {/* Footer */}
      <div style={{ padding: '12px 20px', borderTop: '1px solid var(--bw-line-soft)' }}>
        <button
          onClick={() => void submit()}
          disabled={!canPost}
          style={{ width: '100%', border: 0, background: '#4338CA', color: '#fff', padding: 12, borderRadius: 11, fontSize: 13.5, fontWeight: 800, cursor: canPost ? 'pointer' : 'not-allowed', opacity: canPost ? 1 : 0.6 }}
        >
          {busy ? 'Posting…' : photoBusy ? 'Processing screenshot…' : 'Post system report'}
        </button>
      </div>
    </div>
  );

  return (
    <div
      onClick={onClose}
      style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,.55)', backdropFilter: 'blur(3px)', zIndex: 1200, display: 'flex', alignItems: isMobile ? 'flex-end' : 'center', justifyContent: 'center', padding: isMobile ? 0 : 18 }}
    >
      {card}
    </div>
  );
};

export default AdminReportIncidentModal;
