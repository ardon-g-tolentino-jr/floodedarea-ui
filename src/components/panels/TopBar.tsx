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
  isAdmin: boolean;
  onAdmin: () => void;
}

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
  isAdmin,
  onAdmin,
}) => {
  const initials = auth ? auth.name.trim().charAt(0).toUpperCase() || '?' : '';

  return (
    <div
      style={{
        flex: 'none',
        height: 62,
        display: 'flex',
        alignItems: 'center',
        gap: isMobile ? 10 : 16,
        padding: isMobile ? '0 14px' : '0 20px',
        background: '#fff',
        borderBottom: '1px solid var(--bw-line)',
        zIndex: 40,
      }}
    >
      {/* Logo */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 11 }}>
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
      </div>

      {/* Location search */}
      <SearchBox isMobile={isMobile} onSelect={onSearchSelect} />

      <div style={{ display: 'flex', alignItems: 'center', gap: 9, marginLeft: 'auto' }}>
        {isMobile ? (
          <button
            onClick={onShare}
            title="Share"
            aria-label="Share"
            style={{
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
            }}
          >
            ⤴
          </button>
        ) : (
          <button
            onClick={onShare}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 7,
              height: 40,
              padding: '0 15px',
              border: '1px solid #DCE3E9',
              background: '#fff',
              borderRadius: 11,
              fontSize: 13,
              fontWeight: 700,
              color: 'var(--bw-ink-soft)',
              cursor: 'pointer',
            }}
          >
            <span style={{ fontSize: 14 }}>⤴</span> Share
          </button>
        )}

        <button
          onClick={onWaterChart}
          title="Water levels over time"
          aria-label="Water levels over time"
          style={{
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
          }}
        >
          📈
        </button>

        <button
          onClick={onRescueChart}
          title="Rescue requests by district"
          aria-label="Rescue requests by district"
          style={{
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
          }}
        >
          🛟
        </button>

        <button
          onClick={onNotify}
          title="Flood alerts"
          aria-label="Flood alerts"
          style={{
            position: 'relative',
            width: 40,
            height: 40,
            flex: 'none',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            border: `1px solid ${notifyOn ? '#BAE2FB' : '#DCE3E9'}`,
            background: notifyOn ? '#EFF8FF' : '#fff',
            borderRadius: 11,
            fontSize: 16,
            cursor: 'pointer',
          }}
        >
          🔔
          {notifyOn && (
            <span style={{ position: 'absolute', top: 7, right: 8, width: 8, height: 8, borderRadius: '50%', background: 'var(--bw-primary)', border: '2px solid #fff' }} />
          )}
        </button>

        <button
          onClick={onSOS}
          style={{
            display: 'flex',
            alignItems: 'center',
            height: 40,
            padding: '0 16px',
            border: 0,
            background: 'var(--bw-danger)',
            borderRadius: 11,
            fontSize: 13,
            fontWeight: 800,
            color: '#fff',
            cursor: 'pointer',
            boxShadow: '0 4px 12px rgba(239,68,68,.32)',
          }}
        >
          SOS
        </button>

        {!isMobile && (
          <button
            onClick={onReport}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              height: 40,
              padding: '0 17px',
              border: 0,
              background: 'var(--bw-primary)',
              borderRadius: 11,
              fontSize: 13,
              fontWeight: 800,
              color: '#fff',
              cursor: 'pointer',
              boxShadow: '0 4px 12px rgba(14,165,233,.32)',
            }}
          >
            <span style={{ fontSize: 16, fontWeight: 700 }}>+</span> Report flood
          </button>
        )}

        {isAdmin && (
          <button
            onClick={onAdmin}
            title="Admin console"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              height: 40,
              padding: '0 14px',
              border: '1px solid #BAE2FB',
              background: '#EFF8FF',
              borderRadius: 11,
              fontSize: 13,
              fontWeight: 800,
              color: 'var(--bw-primary)',
              cursor: 'pointer',
            }}
          >
            ⚙ {!isMobile && 'Admin'}
          </button>
        )}

        {/* Auth */}
        {auth ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div
              title={`${auth.name} · ${auth.role}`}
              style={{
                width: 34,
                height: 34,
                borderRadius: '50%',
                background: auth.picture ? `center/cover url(${auth.picture})` : 'linear-gradient(150deg,#0EA5E9,#0369A1)',
                color: '#fff',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 13,
                fontWeight: 800,
                flex: 'none',
              }}
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
            style={{
              height: 40,
              padding: '0 15px',
              border: '1px solid #DCE3E9',
              background: '#fff',
              borderRadius: 11,
              fontSize: 13,
              fontWeight: 700,
              color: 'var(--bw-ink-soft)',
              cursor: 'pointer',
            }}
          >
            Sign in
          </button>
        )}
      </div>
    </div>
  );
};

export default TopBar;
