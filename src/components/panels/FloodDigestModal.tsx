import React from 'react';
import type { FloodDigest } from '../../utils/share';
import { FB_GLYPH_PATH, X_LIMIT } from '../../utils/share';

interface FloodDigestModalProps {
  digest: FloodDigest;
  isMobile: boolean;
  /** Copies the (possibly admin-edited) full text to the clipboard, then opens the Facebook
   *  composer — Facebook's sharer takes a URL only, so the text has to be pasted by hand. */
  onFacebook: (text: string) => void;
  /** Opens X's intent/tweet prefilled with `body` — X accepts prefilled text, so this is one click. */
  onX: (body: string) => void;
  /** Copies the X-sized variant (link inline) for pasting into X's composer by hand — the only
   *  route that can carry an image attachment, which intent/tweet cannot. */
  onCopyX: (text: string) => void;
  onCopy: (text: string) => void;
  onClose: () => void;
}

/**
 * Admin-only "Post flood digest" dialog — the situational-roundup counterpart to the per-report
 * ShareModal. Seeds an editable textarea from the composed digest (so the admin can tweak wording
 * before posting) and a read-only preview of the X-sized variant with a live char counter.
 * Structural template matches ShareModal.tsx: bottom sheet on mobile, centered card on desktop.
 */
const FloodDigestModal: React.FC<FloodDigestModalProps> = ({ digest, isMobile, onFacebook, onX, onCopyX, onCopy, onClose }) => {
  // Local, editable copy of the composed text — the callbacks send THIS, not digest.text, so an
  // admin's tweak actually ships.
  const [text, setText] = React.useState(digest.text);
  // The digest recomposes every 15s as reports age in and out, so an untouched textarea follows
  // those updates and never posts a stale timestamp. The moment the admin types, we stop syncing —
  // a background refresh eating someone's edit mid-sentence would be far worse than a stale minute.
  const edited = React.useRef(false);
  React.useEffect(() => {
    if (!edited.current) setText(digest.text);
  }, [digest.text]);
  const empty = digest.reportCount === 0;
  const overBudget = digest.xCharCount > X_LIMIT;

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
            : { width: 460, maxWidth: '100%', maxHeight: '92vh', overflowY: 'auto', background: '#fff', borderRadius: 20, boxShadow: '0 24px 70px rgba(15,23,42,.4)', animation: 'popIn .16s ease-out' }
        }
      >
        {/* Header */}
        <div style={{ background: 'linear-gradient(150deg,#0EA5E9,#0369A1)', padding: '20px 22px', color: '#fff', display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ width: 40, height: 40, borderRadius: 12, background: 'rgba(255,255,255,.18)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, flex: 'none' }}>📣</div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 'clamp(16px, 4.5vw, 18px)', fontWeight: 800, lineHeight: 1.25 }}>Post flood digest</div>
            <div style={{ fontSize: 12, opacity: 0.9 }}>
              {empty ? 'No active flood reports right now.' : `${digest.reportCount} active report${digest.reportCount === 1 ? '' : 's'} across ${digest.cityCount} ${digest.cityCount === 1 ? 'city' : 'cities'}`}
            </div>
          </div>
          <button onClick={onClose} aria-label="Close" style={{ border: 0, background: 'rgba(255,255,255,.18)', color: '#fff', width: 28, height: 28, borderRadius: 8, fontSize: 17, cursor: 'pointer', flex: 'none' }}>×</button>
        </div>

        <div style={{ padding: 'clamp(16px, 4vw, 18px) clamp(16px, 5vw, 22px) clamp(18px, 5vw, 22px)', display: 'flex', flexDirection: 'column', gap: 12 }}>
          {empty ? (
            <div style={{ padding: '13px 14px', background: 'var(--bw-bg-subtle)', border: '1px solid var(--bw-line)', borderRadius: 12, fontSize: 13, color: 'var(--bw-muted)', textAlign: 'center' }}>
              No active flood reports right now.
            </div>
          ) : (
            <>
              <div>
                <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--bw-muted)', marginBottom: 4, display: 'block' }}>
                  Facebook / clipboard text — edit before posting
                </label>
                <textarea
                  value={text}
                  onChange={(e) => { edited.current = true; setText(e.target.value); }}
                  rows={10}
                  style={{ width: '100%', padding: '10px 12px', border: '1px solid var(--bw-line)', borderRadius: 10, fontSize: 12.5, lineHeight: 1.5, color: 'var(--bw-ink)', background: '#fff', boxSizing: 'border-box', resize: 'vertical', fontFamily: 'inherit', whiteSpace: 'pre-wrap' }}
                />
              </div>

              <div>
                <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--bw-muted)', marginBottom: 4, display: 'block' }}>
                  X post — 280 chars incl. link
                </label>
                <div style={{ padding: '9px 10px', background: '#F7FAFB', border: '1px solid var(--bw-line-soft)', borderRadius: 9 }}>
                  {/* Shows the link-inline variant so the preview is literally what both X paths
                      produce — the one-click intent appends the same link via its `url` param. */}
                  <div style={{ fontSize: 11.5, color: 'var(--bw-ink-soft)', whiteSpace: 'pre-wrap', lineHeight: 1.4 }}>{digest.xCopyText}</div>
                  <div style={{ marginTop: 6, fontSize: 10.5, fontWeight: 700, color: overBudget ? 'var(--bw-danger)' : 'var(--bw-faint)' }}>
                    {digest.xCharCount}/{X_LIMIT} on X
                  </div>
                </div>
              </div>
            </>
          )}

          <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
            <button
              onClick={() => onFacebook(text)}
              disabled={empty}
              style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 9, border: 0, background: empty ? '#94A3B8' : '#1877F2', color: '#fff', padding: 13, borderRadius: 12, fontSize: 13.5, fontWeight: 800, cursor: empty ? 'not-allowed' : 'pointer' }}
            >
              <svg viewBox="0 0 24 24" width={16} height={16} fill="#fff"><path d={FB_GLYPH_PATH} /></svg>
              Copy &amp; open Facebook
            </button>
            <div style={{ fontSize: 10.5, color: 'var(--bw-faint)', textAlign: 'center', marginTop: -4 }}>
              Facebook doesn't accept prefilled text — the digest is copied for you to paste (⌘V / Ctrl+V) into the composer.
            </div>

            {/* One-click path sends xBody (no URL) — intent/tweet appends the link itself via its
                `url` param, so sending xCopyText here would post the link twice. */}
            <button
              onClick={() => onX(digest.xBody)}
              disabled={empty || overBudget}
              style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 9, border: 0, background: empty || overBudget ? '#94A3B8' : '#000', color: '#fff', padding: 13, borderRadius: 12, fontSize: 13.5, fontWeight: 800, cursor: empty || overBudget ? 'not-allowed' : 'pointer' }}
            >
              𝕏 Post to X
            </button>

            <button
              onClick={() => onCopyX(digest.xCopyText)}
              disabled={empty || overBudget}
              style={{ border: '1px solid var(--bw-line)', background: '#fff', color: 'var(--bw-ink)', padding: 12, borderRadius: 12, fontSize: 13.5, fontWeight: 800, cursor: empty || overBudget ? 'not-allowed' : 'pointer', opacity: empty || overBudget ? 0.6 : 1 }}
            >
              Copy X post
            </button>
            <div style={{ fontSize: 10.5, color: 'var(--bw-faint)', textAlign: 'center', marginTop: -4 }}>
              Paste it into X's composer if you want to attach the flood alert image — the one-click post can't carry one.
            </div>

            <button
              onClick={() => onCopy(text)}
              disabled={empty}
              style={{ border: '1px solid var(--bw-line)', background: '#fff', color: 'var(--bw-ink)', padding: 12, borderRadius: 12, fontSize: 13.5, fontWeight: 800, cursor: empty ? 'not-allowed' : 'pointer', opacity: empty ? 0.6 : 1 }}
            >
              Copy text
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default FloodDigestModal;
