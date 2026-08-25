import React from 'react';

/** The house glyph used for evacuation centers across the UI. */
const ShelterIcon: React.FC<{ size?: number; color?: string }> = ({ size = 13, color = 'var(--bw-on-accent)' }) => (
  <svg viewBox="0 0 24 24" style={{ width: size, height: size }}>
    <path d="M12 3 L21 11 H18 V20 H14 V14 H10 V20 H6 V11 H3 Z" fill={color} />
  </svg>
);

export default ShelterIcon;
