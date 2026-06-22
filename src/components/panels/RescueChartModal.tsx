import React from 'react';
import type { RescueRequest, RescueStatus } from '../../types';
import { ApiError } from '../../api/client';
import { DISTRICT_COLORS } from '../../utils/floodMeta';
import { localDateKey, rescueCountsByDistrict, rescuesOnLocalDate } from '../../utils/viewModel';

interface RescueChartModalProps {
  rescues: RescueRequest[];
  loading?: boolean;
  error?: Error | null;
  isMobile: boolean;
  onClose: () => void;
}

// Small status pill palette, consistent with the app's hues (amber/blue/green).
const STATUS_STYLE: Record<RescueStatus, { bg: string; fg: string; label: string }> = {
  pending: { bg: '#FEF3C7', fg: '#B45309', label: 'Pending' },
  dispatched: { bg: '#DBEAFE', fg: '#1D4ED8', label: 'Dispatched' },
  resolved: { bg: '#DCFCE7', fg: '#15803D', label: 'Resolved' },
};

/** A readable label for a `YYYY-MM-DD` key, e.g. "Today · Mon, Jun 22". */
function dateLabel(ymd: string, today: string): string {
  // Parse as local midnight so the weekday/day don't shift across timezones.
  const d = new Date(`${ymd}T00:00:00`);
  const pretty = d.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' });
  return ymd === today ? `Today · ${pretty}` : pretty;
}

/** Rescue requests for a chosen day: a per-district bar chart plus the individual requests. */
const RescueChartModal: React.FC<RescueChartModalProps> = ({ rescues, loading, error, isMobile, onClose }) => {
  const today = React.useMemo(() => localDateKey(new Date()), []);
  const [selectedDate, setSelectedDate] = React.useState(today);

  const dayRescues = React.useMemo(() => rescuesOnLocalDate(rescues, selectedDate), [rescues, selectedDate]);
  const rows = React.useMemo(() => rescueCountsByDistrict(dayRescues), [dayRescues]);
  const max = rows.reduce((m, r) => Math.max(m, r.count), 0) || 1;
  const count = dayRescues.length;

  // Rescue data is auth-protected. 401 = missing/expired session; 403 = signed in without
  // permission; anything else is treated as a backend outage.
  const status = error instanceof ApiError ? error.status : undefined;
  const headline =
    status === 401 ? 'Sign in to view rescue requests.'
    : status === 403 ? 'You don’t have access to rescue requests.'
    : 'Couldn’t load rescue requests.';
  const subtext =
    status === 401 ? 'Your session may have expired — sign in again, then reopen.'
    : status === 403 ? 'This view isn’t available for your account.'
    : 'Check the backend is running, then reopen.';

  const body =
    error && rescues.length === 0 ? (
      <div style={{ textAlign: 'center', padding: '40px 10px', color: '#B91C1C', fontSize: 13, lineHeight: 1.5 }}>
        {headline}
        <div style={{ color: '#9AA8B4', fontSize: 12, marginTop: 4 }}>{subtext}</div>
      </div>
    ) : loading && rescues.length === 0 ? (
      <div style={{ textAlign: 'center', padding: '40px 10px', color: '#9AA8B4', fontSize: 13 }}>
        Loading rescue requests…
      </div>
    ) : count === 0 ? (
      <div style={{ textAlign: 'center', padding: '40px 10px', color: '#9AA8B4', fontSize: 13 }}>
        No rescue requests on {dateLabel(selectedDate, today)}.
      </div>
    ) : (
      <>
        {/* Per-district chart for the selected day */}
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

        {/* Individual requests for the selected day */}
        <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: '.12em', color: 'var(--bw-faint)', margin: '20px 0 10px' }}>
          REQUESTS
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {dayRescues.map((r) => {
            const st = STATUS_STYLE[r.status] ?? STATUS_STYLE.pending;
            const time = new Date(r.createdAt).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
            const place = [r.barangay, r.city, r.district].map((s) => s?.trim()).filter(Boolean).join(' · ') || 'Unknown area';
            return (
              <div key={r.id} style={{ display: 'flex', alignItems: 'flex-start', gap: 10, padding: '10px 12px', background: 'var(--bw-bg-subtle)', borderRadius: 12 }}>
                <div style={{ width: 58, flex: 'none', fontSize: 12.5, fontWeight: 800, color: 'var(--bw-ink)' }}>{time}</div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--bw-ink)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={place}>
                    {place}
                  </div>
                  {r.note && <div style={{ fontSize: 11.5, color: 'var(--bw-muted)', marginTop: 2 }}>{r.note}</div>}
                </div>
                <span style={{ flex: 'none', fontSize: 10.5, fontWeight: 800, color: st.fg, background: st.bg, padding: '3px 8px', borderRadius: 999 }}>
                  {st.label}
                </span>
              </div>
            );
          })}
        </div>
      </>
    );

  const card = (
    <div style={{ background: '#fff', borderRadius: 18, boxShadow: '0 18px 50px rgba(15,23,42,.32)', overflow: 'hidden', border: '1px solid var(--bw-line)' }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 9, padding: '16px 18px 12px', borderBottom: '1px solid var(--bw-line-soft)' }}>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 16, fontWeight: 800, letterSpacing: '-.01em' }}>Rescue requests</div>
          <div style={{ fontSize: 12, color: 'var(--bw-muted)', fontWeight: 600, marginTop: 2 }}>
            {count === 1 ? '1 request' : `${count} requests`} on {dateLabel(selectedDate, today)}
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

      {/* Date selector */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '12px 18px', borderBottom: '1px solid var(--bw-line-soft)' }}>
        <input
          type="date"
          value={selectedDate}
          max={today}
          onChange={(e) => setSelectedDate(e.target.value || today)}
          style={{ flex: 1, fontSize: 13, fontWeight: 600, color: 'var(--bw-ink)', border: '1px solid var(--bw-line)', borderRadius: 9, padding: '8px 10px', background: '#fff' }}
        />
        {selectedDate !== today && (
          <button
            onClick={() => setSelectedDate(today)}
            style={{ flex: 'none', border: 0, background: 'var(--bw-bg-subtle)', color: 'var(--bw-ink)', fontSize: 12.5, fontWeight: 700, padding: '8px 12px', borderRadius: 9, cursor: 'pointer' }}
          >
            Today
          </button>
        )}
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
