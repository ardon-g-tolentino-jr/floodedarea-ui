import React from 'react';
import type { Feedback } from '../../types';

interface CommunityFeedbackModalProps {
  isMobile: boolean;
  /** Accepted feedback (bugs + features), already ordered by upvotes desc. */
  items: Feedback[];
  loading: boolean;
  /** Toggle the caller's upvote on an item. */
  onUpvote: (id: number) => void;
  /** Open the submission form (suggest a feature / report a bug). */
  onSuggest: () => void;
  onClose: () => void;
}

/** Public board of community feedback an admin has accepted. Anyone — including no-login guests —
 *  can upvote items to surface what matters, and open the submission form to add their own.
 *  Opened from the TopBar menu (and the Features modal). */
const CommunityFeedbackModal: React.FC<CommunityFeedbackModalProps> = ({ isMobile, items, loading, onUpvote, onSuggest, onClose }) => (
  <div
    onClick={onClose}
    style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,.55)', backdropFilter: 'blur(3px)', zIndex: 1320, display: 'flex', alignItems: isMobile ? 'flex-end' : 'center', justifyContent: 'center', padding: isMobile ? 0 : 18 }}
  >
    <div
      onClick={(e) => e.stopPropagation()}
      style={
        isMobile
          ? { width: '100%', maxHeight: '90vh', display: 'flex', flexDirection: 'column', background: '#fff', borderRadius: '20px 20px 0 0', boxShadow: '0 -10px 40px rgba(15,23,42,.35)', animation: 'sheetUp .22s ease-out' }
          : { width: 460, maxWidth: '100%', maxHeight: '92vh', display: 'flex', flexDirection: 'column', background: '#fff', borderRadius: 20, boxShadow: '0 24px 70px rgba(15,23,42,.4)', animation: 'popIn .16s ease-out' }
      }
    >
      {/* Header */}
      <div style={{ background: 'linear-gradient(150deg,#0EA5E9,#0369A1)', padding: '20px 22px', color: '#fff', display: 'flex', alignItems: 'center', gap: 12, flex: 'none' }}>
        <div style={{ width: 40, height: 40, borderRadius: 12, background: 'rgba(255,255,255,.18)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, flex: 'none' }}>💬</div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 'clamp(16px, 4.5vw, 18px)', fontWeight: 800, lineHeight: 1.25 }}>Community feedback</div>
          <div style={{ fontSize: 12, opacity: 0.9 }}>Ideas and fixes the community wants most</div>
        </div>
        <button onClick={onClose} aria-label="Close" style={{ border: 0, background: 'rgba(255,255,255,.18)', color: '#fff', width: 28, height: 28, borderRadius: 8, fontSize: 17, cursor: 'pointer', flex: 'none' }}>×</button>
      </div>

      <div style={{ padding: 'clamp(16px, 4vw, 18px) clamp(16px, 5vw, 22px)', overflowY: 'auto', flex: 1 }}>
        <button
          onClick={onSuggest}
          style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, border: 0, background: 'var(--bw-primary)', color: '#fff', padding: 13, borderRadius: 13, fontSize: 14, fontWeight: 800, cursor: 'pointer', boxShadow: '0 6px 16px rgba(14,165,233,.3)' }}
        >
          💡 Suggest a feature / report a bug
        </button>

        <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: '.1em', textTransform: 'uppercase', color: 'var(--bw-faint)', margin: '18px 0 8px' }}>
          Top requests
        </div>

        {loading && items.length === 0 ? (
          <div style={{ fontSize: 12.5, color: 'var(--bw-muted)', textAlign: 'center', padding: 16 }}>Loading…</div>
        ) : items.length === 0 ? (
          <div style={{ padding: '13px 14px', background: 'var(--bw-bg-subtle)', borderRadius: 11, fontSize: 12.5, lineHeight: 1.5, color: 'var(--bw-muted)' }}>
            No community requests yet — be the first to suggest one. Once an admin accepts it, it shows up here for everyone to upvote.
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {items.map((f) => {
              const isFeature = f.type === 'feature';
              const voted = f.upvotedByMe;
              return (
                <div key={f.id} style={{ display: 'flex', gap: 11, alignItems: 'flex-start', padding: '11px 12px', background: '#F7FAFB', border: '1px solid var(--bw-line-soft)', borderRadius: 12 }}>
                  {/* Upvote pill */}
                  <button
                    onClick={() => onUpvote(f.id)}
                    aria-pressed={voted}
                    aria-label={voted ? 'Remove your upvote' : 'Upvote'}
                    style={{
                      flex: 'none', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 1,
                      width: 46, padding: '7px 0', borderRadius: 11, cursor: 'pointer',
                      border: `1px solid ${voted ? '#BAE2FB' : 'var(--bw-line)'}`,
                      background: voted ? '#EFF8FF' : '#fff',
                      color: voted ? 'var(--bw-primary)' : 'var(--bw-ink-soft)',
                    }}
                  >
                    <span style={{ fontSize: 13, lineHeight: 1 }}>▲</span>
                    <span style={{ fontSize: 13, fontWeight: 800, lineHeight: 1.1 }}>{f.upvotes}</span>
                  </button>

                  <div style={{ minWidth: 0, flex: 1 }}>
                    <span style={{ display: 'inline-block', fontSize: 11, fontWeight: 800, padding: '2px 8px', borderRadius: 999, marginBottom: 4, background: isFeature ? '#EFF8FF' : '#FEF2F2', color: isFeature ? 'var(--bw-primary)' : '#DC2626' }}>
                      {isFeature ? '💡 Feature' : '🐞 Bug'}
                    </span>
                    <div style={{ fontSize: 13.5, fontWeight: 800, color: 'var(--bw-ink)' }}>{f.title}</div>
                    {f.details && <div style={{ fontSize: 12, lineHeight: 1.45, color: 'var(--bw-muted)', marginTop: 2 }}>{f.details}</div>}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        <div style={{ marginTop: 12, textAlign: 'center', fontSize: 11, color: 'var(--bw-faint)', lineHeight: 1.4 }}>
          Anyone can suggest and upvote — no account needed.
        </div>
      </div>
    </div>
  </div>
);

export default CommunityFeedbackModal;
