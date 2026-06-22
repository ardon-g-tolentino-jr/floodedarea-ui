import React from 'react';
import type { AuthState } from '../../hooks/useAuth';
import type { GeoResult } from '../../api/geocode';
import { BUILD_COMMIT, BUILD_LABEL, BUILD_TIME } from '../../buildInfo';
import SearchBox from './SearchBox';

interface TopBarProps {
  regionLabel: string;
  isMobile: boolean;
  auth: AuthState | null;
  onReport: () => void;
  onShare: () => void;
  onSOS: () => void;
  onSignIn: () => void;
  onSignOut: () => void;
  onSearchSelect: (r: GeoResult) => void;
  onNotify: () => void;
  notifyOn: boolean;
  onWaterChart: () => void;
  onRescueChart: () => void;
  onSupport: () => void;
  isAdmin: boolean;
  onAdmin: () => void;
  onResponse: () => void;
}

/** Shared style for the square 40×40 icon buttons in the action row. */
const ICON_BTN: React.CSSProperties = {
  width: 40,
  height: 40,
  flex: 'none',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  border: '1px solid #DCE3E9',
  background: '#fff',
  borderRadius: 11,
  fontSize: 16,
  cursor: 'pointer',
};

/** A row in the mobile "More" overflow menu. */
const MenuItem: React.FC<{ icon: string; label: string; onClick: () => void }> = ({ icon, label, onClick }) => (
  <button
    onClick={onClick}
    style={{ display: 'flex', alignItems: 'center', gap: 11, width: '100%', textAlign: 'left', padding: '10px 12px', border: 0, background: 'transparent', borderRadius: 9, cursor: 'pointer', fontSize: 13.5, fontWeight: 700, color: 'var(--bw-ink)' }}
  >
    <span style={{ fontSize: 16, width: 22, textAlign: 'center', flex: 'none' }}>{icon}</span>
    {label}
  </button>
);

const TopBar: React.FC<TopBarProps> = ({
  regionLabel,
  isMobile,
  auth,
  onReport,
  onShare,
  onSOS,
  onSignIn,
  onSignOut,
  onSearchSelect,
  onNotify,
  notifyOn,
  onWaterChart,
  onRescueChart,
  onSupport,
  isAdmin,
  onAdmin,
  onResponse,
}) => {
  const initials = auth ? auth.name.trim().charAt(0).toUpperCase() || '?' : '';

  // On mobile the secondary actions collapse into this overflow menu so the bar fits any viewport.
  const [menuOpen, setMenuOpen] = React.useState(false);
  const menuRef = React.useRef<HTMLDivElement>(null);
  React.useEffect(() => {
    if (!menuOpen) return;
    const onDocClick = (e: MouseEvent): void => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false);
    };
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, [menuOpen]);
  const runAndClose = (fn: () => void) => (): void => { setMenuOpen(false); fn(); };

  // Notify, SOS and the auth control stay visible at every width; share/charts/support fold into
  // the overflow menu on mobile and sit inline on desktop.
  const notifyBtn = (
    <button
      onClick={onNotify}
      title="Flood alerts"
      aria-label="Flood alerts"
      style={{ ...ICON_BTN, position: 'relative', border: `1px solid ${notifyOn ? '#BAE2FB' : '#DCE3E9'}`, background: notifyOn ? '#EFF8FF' : '#fff' }}
    >
      🔔
      {notifyOn && (
        <span style={{ position: 'absolute', top: 7, right: 8, width: 8, height: 8, borderRadius: '50%', background: 'var(--bw-primary)', border: '2px solid #fff' }} />
      )}
    </button>
  );

  const sosBtn = (
    <button
      onClick={onSOS}
      style={{ display: 'flex', alignItems: 'center', flex: 'none', height: 40, padding: '0 16px', border: 0, background: 'var(--bw-danger)', borderRadius: 11, fontSize: 13, fontWeight: 800, color: '#fff', cursor: 'pointer', boxShadow: '0 4px 12px rgba(239,68,68,.32)' }}
    >
      SOS
    </button>
  );

  const adminBtn = isAdmin ? (
    <button
      onClick={onAdmin}
      title="Admin console"
      style={{ display: 'flex', alignItems: 'center', flex: 'none', gap: 6, height: 40, padding: '0 14px', border: '1px solid #BAE2FB', background: '#EFF8FF', borderRadius: 11, fontSize: 13, fontWeight: 800, color: 'var(--bw-primary)', cursor: 'pointer' }}
    >
      ⚙ {!isMobile && 'Admin'}
    </button>
  ) : null;

  // Response console — ADMIN-only triage/dispatch dashboard. Rose-tinted to read as ops/emergency,
  // distinct from the blue Admin button.
  const responseBtn = isAdmin ? (
    <button
      onClick={onResponse}
      title="Response console — triage & dispatch"
      style={{ display: 'flex', alignItems: 'center', flex: 'none', gap: 6, height: 40, padding: '0 14px', border: '1px solid #FBCFE8', background: '#FDF2F8', borderRadius: 11, fontSize: 13, fontWeight: 800, color: '#BE185D', cursor: 'pointer' }}
    >
      🚑 {!isMobile && 'Response'}
    </button>
  ) : null;

  const authCluster = auth ? (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flex: 'none' }}>
      <div
        title={`${auth.name} · ${auth.role}`}
        style={{ width: 34, height: 34, borderRadius: '50%', background: auth.picture ? `center/cover url(${auth.picture})` : 'linear-gradient(150deg,#0EA5E9,#0369A1)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 800, flex: 'none' }}
      >
        {!auth.picture && initials}
      </div>
      {!isMobile && (
        <button
          onClick={onSignOut}
          style={{ border: '1px solid #DCE3E9', background: '#fff', borderRadius: 9, padding: '7px 11px', fontSize: 12.5, fontWeight: 700, color: 'var(--bw-ink-soft)', cursor: 'pointer' }}
        >
          Sign out
        </button>
      )}
    </div>
  ) : (
    <button
      onClick={onSignIn}
      style={{ flex: 'none', height: 40, padding: '0 15px', border: '1px solid #DCE3E9', background: '#fff', borderRadius: 11, fontSize: 13, fontWeight: 700, color: 'var(--bw-ink-soft)', cursor: 'pointer' }}
    >
      Sign in
    </button>
  );

  return (
    <div
      style={{
        flex: 'none',
        height: 62,
        display: 'flex',
        alignItems: 'center',
        gap: isMobile ? 9 : 16,
        padding: isMobile ? '0 12px' : '0 20px',
        background: '#fff',
        borderBottom: '1px solid var(--bw-line)',
        zIndex: 40,
      }}
    >
      {/* Logo */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 11, flex: 'none' }}>
        <div
          style={{
            width: 36,
            height: 36,
            borderRadius: 11,
            background: 'linear-gradient(150deg,#0EA5E9,#0369A1)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 4px 10px rgba(3,105,161,.3)',
            flex: 'none',
          }}
        >
          <div style={{ width: 13, height: 13, background: '#fff', borderRadius: '50% 50% 50% 0', transform: 'rotate(45deg)' }} />
        </div>
        {/* The wordmark + sublines are hidden on mobile to free up room for the action row. */}
        {!isMobile && (
          <div style={{ lineHeight: 1.2 }}>
            <div style={{ fontSize: 17, fontWeight: 800, letterSpacing: '-.02em' }}>FloodedArea</div>
            <div style={{ fontSize: 11, color: 'var(--bw-muted)', fontWeight: 600 }}>{regionLabel}</div>
            <div
              title={`Build ${BUILD_COMMIT} · ${new Date(BUILD_TIME).toLocaleString()}`}
              style={{
                fontSize: 9.5,
                fontWeight: 700,
                fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
                color: 'var(--bw-faint)',
                whiteSpace: 'nowrap',
                marginTop: 1,
              }}
            >
              {BUILD_LABEL}
            </div>
          </div>
        )}
      </div>

      {/* Location search */}
      <SearchBox isMobile={isMobile} onSelect={onSearchSelect} />

      <div style={{ display: 'flex', alignItems: 'center', gap: isMobile ? 8 : 9, marginLeft: 'auto' }}>
        {isMobile ? (
          <>
            {/* Overflow menu for secondary actions */}
            <div ref={menuRef} style={{ position: 'relative', flex: 'none' }}>
              <button
                onClick={() => setMenuOpen((o) => !o)}
                title="More"
                aria-label="More options"
                aria-expanded={menuOpen}
                style={{ ...ICON_BTN, background: menuOpen ? 'var(--bw-bg-subtle)' : '#fff' }}
              >
                ⋯
              </button>
              {menuOpen && (
                <div
                  style={{ position: 'absolute', top: 'calc(100% + 8px)', right: 0, zIndex: 1400, minWidth: 212, background: '#fff', border: '1px solid var(--bw-line)', borderRadius: 12, boxShadow: '0 12px 34px rgba(15,23,42,.18)', overflow: 'hidden', padding: 6 }}
                >
                  <MenuItem icon="⤴" label="Share" onClick={runAndClose(onShare)} />
                  <MenuItem icon="📈" label="Water levels" onClick={runAndClose(onWaterChart)} />
                  <MenuItem icon="🛟" label="Rescue requests" onClick={runAndClose(onRescueChart)} />
                  <MenuItem icon="💙" label="About &amp; support" onClick={runAndClose(onSupport)} />
                </div>
              )}
            </div>
            {notifyBtn}
            {sosBtn}
            {responseBtn}
            {adminBtn}
            {authCluster}
          </>
        ) : (
          <>
            <button
              onClick={onShare}
              style={{ display: 'flex', alignItems: 'center', flex: 'none', gap: 7, height: 40, padding: '0 15px', border: '1px solid #DCE3E9', background: '#fff', borderRadius: 11, fontSize: 13, fontWeight: 700, color: 'var(--bw-ink-soft)', cursor: 'pointer' }}
            >
              <span style={{ fontSize: 14 }}>⤴</span> Share
            </button>

            <button onClick={onWaterChart} title="Water levels over time" aria-label="Water levels over time" style={ICON_BTN}>
              📈
            </button>

            <button onClick={onRescueChart} title="Rescue requests by district" aria-label="Rescue requests by district" style={ICON_BTN}>
              🛟
            </button>

            {notifyBtn}

            <button onClick={onSupport} title="About FloodedArea & support" aria-label="About FloodedArea & support" style={ICON_BTN}>
              💙
            </button>

            {sosBtn}

            <button
              onClick={onReport}
              style={{ display: 'flex', alignItems: 'center', flex: 'none', gap: 8, height: 40, padding: '0 17px', border: 0, background: 'var(--bw-primary)', borderRadius: 11, fontSize: 13, fontWeight: 800, color: '#fff', cursor: 'pointer', boxShadow: '0 4px 12px rgba(14,165,233,.32)' }}
            >
              <span style={{ fontSize: 16, fontWeight: 700 }}>+</span> Report flood
            </button>

            {responseBtn}
            {adminBtn}
            {authCluster}
          </>
        )}
      </div>
    </div>
  );
};

export default TopBar;
