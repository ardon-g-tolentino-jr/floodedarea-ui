import React from 'react';

/** A sidebar control group with a clickable header that collapses its body. Shared by Sidebar's
 *  own sections and the trip-monitoring section (TripPanel). */
const CollapsibleSection: React.FC<{
  title: string;
  open: boolean;
  onToggle: () => void;
  right?: React.ReactNode;
  children: React.ReactNode;
}> = ({ title, open, onToggle, right, children }) => (
  <div style={{ flex: 'none', padding: '0 18px 12px' }}>
    <button
      onClick={onToggle}
      aria-expanded={open}
      style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 8, padding: '4px 0 8px', border: 0, background: 'transparent', cursor: 'pointer' }}
    >
      <span
        style={{ fontSize: 10, color: 'var(--bw-faint)', flex: 'none', transform: open ? 'rotate(90deg)' : 'none', transition: 'transform .15s' }}
      >
        ▶
      </span>
      <span style={{ fontSize: 10, fontWeight: 800, letterSpacing: '.1em', color: 'var(--bw-faint)' }}>{title}</span>
      {right != null && <span style={{ marginLeft: 'auto' }}>{right}</span>}
    </button>
    {open && children}
  </div>
);

export default CollapsibleSection;
