import React from 'react';
import type {
  EvacuationCenter,
  FloodAlert,
  FloodReport,
  Hotline,
  NewAlert,
  NewCenter,
  NewHotline,
  NewReport,
  ReportStatus,
} from '../../types';
import { ROAD_META, ROAD_ORDER, SEV_META, TREND_META } from '../../utils/floodMeta';
import { MIN_QUERY_LENGTH, searchPlaces, type GeoResult } from '../../api/geocode';

type Tab = 'shelters' | 'hotlines' | 'alerts' | 'reports';

interface AdminPanelProps {
  centers: EvacuationCenter[];
  hotlines: Hotline[];
  alerts: FloodAlert[];
  reports: FloodReport[];
  liveStream: boolean;
  onToggleLive: (on: boolean) => void;
  onCreateCenter: (b: NewCenter) => Promise<void>;
  onUpdateCenter: (id: number, b: Partial<NewCenter>) => Promise<void>;
  onDeleteCenter: (id: number) => Promise<void>;
  onCreateHotline: (b: NewHotline) => Promise<void>;
  onUpdateHotline: (id: number, b: Partial<NewHotline>) => Promise<void>;
  onDeleteHotline: (id: number) => Promise<void>;
  onCreateAlert: (b: NewAlert) => Promise<void>;
  onUpdateAlert: (id: number, b: Partial<NewAlert>) => Promise<void>;
  onDeleteAlert: (id: number) => Promise<void>;
  onCreateReport: (b: NewReport) => Promise<void>;
  onUpdateReport: (id: number, b: Partial<NewReport & { status: ReportStatus }>) => Promise<void>;
  onDeleteReport: (id: number) => Promise<void>;
  onClose: () => void;
}

type FieldType = 'text' | 'number' | 'textarea' | 'select' | 'checkbox' | 'place';
interface Field {
  key: string;
  label: string;
  type: FieldType;
  options?: { value: string; label: string }[];
}

const sevOptions = (Object.keys(SEV_META) as (keyof typeof SEV_META)[]).map((k) => ({ value: k, label: SEV_META[k].label }));
const trendOptions = (Object.keys(TREND_META) as (keyof typeof TREND_META)[]).map((k) => ({ value: k, label: TREND_META[k].label }));
const roadOptions = ROAD_ORDER.map((k) => ({ value: k, label: ROAD_META[k].label }));
const levelOptions = [
  { value: 'yellow', label: 'Yellow' },
  { value: 'orange', label: 'Orange' },
  { value: 'red', label: 'Red' },
];
const statusOptions = [
  { value: 'active', label: 'Active' },
  { value: 'resolved', label: 'Resolved' },
];

const FIELDS: Record<Tab, Field[]> = {
  shelters: [
    { key: 'name', label: 'Name', type: 'text' },
    { key: 'contact', label: 'Contact number', type: 'text' },
    { key: 'location', label: 'Location', type: 'place' },
  ],
  hotlines: [
    { key: 'name', label: 'Name', type: 'text' },
    { key: 'phoneNumber', label: 'Phone number', type: 'text' },
    { key: 'description', label: 'Description', type: 'text' },
    { key: 'position', label: 'List position', type: 'number' },
  ],
  alerts: [
    { key: 'title', label: 'Title', type: 'text' },
    { key: 'body', label: 'Body', type: 'textarea' },
    { key: 'region', label: 'Region', type: 'text' },
    { key: 'level', label: 'Level', type: 'select', options: levelOptions },
    { key: 'active', label: 'Active', type: 'checkbox' },
  ],
  reports: [
    { key: 'name', label: 'Name', type: 'text' },
    { key: 'district', label: 'District', type: 'text' },
    { key: 'location', label: 'Location', type: 'place' },
    { key: 'severity', label: 'Severity', type: 'select', options: sevOptions },
    { key: 'depthCm', label: 'Depth (cm)', type: 'number' },
    { key: 'trend', label: 'Trend', type: 'select', options: trendOptions },
    { key: 'road', label: 'Road', type: 'select', options: roadOptions },
    { key: 'status', label: 'Status', type: 'select', options: statusOptions },
  ],
};

const TAB_LABEL: Record<Tab, string> = {
  shelters: 'Shelters',
  hotlines: 'Hotlines',
  alerts: 'Alerts',
  reports: 'Reports',
};

const PAGE_SIZE = 10;

type FormValues = Record<string, string | boolean>;

/** Seed a form with sensible empty/defaults so selects/checkboxes are valid for a brand-new record. */
function blankForm(tab: Tab): FormValues {
  const v: FormValues = {};
  for (const f of FIELDS[tab]) {
    if (f.type === 'place') { v.latitude = ''; v.longitude = ''; v._place = ''; }
    else if (f.type === 'checkbox') v[f.key] = f.key === 'active' ? true : false;
    else if (f.type === 'select') v[f.key] = f.options?.[0]?.value ?? '';
    else v[f.key] = '';
  }
  return v;
}

function fillForm(tab: Tab, rec: Record<string, unknown>): FormValues {
  const v: FormValues = {};
  for (const f of FIELDS[tab]) {
    if (f.type === 'place') {
      v.latitude = rec.latitude == null ? '' : String(rec.latitude);
      v.longitude = rec.longitude == null ? '' : String(rec.longitude);
      v._place = '';
      continue;
    }
    const raw = rec[f.key];
    if (f.type === 'checkbox') v[f.key] = !!raw;
    else v[f.key] = raw === null || raw === undefined ? '' : String(raw);
  }
  return v;
}

const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '9px 11px',
  border: '1px solid var(--bw-line)',
  borderRadius: 9,
  fontSize: 13,
  color: 'var(--bw-ink)',
  background: '#fff',
  boxSizing: 'border-box',
};

/**
 * Location picker for admin records: the admin searches a place (Nominatim, same geocoder as
 * the TopBar search) and we derive the coordinates from the chosen result — no manual lat/lng.
 */
const PlaceField: React.FC<{
  lat: string;
  lng: string;
  placeLabel: string;
  onPick: (lat: number, lng: number, label: string) => void;
}> = ({ lat, lng, placeLabel, onPick }) => {
  const [query, setQuery] = React.useState('');
  const [results, setResults] = React.useState<GeoResult[]>([]);
  const [open, setOpen] = React.useState(false);
  const [loading, setLoading] = React.useState(false);
  const abortRef = React.useRef<AbortController | null>(null);

  React.useEffect(() => {
    const q = query.trim();
    if (q.length < MIN_QUERY_LENGTH) {
      setResults([]);
      setLoading(false);
      abortRef.current?.abort();
      return;
    }
    setLoading(true);
    const timer = window.setTimeout(async () => {
      abortRef.current?.abort();
      const ac = new AbortController();
      abortRef.current = ac;
      const found = await searchPlaces(q, ac.signal);
      if (ac.signal.aborted) return;
      setResults(found);
      setLoading(false);
      setOpen(true);
    }, 350);
    return () => window.clearTimeout(timer);
  }, [query]);

  const [locating, setLocating] = React.useState(false);
  const [geoError, setGeoError] = React.useState<string | null>(null);

  const choose = (r: GeoResult): void => {
    onPick(r.lat, r.lng, r.label);
    setQuery('');
    setResults([]);
    setOpen(false);
  };

  const useCurrentLocation = (): void => {
    setGeoError(null);
    if (!navigator.geolocation) {
      setGeoError('Location is not available on this device.');
      return;
    }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        onPick(pos.coords.latitude, pos.coords.longitude, 'My current location');
        setQuery('');
        setResults([]);
        setOpen(false);
        setLocating(false);
      },
      () => {
        setGeoError('Could not get your location. Allow location access or search instead.');
        setLocating(false);
      },
      { enableHighAccuracy: true, timeout: 8000 }
    );
  };

  const hasCoords = lat !== '' && lng !== '';
  const showList = open && (loading || results.length > 0);

  return (
    <div style={{ position: 'relative' }}>
      <div style={{ display: 'flex', gap: 8 }}>
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => { if (results.length) setOpen(true); }}
          placeholder="Search a barangay, street or landmark…"
          style={{ ...inputStyle, flex: 1 }}
        />
        <button
          type="button"
          onClick={useCurrentLocation}
          disabled={locating}
          title="Use my current location"
          style={{ flex: 'none', display: 'flex', alignItems: 'center', gap: 6, padding: '0 12px', border: '1px solid #BAE2FB', background: '#EFF8FF', color: 'var(--bw-primary)', borderRadius: 9, fontSize: 12.5, fontWeight: 700, cursor: locating ? 'wait' : 'pointer', whiteSpace: 'nowrap' }}
        >
          ◎ {locating ? 'Locating…' : 'Current'}
        </button>
      </div>
      {geoError && (
        <div style={{ fontSize: 11, color: '#B91C1C', marginTop: 5 }}>{geoError}</div>
      )}
      {(placeLabel || hasCoords) && (
        <div style={{ fontSize: 11, color: 'var(--bw-muted)', marginTop: 5, display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ color: '#9AA8B4' }}>⚲</span>
          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {placeLabel || `Pinned at ${Number(lat).toFixed(4)}, ${Number(lng).toFixed(4)}`}
          </span>
        </div>
      )}
      {showList && (
        <div style={{ position: 'absolute', top: 'calc(100% + 4px)', left: 0, right: 0, zIndex: 1400, background: '#fff', border: '1px solid var(--bw-line)', borderRadius: 11, boxShadow: '0 12px 34px rgba(15,23,42,.18)', overflow: 'hidden', maxHeight: 240, overflowY: 'auto' }}>
          {loading && results.length === 0 ? (
            <div style={{ padding: '11px 13px', fontSize: 12.5, color: 'var(--bw-muted)' }}>Searching…</div>
          ) : (
            results.map((r, i) => (
              <button
                key={r.id}
                type="button"
                onMouseDown={(e) => { e.preventDefault(); choose(r); }}
                style={{ display: 'flex', alignItems: 'center', gap: 9, width: '100%', textAlign: 'left', padding: '10px 13px', border: 0, borderTop: i === 0 ? 'none' : '1px solid var(--bw-line)', background: '#fff', cursor: 'pointer', fontSize: 13, color: 'var(--bw-ink)', lineHeight: 1.35 }}
              >
                <span style={{ fontSize: 13, color: '#9AA8B4', flex: 'none' }}>⚲</span>
                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.label}</span>
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
};

const AdminPanel: React.FC<AdminPanelProps> = (props) => {
  const { centers, hotlines, alerts, reports, liveStream, onToggleLive, onClose } = props;
  const [tab, setTab] = React.useState<Tab>('shelters');
  const [editing, setEditing] = React.useState<{ id: number | null; form: FormValues } | null>(null);
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [page, setPage] = React.useState(0);

  const switchTab = (t: Tab): void => {
    setTab(t);
    setEditing(null);
    setError(null);
    setPage(0);
  };

  const startAdd = (): void => {
    setError(null);
    setEditing({ id: null, form: blankForm(tab) });
  };
  const startEdit = (id: number, rec: Record<string, unknown>): void => {
    setError(null);
    setEditing({ id, form: fillForm(tab, rec) });
  };

  const setField = (key: string, value: string | boolean): void =>
    setEditing((e) => (e ? { ...e, form: { ...e.form, [key]: value } } : e));

  const num = (v: string | boolean): number => (typeof v === 'boolean' ? 0 : Number(v));
  const str = (v: string | boolean): string => (typeof v === 'boolean' ? '' : v.trim());

  const buildPayload = (form: FormValues): unknown => {
    switch (tab) {
      case 'shelters':
        return { name: str(form.name), contact: str(form.contact), latitude: num(form.latitude), longitude: num(form.longitude) } satisfies NewCenter;
      case 'hotlines':
        return { name: str(form.name), phoneNumber: str(form.phoneNumber), description: str(form.description) || null, position: num(form.position) } satisfies NewHotline;
      case 'alerts':
        return { title: str(form.title), body: str(form.body), region: str(form.region) || null, level: str(form.level) as NewAlert['level'], active: !!form.active } satisfies NewAlert;
      case 'reports':
        return {
          name: str(form.name),
          district: str(form.district),
          latitude: num(form.latitude),
          longitude: num(form.longitude),
          severity: str(form.severity) as NewReport['severity'],
          depthCm: num(form.depthCm),
          trend: str(form.trend) as NewReport['trend'],
          road: str(form.road) as NewReport['road'],
          status: str(form.status) as ReportStatus,
        };
    }
  };

  const submit = async (): Promise<void> => {
    if (!editing) return;
    // Location-based records derive coordinates from a place search — require one before saving.
    if (FIELDS[tab].some((f) => f.type === 'place') && (editing.form.latitude === '' || editing.form.longitude === '')) {
      setError('Search and select a location.');
      return;
    }
    const payload = buildPayload(editing.form);
    setBusy(true);
    setError(null);
    try {
      const id = editing.id;
      if (tab === 'shelters') id == null ? await props.onCreateCenter(payload as NewCenter) : await props.onUpdateCenter(id, payload as Partial<NewCenter>);
      else if (tab === 'hotlines') id == null ? await props.onCreateHotline(payload as NewHotline) : await props.onUpdateHotline(id, payload as Partial<NewHotline>);
      else if (tab === 'alerts') id == null ? await props.onCreateAlert(payload as NewAlert) : await props.onUpdateAlert(id, payload as Partial<NewAlert>);
      else id == null ? await props.onCreateReport(payload as NewReport) : await props.onUpdateReport(id, payload as Partial<NewReport & { status: ReportStatus }>);
      setEditing(null);
    } catch {
      setError('Could not save. Please check the fields and try again.');
    } finally {
      setBusy(false);
    }
  };

  const remove = async (id: number): Promise<void> => {
    setBusy(true);
    setError(null);
    try {
      if (tab === 'shelters') await props.onDeleteCenter(id);
      else if (tab === 'hotlines') await props.onDeleteHotline(id);
      else if (tab === 'alerts') await props.onDeleteAlert(id);
      else await props.onDeleteReport(id);
    } catch {
      setError('Could not delete. Please try again.');
    } finally {
      setBusy(false);
    }
  };

  // Per-tab row { id, primary, secondary, rec }
  const rows = React.useMemo(() => {
    if (tab === 'shelters') return centers.map((c) => ({ id: c.id, primary: c.name, secondary: c.contact, rec: c as unknown as Record<string, unknown> }));
    if (tab === 'hotlines') return [...hotlines].sort((a, b) => a.position - b.position).map((h) => ({ id: h.id, primary: h.name, secondary: h.phoneNumber, rec: h as unknown as Record<string, unknown> }));
    if (tab === 'alerts') return alerts.map((a) => ({ id: a.id, primary: a.title, secondary: `${a.level.toUpperCase()} · ${a.active ? 'active' : 'inactive'}`, rec: a as unknown as Record<string, unknown> }));
    return [...reports]
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .map((r) => ({ id: r.id, primary: r.name, secondary: `${SEV_META[r.severity].label} · ${r.depthCm} cm · ${r.district}`, rec: r as unknown as Record<string, unknown> }));
  }, [tab, centers, hotlines, alerts, reports]);

  // Paginate the list (10 per page). Clamp the page if the row count shrinks (e.g. after a delete).
  const pageCount = Math.max(1, Math.ceil(rows.length / PAGE_SIZE));
  const safePage = Math.min(page, pageCount - 1);
  React.useEffect(() => {
    if (page !== safePage) setPage(safePage);
  }, [page, safePage]);
  const pagedRows = rows.slice(safePage * PAGE_SIZE, safePage * PAGE_SIZE + PAGE_SIZE);

  const tabs: Tab[] = ['shelters', 'hotlines', 'alerts', 'reports'];

  return (
    <div
      onClick={onClose}
      style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,.55)', backdropFilter: 'blur(3px)', zIndex: 1200, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 18 }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{ width: 560, maxWidth: '100%', maxHeight: '90vh', display: 'flex', flexDirection: 'column', background: '#fff', borderRadius: 20, boxShadow: '0 24px 70px rgba(15,23,42,.4)', overflow: 'hidden', animation: 'popIn .16s ease-out' }}
      >
        {/* Header */}
        <div style={{ background: 'linear-gradient(135deg,#0EA5E9,#0369A1)', padding: '16px 20px', color: '#fff', display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 18, fontWeight: 800 }}>Admin console</div>
            <div style={{ fontSize: 12, opacity: 0.9 }}>Manage shelters, hotlines, alerts &amp; reports</div>
          </div>
          <button onClick={onClose} style={{ border: 0, background: 'rgba(255,255,255,.18)', color: '#fff', width: 28, height: 28, borderRadius: 8, fontSize: 17, cursor: 'pointer' }}>×</button>
        </div>

        {/* Live-stream toggle */}
        <div style={{ padding: '13px 20px', borderBottom: '1px solid var(--bw-line-soft)', display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 13.5, fontWeight: 800 }}>Live activity stream</div>
            <div style={{ fontSize: 11.5, color: 'var(--bw-muted)' }}>Auto-refresh the map as reports &amp; alerts arrive (SSE).</div>
          </div>
          <button
            onClick={() => onToggleLive(!liveStream)}
            aria-pressed={liveStream}
            style={{ position: 'relative', width: 46, height: 26, borderRadius: 13, border: 0, cursor: 'pointer', background: liveStream ? 'var(--bw-primary)' : '#CBD5E1', transition: 'background .15s', flex: 'none' }}
          >
            <span style={{ position: 'absolute', top: 3, left: liveStream ? 23 : 3, width: 20, height: 20, borderRadius: '50%', background: '#fff', transition: 'left .15s', boxShadow: '0 1px 3px rgba(0,0,0,.3)' }} />
          </button>
        </div>

        {/* Tabs */}
        <div style={{ display: 'flex', gap: 4, padding: '10px 16px 0', borderBottom: '1px solid var(--bw-line-soft)' }}>
          {tabs.map((t) => (
            <button
              key={t}
              onClick={() => switchTab(t)}
              style={{ border: 0, background: 'transparent', padding: '8px 12px', fontSize: 13, fontWeight: 800, cursor: 'pointer', color: tab === t ? 'var(--bw-primary)' : 'var(--bw-muted)', borderBottom: `2px solid ${tab === t ? 'var(--bw-primary)' : 'transparent'}` }}
            >
              {TAB_LABEL[t]}
            </button>
          ))}
        </div>

        {/* Body */}
        <div style={{ padding: '14px 20px', overflowY: 'auto', flex: 1 }}>
          {error && (
            <div style={{ background: '#FEF2F2', color: '#B91C1C', padding: '8px 11px', borderRadius: 9, fontSize: 12.5, fontWeight: 600, marginBottom: 11 }}>{error}</div>
          )}

          {editing ? (
            <div>
              <div style={{ fontSize: 13.5, fontWeight: 800, marginBottom: 11 }}>
                {editing.id == null ? `Add ${TAB_LABEL[tab].toLowerCase().replace(/s$/, '')}` : `Edit ${TAB_LABEL[tab].toLowerCase().replace(/s$/, '')}`}
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 11 }}>
                {FIELDS[tab].map((f) => (
                  <label key={f.key} style={{ display: 'block' }}>
                    {f.type !== 'checkbox' && (
                      <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--bw-muted)', marginBottom: 4 }}>{f.label}</div>
                    )}
                    {f.type === 'place' ? (
                      <PlaceField
                        lat={String(editing.form.latitude ?? '')}
                        lng={String(editing.form.longitude ?? '')}
                        placeLabel={String(editing.form._place ?? '')}
                        onPick={(la, ln, label) => setEditing((e) => (e ? { ...e, form: { ...e.form, latitude: String(la), longitude: String(ln), _place: label } } : e))}
                      />
                    ) : f.type === 'textarea' ? (
                      <textarea value={String(editing.form[f.key] ?? '')} onChange={(e) => setField(f.key, e.target.value)} rows={3} style={{ ...inputStyle, resize: 'vertical' }} />
                    ) : f.type === 'select' ? (
                      <select value={String(editing.form[f.key] ?? '')} onChange={(e) => setField(f.key, e.target.value)} style={inputStyle}>
                        {f.options?.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                      </select>
                    ) : f.type === 'checkbox' ? (
                      <span style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, fontWeight: 700 }}>
                        <input type="checkbox" checked={!!editing.form[f.key]} onChange={(e) => setField(f.key, e.target.checked)} />
                        {f.label}
                      </span>
                    ) : (
                      <input type={f.type === 'number' ? 'number' : 'text'} value={String(editing.form[f.key] ?? '')} onChange={(e) => setField(f.key, e.target.value)} style={inputStyle} />
                    )}
                  </label>
                ))}
              </div>
              <div style={{ display: 'flex', gap: 9, marginTop: 16 }}>
                <button onClick={() => void submit()} disabled={busy} style={{ flex: 1, border: 0, background: 'var(--bw-primary)', color: '#fff', padding: 11, borderRadius: 10, fontSize: 13.5, fontWeight: 800, cursor: busy ? 'wait' : 'pointer', opacity: busy ? 0.7 : 1 }}>
                  {busy ? 'Saving…' : 'Save'}
                </button>
                <button onClick={() => setEditing(null)} disabled={busy} style={{ border: '1px solid var(--bw-line)', background: '#fff', color: 'var(--bw-ink-soft)', padding: '11px 16px', borderRadius: 10, fontSize: 13.5, fontWeight: 700, cursor: 'pointer' }}>
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <div>
              <button onClick={startAdd} style={{ width: '100%', border: '1px dashed var(--bw-primary)', background: '#EFF8FF', color: 'var(--bw-primary)', padding: 10, borderRadius: 10, fontSize: 13, fontWeight: 800, cursor: 'pointer', marginBottom: 12 }}>
                + Add {TAB_LABEL[tab].toLowerCase().replace(/s$/, '')}
              </button>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
                {rows.length === 0 && <div style={{ fontSize: 12.5, color: 'var(--bw-muted)', textAlign: 'center', padding: 14 }}>No records yet.</div>}
                {pagedRows.map((r) => (
                  <div key={r.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', background: '#F7FAFB', borderRadius: 11 }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 13, fontWeight: 800, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{r.primary}</div>
                      <div style={{ fontSize: 11.5, color: 'var(--bw-muted)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{r.secondary}</div>
                    </div>
                    <button onClick={() => startEdit(r.id, r.rec)} disabled={busy} style={{ border: '1px solid var(--bw-line)', background: '#fff', color: 'var(--bw-ink-soft)', padding: '6px 11px', borderRadius: 8, fontSize: 12, fontWeight: 700, cursor: 'pointer', flex: 'none' }}>
                      Edit
                    </button>
                    <button onClick={() => void remove(r.id)} disabled={busy} style={{ border: '1px solid #FECACA', background: '#FEF2F2', color: '#DC2626', padding: '6px 11px', borderRadius: 8, fontSize: 12, fontWeight: 700, cursor: 'pointer', flex: 'none' }}>
                      Delete
                    </button>
                  </div>
                ))}
              </div>

              {pageCount > 1 && (
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, marginTop: 12 }}>
                  <button
                    onClick={() => setPage((p) => Math.max(0, p - 1))}
                    disabled={safePage === 0}
                    style={{ border: '1px solid var(--bw-line)', background: '#fff', color: 'var(--bw-ink-soft)', padding: '7px 13px', borderRadius: 9, fontSize: 12.5, fontWeight: 700, cursor: safePage === 0 ? 'default' : 'pointer', opacity: safePage === 0 ? 0.45 : 1 }}
                  >
                    ← Prev
                  </button>
                  <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--bw-muted)' }}>
                    Page {safePage + 1} of {pageCount} · {rows.length} total
                  </span>
                  <button
                    onClick={() => setPage((p) => Math.min(pageCount - 1, p + 1))}
                    disabled={safePage >= pageCount - 1}
                    style={{ border: '1px solid var(--bw-line)', background: '#fff', color: 'var(--bw-ink-soft)', padding: '7px 13px', borderRadius: 9, fontSize: 12.5, fontWeight: 700, cursor: safePage >= pageCount - 1 ? 'default' : 'pointer', opacity: safePage >= pageCount - 1 ? 0.45 : 1 }}
                  >
                    Next →
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default AdminPanel;
