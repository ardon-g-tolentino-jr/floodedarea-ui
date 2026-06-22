import React from 'react';
import { ROAD_META } from '../../utils/floodMeta';
import type { DistrictRoads, RoadEntry } from '../../utils/viewModel';

interface RoadConditionsModalProps {
  directory: DistrictRoads[];
  isMobile: boolean;
  onSelectRoad: (entry: RoadEntry) => void;
  onClose: () => void;
}

/** Browsable, searchable directory of roads and their current condition, grouped by district. */
const RoadConditionsModal: React.FC<RoadConditionsModalProps> = ({ directory, isMobile, onSelectRoad, onClose }) => {
  const [query, setQuery] = React.useState('');

  // Local substring filter over road name + district (this is local data — no geocoding needed).
  const q = query.trim().toLowerCase();
  const filtered = React.useMemo(() => {
    if (!q) return directory;
    return directory
      .map((d) => ({
        district: d.district,
        roads: d.roads.filter(
          (r) => r.name.toLowerCase().includes(q) || r.district.toLowerCase().includes(q)
        ),
      }))
      .filter((d) => d.roads.length > 0);
  }, [directory, q]);

  const totalRoads = React.useMemo(() => directory.reduce((n, d) => n + d.roads.length, 0), [directory]);

  const list =
    totalRoads === 0 ? (
      <div style={{ textAlign: 'center', padding: '40px 10px', color: '#9AA8B4', fontSize: 13 }}>
        No road conditions reported yet.
      </div>
    ) : filtered.length === 0 ? (
      <div style={{ textAlign: 'center', padding: '40px 10px', color: '#9AA8B4', fontSize: 13 }}>
        No roads match “{query.trim()}”.
      </div>
    ) : (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        {filtered.map((d) => (
          <div key={d.district}>
            <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: '.1em', color: 'var(--bw-faint)', marginBottom: 8 }}>
              {d.district.toUpperCase()}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
              {d.roads.map((r) => {
                const rm = ROAD_META[r.road];
                return (
                  <button
                    key={r.key}
                    onClick={() => onSelectRoad(r)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 10,
                      width: '100%',
                      textAlign: 'left',
                      padding: '10px 12px',
                      border: '1px solid var(--bw-line-soft)',
                      borderLeft: `3px solid ${rm.color}`,
                      borderRadius: 11,
                      background: '#fff',
                      cursor: 'pointer',
                    }}
                  >
                    <span style={{ flex: 1, minWidth: 0 }}>
                      <span style={{ display: 'block', fontSize: 13.5, fontWeight: 800, color: 'var(--bw-ink)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {r.name}
                      </span>
                      <span style={{ display: 'block', fontSize: 11.5, color: 'var(--bw-muted)', fontWeight: 600, marginTop: 2 }}>
                        {r.depthCm} cm · {r.reportCount === 1 ? '1 report' : `${r.reportCount} reports`} · {r.time}
                        {!r.confirmed && (
                          <span style={{ color: '#B45309', fontWeight: 700 }}> · unconfirmed</span>
                        )}
                      </span>
                    </span>
                    <span
                      style={{
                        flex: 'none',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 5,
                        padding: '4px 10px',
                        borderRadius: 999,
                        background: rm.soft,
                        color: rm.color,
                        fontSize: 11.5,
                        fontWeight: 800,
                      }}
                    >
                      <span>{rm.glyph}</span>
                      {rm.short}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    );

  const card = (
    <div style={{ background: '#fff', borderRadius: 18, boxShadow: '0 18px 50px rgba(15,23,42,.32)', overflow: 'hidden', border: '1px solid var(--bw-line)', display: 'flex', flexDirection: 'column', maxHeight: isMobile ? '90vh' : '80vh' }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 9, padding: '16px 18px 12px', borderBottom: '1px solid var(--bw-line-soft)', flex: 'none' }}>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 16, fontWeight: 800, letterSpacing: '-.01em' }}>Road conditions</div>
          <div style={{ fontSize: 12, color: 'var(--bw-muted)', fontWeight: 600, marginTop: 2 }}>From live reports · by district</div>
        </div>
        <button
          onClick={onClose}
          aria-label="Close"
          style={{ border: 0, background: 'var(--bw-bg-subtle)', color: '#7C8B98', width: 28, height: 28, borderRadius: 8, fontSize: 16, cursor: 'pointer', flex: 'none' }}
        >
          ×
        </button>
      </div>

      {/* Search */}
      <div style={{ padding: '12px 18px', flex: 'none' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 9, padding: '0 13px', height: 40, background: 'var(--bw-bg-subtle)', border: '1px solid var(--bw-line)', borderRadius: 11 }}>
          <span style={{ fontSize: 14, color: '#9AA8B4', flex: 'none' }}>⌕</span>
          <input
            autoFocus={!isMobile}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search a road or district…"
            style={{ border: 0, background: 'transparent', outline: 'none', fontSize: 13.5, width: '100%', color: 'var(--bw-ink)' }}
          />
          {query && (
            <button
              type="button"
              aria-label="Clear search"
              onClick={() => setQuery('')}
              style={{ border: 0, background: 'transparent', color: '#9AA8B4', fontSize: 15, cursor: 'pointer', flex: 'none', padding: 0, lineHeight: 1 }}
            >
              ×
            </button>
          )}
        </div>
      </div>

      <div style={{ padding: '0 18px 20px', overflowY: 'auto' }}>{list}</div>
    </div>
  );

  if (isMobile) {
    return (
      <>
        <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,.4)', zIndex: 1200 }} />
        <div style={{ position: 'fixed', left: 0, right: 0, bottom: 0, zIndex: 1210, animation: 'sheetUp .22s ease-out' }}>
          {card}
        </div>
      </>
    );
  }
  return (
    <>
      <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,.4)', zIndex: 1200 }} />
      <div style={{ position: 'fixed', left: '50%', top: '50%', transform: 'translate(-50%,-50%)', width: 'min(520px, 92vw)', zIndex: 1210, animation: 'popIn .14s ease-out' }}>
        {card}
      </div>
    </>
  );
};

export default RoadConditionsModal;
