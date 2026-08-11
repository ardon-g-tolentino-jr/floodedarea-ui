import React from 'react';

/**
 * One search-result row's inner content: the ⚲ glyph, the place's own name in bold, and
 * disambiguating context (barangay · city · state) muted beneath — each line ellipsised so a long
 * context can't blow out the dropdown. Shared by SearchBox, PlaceField and PublicDashboardModal;
 * each caller keeps its own button wrapper, keyboard/active-index highlighting and onMouseDown
 * selection — only this inner row markup is common.
 */
const PlaceSuggestion: React.FC<{ primary: string; context: string }> = ({ primary, context }) => (
  <span style={{ display: 'flex', alignItems: 'flex-start', gap: 9, minWidth: 0 }}>
    <span style={{ fontSize: 13, color: '#9AA8B4', flex: 'none', marginTop: 1 }}>⚲</span>
    <span style={{ minWidth: 0, overflow: 'hidden', flex: 1 }}>
      <span style={{ display: 'block', fontWeight: 700, color: 'var(--bw-ink)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
        {primary}
      </span>
      {context && (
        <span style={{ display: 'block', fontSize: 11.5, color: 'var(--bw-muted)', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginTop: 1 }}>
          {context}
        </span>
      )}
    </span>
  </span>
);

export default PlaceSuggestion;
