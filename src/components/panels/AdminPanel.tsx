import React from 'react';
import type {
  EvacuationCenter,
  Feedback,
  FeedbackStatus,
  FloodAlert,
  FloodProneArea,
  FloodReport,
  Hotline,
  NewAlert,
  NewCenter,
  NewFloodProneArea,
  NewHotline,
  NewReport,
  ReportStatus,
} from '../../types';
import { ROAD_META, ROAD_ORDER, SEV_META, TREND_META } from '../../utils/floodMeta';
import { timeAgo } from '../../utils/format';
import { reverseGeocode } from '../../api/geocode';
import PlaceField from './PlaceField';
import MapPickField from './MapPickField';

type Tab = 'shelters' | 'hotlines' | 'alerts' | 'zones' | 'reports' | 'requests';

interface AdminPanelProps {
  centers: EvacuationCenter[];
  hotlines: Hotline[];
  alerts: FloodAlert[];
  zones: FloodProneArea[];
  reports: FloodReport[];
  liveStream: boolean;
  onToggleLive: (on: boolean) => void;
  /** Global (server-backed) toggle for the floating community-chat bubble. */
  chatEnabled: boolean;
  onToggleChat: (on: boolean) => void;
  onCreateCenter: (b: NewCenter) => Promise<void>;
  onUpdateCenter: (id: number, b: Partial<NewCenter>) => Promise<void>;
  onDeleteCenter: (id: number) => Promise<void>;
  onCreateHotline: (b: NewHotline) => Promise<void>;
  onUpdateHotline: (id: number, b: Partial<NewHotline>) => Promise<void>;
  onDeleteHotline: (id: number) => Promise<void>;
  onCreateAlert: (b: NewAlert) => Promise<void>;
  onUpdateAlert: (id: number, b: Partial<NewAlert>) => Promise<void>;
  onDeleteAlert: (id: number) => Promise<void>;
  onCreateZone: (b: NewFloodProneArea) => Promise<void>;
  onUpdateZone: (id: number, b: Partial<NewFloodProneArea>) => Promise<void>;
  onDeleteZone: (id: number) => Promise<void>;
  /** Row-level "⚠ Warn" trigger — opens the (separately mounted) confirm modal for this zone. Never
   *  fires the warning itself; that's an explicit second action in the modal. */
  onWarnZone: (zone: FloodProneArea) => void;
  onCreateReport: (b: NewReport) => Promise<void>;
  onUpdateReport: (id: number, b: Partial<NewReport & { status: ReportStatus }>) => Promise<void>;
  onDeleteReport: (id: number) => Promise<void>;
  feedback: Feedback[];
  onUpdateFeedbackStatus: (id: number, status: FeedbackStatus) => Promise<void>;
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
  zones: [
    { key: 'name', label: 'Name', type: 'text' },
    { key: 'district', label: 'District', type: 'text' },
    { key: 'location', label: 'Location', type: 'place' },
    { key: 'radiusM', label: 'Radius (m)', type: 'number' },
    { key: 'level', label: 'Level', type: 'select', options: levelOptions },
    { key: 'note', label: 'Note', type: 'textarea' },
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
  requests: [],
};

const TAB_LABEL: Record<Tab, string> = {
  shelters: 'Shelters',
  hotlines: 'Hotlines',
  alerts: 'Alerts',
  zones: 'Zones',
  reports: 'Reports',
  requests: 'Requests',
};

const STATUS_ORDER: Record<FeedbackStatus, number> = { pending: 0, accepted: 1, declined: 2 };
const STATUS_PILL: Record<FeedbackStatus, { bg: string; fg: string }> = {
  pending:  { bg: 'var(--bw-bg-subtle)', fg: 'var(--bw-ink-soft)' },
  accepted: { bg: '#F0FDF4', fg: '#15803D' },
  declined: { bg: '#FEF2F2', fg: '#B91C1C' },
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
    else if (tab === 'zones' && f.key === 'radiusM') v.radiusM = '500';
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


const AdminPanel: React.FC<AdminPanelProps> = (props) => {
  const { centers, hotlines, alerts, zones, reports, liveStream, onToggleLive, chatEnabled, onToggleChat, onClose } = props;
  const [tab, setTab] = React.useState<Tab>('shelters');
  const [editing, setEditing] = React.useState<{ id: number | null; form: FormValues } | null>(null);
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [page, setPage] = React.useState(0);
  const [actingId, setActingId] = React.useState<number | null>(null);
  // Abort an in-flight reverse-geocode when a newer pick supersedes it or the panel unmounts —
  // same AbortController-ref pattern as AdminReportIncidentModal.tsx.
  const geocodeAbortRef = React.useRef<AbortController | null>(null);
  React.useEffect(() => () => geocodeAbortRef.current?.abort(), []);
  const moderate = async (id: number, status: FeedbackStatus): Promise<void> => {
    setActingId(id);
    try { await props.onUpdateFeedbackStatus(id, status); } finally { setActingId(null); }
  };
  const sortedFeedback = React.useMemo(
    () => [...props.feedback].sort(
      (a, b) => STATUS_ORDER[a.status] - STATUS_ORDER[b.status] || new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    ),
    [props.feedback]
  );

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

  /**
   * Single handler behind BOTH the shared `type: 'place'` field's `PlaceField` (search/current
   * location) and its `MapPickField` (click-to-move mini-map beneath it) — one pin, two ways to
   * set it. Always writes latitude/longitude/`_place`; then, for tabs whose `FIELDS` actually
   * carry a `name`/`district` key (zones, reports, shelters — NOT hotlines, which has neither),
   * reverse-geocodes the point and fills them in.
   *
   * `force` is false for every ordinary pick/drag: it only fills a field that is still blank, so
   * fine-tuning a pin after the admin has typed their own name never clobbers it — the same
   * clobbering bug fixed in AdminReportIncidentModal is deliberately not reproduced here. `force`
   * is true only for the explicit "Resolve name from pin" button, so an admin who *wants* the
   * overwrite has a one-click way to ask for it.
   */
  const pickLocation = (la: number, ln: number, label = '', force = false): void => {
    setEditing((e) => (e ? { ...e, form: { ...e.form, latitude: String(la), longitude: String(ln), _place: label || String(e.form._place ?? '') } } : e));

    const hasNameField = FIELDS[tab].some((f) => f.key === 'name');
    const hasDistrictField = FIELDS[tab].some((f) => f.key === 'district');
    if (!hasNameField && !hasDistrictField) return; // e.g. hotlines — no-op by design

    geocodeAbortRef.current?.abort();
    const ac = new AbortController();
    geocodeAbortRef.current = ac;
    void reverseGeocode(la, ln, ac.signal).then((g) => {
      if (ac.signal.aborted) return;
      setEditing((e) => {
        if (!e) return e;
        const next = { ...e.form };
        if (hasNameField) {
          const resolved = g.road ?? g.barangay ?? label.split(',')[0]?.trim() ?? '';
          if (resolved && (force || String(next.name ?? '').trim() === '')) next.name = resolved;
        }
        if (hasDistrictField && g.district && (force || String(next.district ?? '').trim() === '')) {
          next.district = g.district;
        }
        return { ...e, form: next };
      });
    });
  };

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
      case 'zones':
        return {
          name: str(form.name),
          district: str(form.district),
          latitude: num(form.latitude),
          longitude: num(form.longitude),
          radiusM: num(form.radiusM) || 500,
          level: str(form.level) as NewFloodProneArea['level'],
          note: str(form.note) || null,
          active: !!form.active,
        } satisfies NewFloodProneArea;
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
      else if (tab === 'zones') id == null ? await props.onCreateZone(payload as NewFloodProneArea) : await props.onUpdateZone(id, payload as Partial<NewFloodProneArea>);
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
      else if (tab === 'zones') await props.onDeleteZone(id);
      else await props.onDeleteReport(id);
    } catch {
      setError('Could not delete. Please try again.');
    } finally {
      setBusy(false);
    }
  };

  // Per-tab row { id, primary, secondary, rec }
  const rows = React.useMemo(() => {
    if (tab === 'requests') return [];
    if (tab === 'shelters') return centers.map((c) => ({ id: c.id, primary: c.name, secondary: c.contact, rec: c as unknown as Record<string, unknown> }));
    if (tab === 'hotlines') return [...hotlines].sort((a, b) => a.position - b.position).map((h) => ({ id: h.id, primary: h.name, secondary: h.phoneNumber, rec: h as unknown as Record<string, unknown> }));
    if (tab === 'alerts') return alerts.map((a) => ({ id: a.id, primary: a.title, secondary: `${a.level.toUpperCase()} · ${a.active ? 'active' : 'inactive'}`, rec: a as unknown as Record<string, unknown> }));
    if (tab === 'zones') return zones.map((z) => ({ id: z.id, primary: z.name, secondary: `${z.district} · ${z.radiusM} m · ${z.level.toUpperCase()}${z.active ? '' : ' · inactive'}`, rec: z as unknown as Record<string, unknown> }));
    return [...reports]
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .map((r) => ({ id: r.id, primary: r.name, secondary: `${SEV_META[r.severity].label} · ${r.depthCm} cm · ${r.district}`, rec: r as unknown as Record<string, unknown> }));
  }, [tab, centers, hotlines, alerts, zones, reports]);

  // Paginate the list (10 per page). Clamp the page if the row count shrinks (e.g. after a delete).
  const pageCount = Math.max(1, Math.ceil(rows.length / PAGE_SIZE));
  const safePage = Math.min(page, pageCount - 1);
  React.useEffect(() => {
    if (page !== safePage) setPage(safePage);
  }, [page, safePage]);
  const pagedRows = rows.slice(safePage * PAGE_SIZE, safePage * PAGE_SIZE + PAGE_SIZE);

  const tabs: Tab[] = ['shelters', 'hotlines', 'alerts', 'zones', 'reports', 'requests'];

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
            <div style={{ fontSize: 12, opacity: 0.9 }}>Manage shelters, hotlines, alerts, reports &amp; requests</div>
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

        {/* Community chat toggle — global (server-backed), unlike the per-browser live-stream pref above */}
        <div style={{ padding: '13px 20px', borderBottom: '1px solid var(--bw-line-soft)', display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 13.5, fontWeight: 800 }}>Community chat button</div>
            <div style={{ fontSize: 11.5, color: 'var(--bw-muted)' }}>Show the floating chat bubble to everyone, everywhere in the app.</div>
          </div>
          <button
            onClick={() => onToggleChat(!chatEnabled)}
            aria-pressed={chatEnabled}
            style={{ position: 'relative', width: 46, height: 26, borderRadius: 13, border: 0, cursor: 'pointer', background: chatEnabled ? 'var(--bw-primary)' : '#CBD5E1', transition: 'background .15s', flex: 'none' }}
          >
            <span style={{ position: 'absolute', top: 3, left: chatEnabled ? 23 : 3, width: 20, height: 20, borderRadius: '50%', background: '#fff', transition: 'left .15s', boxShadow: '0 1px 3px rgba(0,0,0,.3)' }} />
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

          {tab === 'requests' ? (
            <div>
              {sortedFeedback.length === 0 && (
                <div style={{ fontSize: 12.5, color: 'var(--bw-muted)', textAlign: 'center', padding: 14 }}>No feedback yet.</div>
              )}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {sortedFeedback.map((f) => {
                  const acting = actingId === f.id;
                  const isFeature = f.type === 'feature';
                  const sc = STATUS_PILL[f.status];
                  return (
                    <div key={f.id} style={{ padding: '11px 12px', background: '#F7FAFB', borderRadius: 11, border: '1px solid var(--bw-line-soft)' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 5 }}>
                        <span style={{ fontSize: 11, fontWeight: 800, padding: '2px 8px', borderRadius: 999, background: isFeature ? '#EFF8FF' : '#FEF2F2', color: isFeature ? 'var(--bw-primary)' : '#DC2626' }}>
                          {isFeature ? '💡 Feature' : '🐞 Bug'}
                        </span>
                        <span style={{ fontSize: 11, fontWeight: 800, padding: '2px 8px', borderRadius: 999, background: sc.bg, color: sc.fg, textTransform: 'capitalize' }}>{f.status}</span>
                        <span title={`${f.upvotes} upvote${f.upvotes === 1 ? '' : 's'}`} style={{ fontSize: 11, fontWeight: 800, padding: '2px 8px', borderRadius: 999, background: '#EFF8FF', color: 'var(--bw-primary)' }}>▲ {f.upvotes}</span>
                        <span style={{ marginLeft: 'auto', fontSize: 11, color: 'var(--bw-faint)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '40%' }}>{f.submitterName ?? 'Someone'}</span>
                      </div>
                      <div style={{ fontSize: 13.5, fontWeight: 800, color: 'var(--bw-ink)' }}>{f.title}</div>
                      {f.details && <div style={{ fontSize: 12, color: 'var(--bw-muted)', lineHeight: 1.45, marginTop: 2 }}>{f.details}</div>}
                      <div style={{ display: 'flex', gap: 8, marginTop: 9 }}>
                        {f.status !== 'accepted' && (
                          <button onClick={() => void moderate(f.id, 'accepted')} disabled={acting} style={{ border: '1px solid #BBF7D0', background: '#F0FDF4', color: '#15803D', padding: '6px 13px', borderRadius: 8, fontSize: 12, fontWeight: 800, cursor: acting ? 'wait' : 'pointer' }}>Accept</button>
                        )}
                        {f.status !== 'declined' && (
                          <button onClick={() => void moderate(f.id, 'declined')} disabled={acting} style={{ border: '1px solid #FECACA', background: '#FEF2F2', color: '#DC2626', padding: '6px 13px', borderRadius: 8, fontSize: 12, fontWeight: 800, cursor: acting ? 'wait' : 'pointer' }}>Decline</button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ) : editing ? (
            <div>
              <div style={{ fontSize: 13.5, fontWeight: 800, marginBottom: 11 }}>
                {editing.id == null ? `Add ${TAB_LABEL[tab].toLowerCase().replace(/s$/, '')}` : `Edit ${TAB_LABEL[tab].toLowerCase().replace(/s$/, '')}`}
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 11 }}>
                {FIELDS[tab].map((f) => {
                  // A `place` field is wrapped in a plain div, not a label: it now contains a
                  // Leaflet mini-map, and clicking inside a <label> activates the label's first
                  // form control — which would yank focus to the search box on every map click
                  // and fight the marker drag.
                  const Wrap = f.type === 'place' ? 'div' : 'label';
                  return (
                  <Wrap key={f.key} style={{ display: 'block' }}>
                    {f.type !== 'checkbox' && (
                      <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--bw-muted)', marginBottom: 4 }}>{f.label}</div>
                    )}
                    {f.type === 'place' ? (
                      <>
                        <PlaceField
                          lat={String(editing.form.latitude ?? '')}
                          lng={String(editing.form.longitude ?? '')}
                          placeLabel={String(editing.form._place ?? '')}
                          onPick={(la, ln, label) => pickLocation(la, ln, label)}
                        />
                        {/* Guarded on finite numbers, not just non-empty: a half-filled or
                            malformed record would otherwise mount Leaflet at NaN/NaN. */}
                        {Number.isFinite(Number(editing.form.latitude || NaN)) && Number.isFinite(Number(editing.form.longitude || NaN)) && (
                          <div style={{ marginTop: 8 }}>
                            <MapPickField
                              lat={Number(editing.form.latitude)}
                              lng={Number(editing.form.longitude)}
                              onPick={(la, ln) => pickLocation(la, ln)}
                            />
                            {(FIELDS[tab].some((ff) => ff.key === 'name') || FIELDS[tab].some((ff) => ff.key === 'district')) && (
                              <button
                                type="button"
                                onClick={() => pickLocation(Number(editing.form.latitude), Number(editing.form.longitude), String(editing.form._place ?? ''), true)}
                                style={{ marginTop: 6, border: '1px solid var(--bw-line)', background: '#fff', color: 'var(--bw-ink-soft)', padding: '6px 11px', borderRadius: 8, fontSize: 11.5, fontWeight: 700, cursor: 'pointer' }}
                              >
                                Resolve name from pin
                              </button>
                            )}
                          </div>
                        )}
                      </>
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
                  </Wrap>
                  );
                })}
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
                {pagedRows.map((r) => {
                  const zoneRec = tab === 'zones' ? (r.rec as unknown as FloodProneArea) : null;
                  return (
                  <div key={r.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', background: '#F7FAFB', borderRadius: 11 }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 13, fontWeight: 800, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{r.primary}</div>
                      <div style={{ fontSize: 11.5, color: 'var(--bw-muted)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{r.secondary}</div>
                      {zoneRec && (
                        <div style={{ fontSize: 10.5, color: 'var(--bw-faint)', marginTop: 2 }}>
                          {zoneRec.lastWarnedAt ? `Last warned ${timeAgo(zoneRec.lastWarnedAt)}` : 'Never warned'}
                        </div>
                      )}
                    </div>
                    {zoneRec && (
                      <button onClick={() => props.onWarnZone(zoneRec)} disabled={busy} title="Send a flood warning for this zone" style={{ border: '1px solid #FED7AA', background: '#FFF7ED', color: '#C2410C', padding: '6px 11px', borderRadius: 8, fontSize: 12, fontWeight: 700, cursor: 'pointer', flex: 'none' }}>
                        ⚠ Warn
                      </button>
                    )}
                    <button onClick={() => startEdit(r.id, r.rec)} disabled={busy} style={{ border: '1px solid var(--bw-line)', background: '#fff', color: 'var(--bw-ink-soft)', padding: '6px 11px', borderRadius: 8, fontSize: 12, fontWeight: 700, cursor: 'pointer', flex: 'none' }}>
                      Edit
                    </button>
                    <button onClick={() => void remove(r.id)} disabled={busy} style={{ border: '1px solid #FECACA', background: '#FEF2F2', color: '#DC2626', padding: '6px 11px', borderRadius: 8, fontSize: 12, fontWeight: 700, cursor: 'pointer', flex: 'none' }}>
                      Delete
                    </button>
                  </div>
                  );
                })}
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
