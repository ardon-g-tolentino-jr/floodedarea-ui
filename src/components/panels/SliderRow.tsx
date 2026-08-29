import React from 'react';

/**
 * One labelled slider with a readout and a trailing action, used for both a row's depth and its
 * time-to-live so the two read as a pair. Kept generic over the value because the depth track is in
 * the displayed unit while the TTL track is an index into TTL_STOPS_MIN.
 *
 * Shared by AdminQuickReportView (per-hotspot depth/TTL rows) and ReportDetailCard's ADMIN OVERRIDE
 * reopen control (TTL row only) — moved here so both get the same 320 px-safe layout.
 */
const SliderRow: React.FC<{
  label: string;
  min: number;
  max: number;
  step: number;
  value: number;
  onChange: (v: number) => void;
  color: string;
  readout: string;
  aside?: React.ReactNode;
}> = ({ label, min, max, step, value, onChange, color, readout, aside }) => (
  // flexWrap + modest minWidths so the readout and action drop to a second line on a narrow phone
  // rather than pushing the track off the edge — the label/track/readout/aside fixed widths would
  // otherwise total more than a 320 px viewport can hold.
  <div style={{ display: 'flex', alignItems: 'center', gap: 9, flexWrap: 'wrap' }}>
    <span style={{ fontSize: 10.5, fontWeight: 800, color: 'var(--bw-muted)', width: 34, flex: 'none' }}>{label}</span>
    <input
      type="range"
      min={min}
      max={max}
      step={step}
      value={value}
      onChange={(e) => onChange(Number(e.target.value))}
      style={{ flex: '1 1 110px', minWidth: 96, accentColor: color, cursor: 'pointer' }}
    />
    <span style={{ fontSize: 11.5, fontWeight: 800, minWidth: 84, textAlign: 'right', flex: 'none' }}>{readout}</span>
    <span style={{ flex: 'none', minWidth: 62, display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: 6 }}>{aside}</span>
  </div>
);

export default SliderRow;
