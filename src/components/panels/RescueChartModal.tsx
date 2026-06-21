import React from 'react';
import type { RescueRequest } from '../../types';
import { DISTRICT_COLORS } from '../../utils/floodMeta';
import { rescueCountsByDistrict } from '../../utils/viewModel';

interface RescueChartModalProps {
  rescues: RescueRequest[];
  loading?: boolean;
  error?: Error | null;
  isMobile: boolean;
  onClose: () => void;
}

/** Horizontal bar chart of how many rescue requests were sent per district. */
const RescueChartModal: React.FC<RescueChartModalProps> = ({ rescues, loading, error, isMobile, onClose }) => {
  const rows = React.useMemo(() => rescueCountsByDistrict(rescues), [rescues]);
  const total = rescues.length;
  const max = rows.reduce((m, r) => Math.max(m, r.count), 0) || 1;

  const body =
    error && rows.length === 0 ? (
      <div style={{ textAlign: 'center', padding: '40px 10px', color: '#B91C1C', fontSize: 13, lineHeight: 1.5 }}>
        Couldn’t load rescue requests.
        <div style={{ color: '#9AA8B4', fontSize: 12, marginTop: 4 }}>Check the backend is running, then reopen.</div>
      </div>
    ) : loading && rows.length === 0 ? (
      <div style={{ textAlign: 'center', padding: '40px 10px', color: '#9AA8B4', fontSize: 13 }}>
        Loading rescue requests…
      </div>
    ) : rows.length === 0 ? (
      <div style={{ textAlign: 'center', padding: '40px 10px', color: '#9AA8B4', fontSize: 13 }}>
        No rescue requests yet.
      </div>
    ) : (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {rows.map((r, i) => {
          const color = DISTRICT_COLORS[i % DISTRICT_COLORS.length];
          const pct = Math.max(6, (r.count / max) * 100); // floor so tiny bars stay visible
          return (
            <div key={r.district} style={{ display: 'flex', alignItems: 'center', gap: 11 }}>
              <div
                style={{ width: 116, flex: 'none', fontSize: 12.5, fontWeight: 700, color: 'var(--bw-ink)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
                title={r.district}
              >
                {r.district}
              </div>
              <div style={{ flex: 1, height: 22, background: 'var(--bw-bg-subtle)', borderRadius: 7, overflow: 'hidden' }}>
                <div style={{ width: `${pct}%`, height: '100%', background: color, borderRadius: 7, transition: 'width .2s' }} />
              </div>
              <div style={{ width: 26, flex: 'none', textAlign: 'right', fontSize: 13, fontWeight: 800, color: 'var(--bw-ink)' }}>
                {r.count}
              </div>
            </div>
          );
        })}
      </div>
    );

  const card = (
    <div style={{ background: '#fff', borderRadius: 18, boxShadow: '0 18px 50px rgba(15,23,42,.32)', overflow: 'hidden', border: '1px solid var(--bw-line)' }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 9, padding: '16px 18px 12px', borderBottom: '1px solid var(--bw-line-soft)' }}>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 16, fontWeight: 800, letterSpacing: '-.01em' }}>Rescue requests by district</div>
          <div style={{ fontSize: 12, color: 'var(--bw-muted)', fontWeight: 600, marginTop: 2 }}>
            {total === 1 ? '1 request total' : `${total} requests total`}
          </div>
        </div>
        <button
          onClick={onClose}
          aria-label="Close"
          style={{ border: 0, background: 'var(--bw-bg-subtle)', color: '#7C8B98', width: 28, height: 28, borderRadius: 8, fontSize: 16, cursor: 'pointer', flex: 'none' }}
        >
          ×
        </button>
      </div>
      <div style={{ padding: '18px 18px 22px', maxHeight: isMobile ? '70vh' : '60vh', overflowY: 'auto' }}>{body}</div>
    </div>
  );

  if (isMobile) {
    return (
      <>
        <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,.4)', zIndex: 1200 }} />
        <div style={{ position: 'fixed', left: 0, right: 0, bottom: 0, zIndex: 1210, maxHeight: '90vh', overflowY: 'auto', animation: 'sheetUp .22s ease-out' }}>
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

export default RescueChartModal;
