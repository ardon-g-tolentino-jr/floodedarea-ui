import React from 'react';
import { BUILD_COMMIT, BUILD_LABEL, BUILD_TIME } from '../../buildInfo';
import type { AuthState } from '../../hooks/useAuth';
import type { Feedback } from '../../types';

interface FeaturesModalProps {
  isMobile: boolean;
  auth: AuthState | null;
  acceptedFeatures: Feedback[];
  onSuggest: () => void;
  onClose: () => void;
}

interface Feature {
  icon: string;
  name: string;
  desc: string;
}

/** Plain-language tour of everything the app does, grouped the way a first-time user thinks about
 *  it. Kept deliberately non-technical — no jargon, no mention of how any of it works under the
 *  hood. Opened from the build-version label in the TopBar (and the mobile overflow menu). */
const GROUPS: { title: string; items: Feature[] }[] = [
  {
    title: 'See what’s happening',
    items: [
      { icon: '🗺️', name: 'Live flood map', desc: 'Flooding reported by neighbors across the Philippines, updating as it happens.' },
      { icon: '🧭', name: 'Safety status', desc: 'A plain-language banner that tells you how safe your spot is right now.' },
      { icon: '🚧', name: 'Road conditions', desc: 'See which roads are risky or impassable so you can route around them.' },
      { icon: '🏠', name: 'Evacuation centers', desc: 'Find the nearest shelter, with its capacity and contact details.' },
      { icon: '📈', name: 'Water levels over time', desc: 'Check whether water is rising or easing over the last few hours.' },
    ],
  },
  {
    title: 'Keep the map honest',
    items: [
      { icon: '📍', name: 'Report a flood', desc: 'Tap the map to mark where it’s flooding — how deep, how bad, and if the road is passable.' },
      { icon: '✅', name: 'Confirm reports', desc: 'Confirm a report you can see is real, so everyone knows it’s still current.' },
      { icon: '🔔', name: 'Rainfall alerts', desc: 'Get a heads-up when a rainfall warning is raised — with optional notifications.' },
      { icon: '🔗', name: 'Share', desc: 'Send the live map to family and friends in one tap.' },
    ],
  },
  {
    title: 'Get help fast',
    items: [
      { icon: '🆘', name: 'SOS rescue', desc: 'Send a rescue request with your location and reach emergency hotlines instantly.' },
      { icon: '🎯', name: 'Find me', desc: 'Center the map on exactly where you are.' },
      { icon: '🔍', name: 'Search any place', desc: 'Jump straight to a barangay, street, or landmark.' },
      { icon: '🛟', name: 'Rescue overview', desc: 'See where rescue requests are coming from, by district (sign in to view).' },
    ],
  },
];

const FeaturesModal: React.FC<FeaturesModalProps> = ({ isMobile, auth, acceptedFeatures, onSuggest, onClose }) => (
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
        <div style={{ width: 40, height: 40, borderRadius: 12, background: 'rgba(255,255,255,.18)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, flex: 'none' }}>✨</div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 'clamp(16px, 4.5vw, 18px)', fontWeight: 800, lineHeight: 1.25 }}>What’s inside FloodedArea</div>
          <div style={{ fontSize: 12, opacity: 0.9 }}>Everything you can do here · {BUILD_LABEL}</div>
        </div>
        <button onClick={onClose} aria-label="Close" style={{ border: 0, background: 'rgba(255,255,255,.18)', color: '#fff', width: 28, height: 28, borderRadius: 8, fontSize: 17, cursor: 'pointer', flex: 'none' }}>×</button>
      </div>

      <div style={{ padding: 'clamp(16px, 4vw, 18px) clamp(16px, 5vw, 22px) clamp(18px, 5vw, 22px)' }}>
        <p style={{ margin: 0, fontSize: 13, lineHeight: 1.55, color: 'var(--bw-ink-soft)' }}>
          FloodedArea is a free, community-powered flood watch. Here’s everything you can do:
        </p>

        {GROUPS.map((group) => (
          <div key={group.title}>
            <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: '.1em', textTransform: 'uppercase', color: 'var(--bw-faint)', margin: '17px 0 5px' }}>
              {group.title}
            </div>
            {group.items.map((f) => (
              <div key={f.name} style={{ display: 'flex', gap: 12, alignItems: 'flex-start', padding: '8px 0' }}>
                <span style={{ width: 32, height: 32, borderRadius: 9, background: 'var(--bw-bg-subtle)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 17, flex: 'none' }}>{f.icon}</span>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: 13.5, fontWeight: 800, color: 'var(--bw-ink)' }}>{f.name}</div>
                  <div style={{ fontSize: 12.5, lineHeight: 1.5, color: 'var(--bw-muted)', marginTop: 1 }}>{f.desc}</div>
                </div>
              </div>
            ))}
          </div>
        ))}

        {/* Community requests — accepted feature requests + a way to suggest your own. */}
        <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: '.1em', textTransform: 'uppercase', color: 'var(--bw-faint)', margin: '17px 0 6px' }}>
          Community requests
        </div>
        {!auth ? (
          <div style={{ padding: '11px 13px', background: 'var(--bw-bg-subtle)', borderRadius: 11, fontSize: 12.5, lineHeight: 1.5, color: 'var(--bw-muted)' }}>
            Sign in to see accepted feature requests and suggest your own.
          </div>
        ) : (
          <>
            {acceptedFeatures.length === 0 ? (
              <div style={{ fontSize: 12.5, color: 'var(--bw-muted)', lineHeight: 1.5, padding: '2px 0 6px' }}>
                No accepted requests yet — be the first to suggest one.
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
                {acceptedFeatures.map((f) => (
                  <div key={f.id} style={{ display: 'flex', gap: 10, alignItems: 'flex-start', padding: '9px 11px', background: '#F0FDF4', border: '1px solid #BBF7D0', borderRadius: 10 }}>
                    <span style={{ fontSize: 14, flex: 'none', marginTop: 1 }}>✅</span>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontSize: 13, fontWeight: 800, color: 'var(--bw-ink)' }}>{f.title}</div>
                      {f.details && <div style={{ fontSize: 12, lineHeight: 1.45, color: 'var(--bw-muted)', marginTop: 1 }}>{f.details}</div>}
                    </div>
                  </div>
                ))}
              </div>
            )}
            <button
              onClick={onSuggest}
              style={{ width: '100%', marginTop: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, border: '1px solid var(--bw-line)', background: '#fff', color: 'var(--bw-ink)', padding: 11, borderRadius: 11, fontSize: 13.5, fontWeight: 800, cursor: 'pointer' }}
            >
              💡 Suggest a feature / report a bug
            </button>
          </>
        )}

        {/* Responder note — these tools only appear for signed-in responders/admins. */}
        <div style={{ marginTop: 16, padding: '11px 13px', background: 'var(--bw-bg-subtle)', borderRadius: 11, fontSize: 12, lineHeight: 1.5, color: 'var(--bw-muted)' }}>
          🚑 Responders and admins get extra tools — rescue triage, dispatch, and hotspot maps.
        </div>

        <button
          onClick={onClose}
          style={{ width: '100%', marginTop: 18, border: 0, background: 'var(--bw-primary)', color: '#fff', padding: 14, borderRadius: 13, fontSize: 15, fontWeight: 800, cursor: 'pointer', boxShadow: '0 6px 16px rgba(14,165,233,.3)' }}
        >
          Got it
        </button>
        <div
          title={`Build ${BUILD_COMMIT} · ${new Date(BUILD_TIME).toLocaleString()}`}
          style={{ marginTop: 10, textAlign: 'center', fontSize: 10.5, fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace', color: 'var(--bw-faint)' }}
        >
          {BUILD_LABEL} · {BUILD_COMMIT} · {new Date(BUILD_TIME).toLocaleDateString()}
        </div>
      </div>
    </div>
  </div>
);

export default FeaturesModal;
