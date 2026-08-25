import React from 'react';

interface LocateButtonProps {
  onClick: () => void;
  locating: boolean;
}

/**
 * Floating "show my location" control pinned to the bottom-right of the map. Tapping it asks App
 * for a fresh GPS fix, which recenters the map (via mapFocus) on the pulsing "You" marker.
 * zIndex sits just above Leaflet's control layer (panes/controls ≤1000); it lives inside the map
 * area's own stacking context, so — like the other map overlays — it never covers the TopBar.
 */
const LocateButton: React.FC<LocateButtonProps> = ({ onClick, locating }) => (
  <button
    onClick={onClick}
    disabled={locating}
    title="Show my location"
    aria-label="Show my location"
    style={{
      position: 'absolute',
      right: 12,
      bottom: 30,
      zIndex: 1000,
      width: 44,
      height: 44,
      padding: 0,
      borderRadius: '50%',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'var(--bw-surface)',
      border: '1px solid var(--bw-line)',
      boxShadow: '0 4px 14px rgba(15,23,42,.18)',
      color: 'var(--bw-primary)',
      cursor: locating ? 'default' : 'pointer',
    }}
  >
    {locating ? (
      <span
        style={{
          width: 18,
          height: 18,
          borderRadius: '50%',
          border: '2px solid var(--bw-line)',
          borderTopColor: 'var(--bw-primary)',
          animation: 'spin .7s linear infinite',
        }}
      />
    ) : (
      // Material "my_location" crosshair — the universal GPS-locate glyph.
      <svg viewBox="0 0 24 24" width="22" height="22" fill="currentColor" aria-hidden="true">
        <path d="M12 8c-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4-1.79-4-4-4zm8.94 3c-.46-4.17-3.77-7.48-7.94-7.94V1h-2v2.06C6.83 3.52 3.52 6.83 3.06 11H1v2h2.06c.46 4.17 3.77 7.48 7.94 7.94V23h2v-2.06c4.17-.46 7.48-3.77 7.94-7.94H23v-2h-2.06zM12 19c-3.87 0-7-3.13-7-7s3.13-7 7-7 7 3.13 7 7-3.13 7-7 7z" />
      </svg>
    )}
  </button>
);

export default LocateButton;
