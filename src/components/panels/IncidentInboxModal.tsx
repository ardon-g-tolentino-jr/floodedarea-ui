import React from 'react';
import type { DraftIncident } from '../../types';
import { SEV_META } from '../../utils/floodMeta';
import { timeAgo } from '../../utils/format';

/**
 * Admin-only "Incident inbox" — the review queue for flood incidents the backend drafted from news.
 * Each draft is a proposed system report the admin can Approve (post as-is), Edit & approve (open the
 * report form pre-filled), or Dismiss. Nothing reaches the public map without this human gate.
 * Presentational: the parent (App.tsx) owns the data and the mutations, mirroring the feedback queue.
 */
interface Props {
  isMobile: boolean;
  incidents: DraftIncident[];
  loading: boolean;
  /** Post the draft as a system report using its extracted values as-is. */
  onApprove: (id: number) => Promise<void>;
  /** Open the report form pre-filled from this draft to edit before approving. */
  onEdit: (incident: DraftIncident) => void;
  /** Drop the draft without creating a report. */
  onDismiss: (id: number) => Promise<void>;
  onClose: () => void;
}

/** Below this extraction confidence a draft is flagged as needing a closer look before approving. */
const LOW_CONFIDENCE = 0.6;

const IncidentInboxModal: React.FC<Props> = ({ isMobile, incidents, loading, onApprove, onEdit, onDismiss, onClose }) => {
  // Which row has a mutation in flight (disables its buttons); null when idle.
  const [busyId, setBusyId] = React.useState<number | null>(null);

  const run = async (id: number, fn: (id: number) => Promise<void>): Promise<void> => {
    setBusyId(id);
    try {
      await fn(id);
    } finally {
      setBusyId(null);
    }
  };

  const row = (inc: DraftIncident): React.ReactNode => {
    const m = SEV_META[inc.severity];
    const where = inc.district ? `${inc.name} · ${inc.district}` : inc.name;
    const lowConfidence = inc.confidence < LOW_CONFIDENCE;
    const busy = busyId === inc.id;
    return (
      <div key={inc.id} style={{ border: '1px solid var(--bw-line)', borderRadius: 12, padding: 13, display: 'flex', flexDirection: 'column', gap: 9 }}>
        {/* Severity chip + when + low-confidence flag */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '3px 8px', borderRadius: 999, background: m.soft, color: m.color, fontSize: 11, fontWeight: 800 }}>
            <span style={{ width: 8, height: 8, borderRadius: '50%', background: m.color }} />
            {m.label} · {inc.depthCm} cm
          </span>
          <span style={{ fontSize: 11, color: 'var(--bw-faint)', fontWeight: 600 }}>{timeAgo(inc.publishedAt)}</span>
          {lowConfidence && (
            <span title="Low extraction confidence — check the details before approving." style={{ padding: '3px 8px', borderRadius: 999, background: '#FEF3C7', color: '#B45309', fontSize: 10.5, fontWeight: 800 }}>
              ⚠ Needs a look
            </span>
          )}
        </div>

        {/* Place */}
        <div style={{ fontSize: 13.5, fontWeight: 800, color: 'var(--bw-ink)' }}>{where}</div>

        {/* Headline + source */}
        <div style={{ fontSize: 12, color: 'var(--bw-muted)', lineHeight: 1.4 }}>{inc.headline}</div>
        <a href={inc.sourceUrl} target="_blank" rel="noopener noreferrer" style={{ fontSize: 11.5, fontWeight: 700, color: '#4338CA', textDecoration: 'none' }}>
          {inc.sourceName} ↗
        </a>

        {/* Actions */}
        <div style={{ display: 'flex', gap: 7, marginTop: 2 }}>
          <button
            type="button"
            disabled={busy}
            onClick={() => void run(inc.id, onApprove)}
            style={{ flex: 1, border: 0, background: '#4338CA', color: '#fff', padding: '8px 10px', borderRadius: 9, fontSize: 12, fontWeight: 800, cursor: busy ? 'wait' : 'pointer', opacity: busy ? 0.6 : 1 }}
          >
            {busy ? '…' : 'Approve'}
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => onEdit(inc)}
            style={{ flex: 1, border: '1.5px solid #C7D2FE', background: '#EEF2FF', color: '#4338CA', padding: '8px 10px', borderRadius: 9, fontSize: 12, fontWeight: 800, cursor: busy ? 'not-allowed' : 'pointer', opacity: busy ? 0.6 : 1 }}
          >
            Edit &amp; approve
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => void run(inc.id, onDismiss)}
            style={{ border: '1.5px solid var(--bw-line)', background: '#fff', color: 'var(--bw-muted)', padding: '8px 12px', borderRadius: 9, fontSize: 12, fontWeight: 800, cursor: busy ? 'not-allowed' : 'pointer', opacity: busy ? 0.6 : 1 }}
          >
            Dismiss
          </button>
        </div>
      </div>
    );
  };

  const card = (
    <div
      onClick={(e) => e.stopPropagation()}
      style={{ width: 460, maxWidth: '100%', maxHeight: '90vh', display: 'flex', flexDirection: 'column', background: '#fff', borderRadius: isMobile ? '20px 20px 0 0' : 20, boxShadow: '0 24px 70px rgba(15,23,42,.4)', overflow: 'hidden', animation: isMobile ? 'sheetUp .22s ease-out' : 'popIn .16s ease-out' }}
    >
      {/* Header */}
      <div style={{ background: 'linear-gradient(135deg,#4F46E5,#4338CA)', padding: '16px 20px', color: '#fff', display: 'flex', alignItems: 'center', gap: 12 }}>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 16, fontWeight: 800 }}>🗞 Incident inbox</div>
          <div style={{ fontSize: 12, opacity: 0.9 }}>Flood incidents drafted from news — review, then post as system reports.</div>
        </div>
        <button onClick={onClose} style={{ border: 0, background: 'rgba(255,255,255,.18)', color: '#fff', width: 28, height: 28, borderRadius: 8, fontSize: 16, cursor: 'pointer', flex: 'none' }}>×</button>
      </div>

      {/* Body */}
      <div style={{ padding: '15px 20px', overflowY: 'auto', flex: 1, display: 'flex', flexDirection: 'column', gap: 11 }}>
        {loading && incidents.length === 0 ? (
          <div style={{ textAlign: 'center', color: 'var(--bw-muted)', fontSize: 13, fontWeight: 600, padding: '28px 0' }}>Loading…</div>
        ) : incidents.length === 0 ? (
          <div style={{ textAlign: 'center', color: 'var(--bw-muted)', fontSize: 13, fontWeight: 600, padding: '28px 0' }}>
            No incidents to review right now.
            <div style={{ fontSize: 11.5, color: 'var(--bw-faint)', marginTop: 6 }}>New flood stories from the news will show up here for review.</div>
          </div>
        ) : (
          incidents.map(row)
        )}
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

export default IncidentInboxModal;
