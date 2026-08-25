import React from 'react';
import { ROAD_META, ROAD_ORDER } from '../../utils/floodMeta';

/** Small map overlay explaining the road-status dot colors (desktop). */
const RoadLegend: React.FC = () => (
  <div
    style={{
      position: 'absolute',
      bottom: 16,
      left: 16,
      zIndex: 500,
      padding: '11px 13px',
      background: 'var(--bw-surface-glass)',
      backdropFilter: 'blur(4px)',
      border: '1px solid var(--bw-line)',
      borderRadius: 12,
      boxShadow: '0 4px 16px rgba(15,23,42,.1)',
    }}
  >
    <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: '.1em', color: 'var(--bw-faint)', marginBottom: 8 }}>ROAD STATUS</div>
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      {ROAD_ORDER.map((k) => {
        const rm = ROAD_META[k];
        return (
          <div key={k} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ width: 11, height: 11, borderRadius: '50%', background: rm.color, border: '2px solid var(--bw-surface)', boxShadow: `0 0 0 1px ${rm.color}`, flex: 'none' }} />
            <span style={{ fontSize: 12, fontWeight: 700 }}>{rm.label}</span>
          </div>
        );
      })}
    </div>
    <div style={{ marginTop: 8, paddingTop: 7, borderTop: '1px solid var(--bw-line-soft)', fontSize: 10, color: 'var(--bw-muted)', lineHeight: 1.3, maxWidth: 156 }}>
      Dot = road passability · ring = flood severity
    </div>
  </div>
);

export default RoadLegend;
