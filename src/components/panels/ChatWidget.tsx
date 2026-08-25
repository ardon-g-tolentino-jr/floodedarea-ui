import React from 'react';

/**
 * Floating community-chat bubble. Embeds a free, anonymous tlk.io room — no backend, no
 * database, no domain types (see PLAYSTORE_PACKAGE.md for the Play-store UGC follow-ups).
 *
 * Self-contained: it owns its own open/mounted state (like TopBar's `menuOpen`), so App.tsx
 * just renders it once. The room iframe is mounted lazily on first open and then kept mounted
 * (the panel is hidden via `display`, not unmounted) so the conversation survives a collapse
 * without reconnecting.
 *
 * We embed the room URL directly rather than tlk.io's `embed.js`: that script auto-scans for
 * its container on `DOMContentLoaded`, which has already fired in this single-page app, so it
 * never renders. A direct iframe is deterministic and tlk.io allows framing.
 */

// Public tlk.io channel — not a secret. Change here to rename/relocate the room.
const TLKIO_CHANNEL = 'floodedarea';
const TLKIO_URL = `https://tlk.io/${TLKIO_CHANNEL}`;

interface ChatWidgetProps {
  isMobile: boolean;
}

const ChatWidget: React.FC<ChatWidgetProps> = ({ isMobile }) => {
  const [expanded, setExpanded] = React.useState(false);
  const [mounted, setMounted] = React.useState(false); // true after the first open

  const open = (): void => {
    setMounted(true);
    setExpanded(true);
  };
  const close = (): void => setExpanded(false);

  const panelStyle: React.CSSProperties = isMobile
    ? {
        position: 'fixed',
        left: 0,
        right: 0,
        bottom: 0,
        height: '80vh',
        display: expanded ? 'flex' : 'none',
        flexDirection: 'column',
        background: 'var(--bw-surface)',
        borderRadius: '20px 20px 0 0',
        boxShadow: '0 -10px 40px rgba(15,23,42,.35)',
        zIndex: 1150,
        animation: 'sheetUp .22s ease-out',
        overflow: 'hidden',
      }
    : {
        position: 'fixed',
        right: 24,
        bottom: 24,
        width: 360,
        height: 520,
        maxHeight: 'calc(100vh - 48px)',
        display: expanded ? 'flex' : 'none',
        flexDirection: 'column',
        background: 'var(--bw-surface)',
        borderRadius: 18,
        boxShadow: '0 24px 70px rgba(15,23,42,.4)',
        zIndex: 1150,
        animation: 'popIn .16s ease-out',
        overflow: 'hidden',
      };

  return (
    <>
      {/* Floating bubble — hidden while the panel is open */}
      {!expanded && (
        <button
          onClick={open}
          aria-label="Open community chat"
          style={{
            position: 'fixed',
            right: isMobile ? 16 : 24,
            bottom: isMobile ? 84 : 24,
            height: 54,
            padding: '0 20px 0 16px',
            border: 0,
            borderRadius: 27,
            background: 'linear-gradient(150deg,var(--bw-primary),var(--bw-primary-deep))',
            color: 'var(--bw-on-accent)',
            fontSize: 15,
            fontWeight: 800,
            cursor: 'pointer',
            boxShadow: '0 10px 26px rgba(3,105,161,.5)',
            display: 'flex',
            alignItems: 'center',
            gap: 9,
            zIndex: 1100,
          }}
        >
          <span style={{ fontSize: 22, lineHeight: 1 }}>💬</span>
          <span>Chat</span>
        </button>
      )}

      {/* Mobile-only dimmer behind the bottom sheet (tap to close) */}
      {isMobile && expanded && (
        <div
          onClick={close}
          style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,.45)', zIndex: 1149 }}
        />
      )}

      {/* Chat panel — rendered after first open, then kept mounted (hidden via `display`) */}
      {mounted && (
        <div style={panelStyle}>
          <div
            style={{
              flex: 'none',
              display: 'flex',
              alignItems: 'center',
              gap: 11,
              padding: '13px 16px',
              background: 'linear-gradient(150deg,var(--bw-primary),var(--bw-primary-deep))',
              color: 'var(--bw-on-accent)',
            }}
          >
            <div
              style={{
                width: 34,
                height: 34,
                flex: 'none',
                borderRadius: 10,
                background: 'rgba(255,255,255,.18)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 18,
              }}
            >
              💬
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 15, fontWeight: 800, lineHeight: 1.2 }}>Community Chat</div>
              <div style={{ fontSize: 11.5, opacity: 0.9 }}>
                Talk with nearby flood-watchers · be kind &amp; stay safe
              </div>
            </div>
            <button
              onClick={close}
              aria-label="Close chat"
              style={{
                flex: 'none',
                border: 0,
                background: 'rgba(255,255,255,.18)',
                color: 'var(--bw-on-accent)',
                width: 28,
                height: 28,
                borderRadius: 8,
                fontSize: 17,
                lineHeight: 1,
                cursor: 'pointer',
              }}
            >
              ×
            </button>
          </div>

          <iframe
            src={TLKIO_URL}
            title="FloodedArea community chat"
            style={{ flex: 1, minHeight: 0, width: '100%', border: 0, background: 'var(--bw-bg-subtle)' }}
          />
        </div>
      )}
    </>
  );
};

export default ChatWidget;
