import React from 'react';
import type {
  EvacuationCenter,
  Feedback,
  FeedbackStatus,
  FloodAlert,
  FloodProneArea,
  Hotline,
  LatLng,
  NewAlert,
  NewCenter,
  NewFloodProneArea,
  NewHotline,
  NewReport,
  ReportStatus,
  SocialNetwork,
  SocialPost,
} from '../../types';
import { ROAD_META, ROAD_ORDER, SEV_META, TREND_META, drainMinutes } from '../../utils/floodMeta';
import { type EnrichedReport, matchingProneZone } from '../../utils/viewModel';
import { formatDepth, timeAgo } from '../../utils/format';
import { FB_GLYPH_PATH } from '../../utils/share';
import { reverseGeocode } from '../../api/geocode';
import PlaceField from './PlaceField';
import MapPickField from './MapPickField';

type Tab = 'shelters' | 'hotlines' | 'alerts' | 'zones' | 'reports' | 'requests';

interface AdminPanelProps {
  /** User's current location — softly biases the location fields' place search toward nearby spots. */
  userLoc: LatLng;
  centers: EvacuationCenter[];
  hotlines: Hotline[];
  alerts: FloodAlert[];
  zones: FloodProneArea[];
  /** Enriched, not raw — gives the Reports tab `r.expired` for the row's Reopen button without
   *  duplicating the expiry math. `buildPayload` still picks fields by name, so no derived field
   *  (expired, projectedDepthCm, …) can leak into a PATCH body. */
  reports: EnrichedReport[];
  liveStream: boolean;
  onToggleLive: (on: boolean) => void;
  /** Global (server-backed) toggle for the floating community-chat bubble. */
  chatEnabled: boolean;
  onToggleChat: (on: boolean) => void;
  /** Global kill switches for the social auto-post feature — one per network. */
  socialAutopostFacebook: boolean;
  socialAutopostX: boolean;
  onToggleSocialAutopost: (network: SocialNetwork, on: boolean) => void;
  /** Global "rain is falling now" flag — flips the predictive water-level model from receding to
   *  rising for every report. Default false, unlike the toggles above. */
  rainActive: boolean;
  onToggleRain: (on: boolean) => void;
  /** Recent auto-post attempts, newest first — surfaced in the Reports tab. */
  socialPosts: SocialPost[];
  onRetrySocialPost: (id: number) => void;
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
  /** Opens the (separately mounted) ZoneReportModal — omit the argument for the tab-level bulk
   *  button, pass a zone for a row's "⚡ Report now" action (preselects just that one). */
  onReportZones: (preselect?: FloodProneArea) => void;
  /** Opens the (separately mounted) AdminScopedWarnModal — the cascading island/province/city/area
   *  bulk-warn tool, distinct from onWarnZone's single-zone confirm modal. */
  onScopedWarn: () => void;
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
    { key: 'ttlMinutes', label: 'Keep live for (min)', type: 'number' },
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

const SEARCH_PLACEHOLDER: Record<Tab, string> = {
  shelters: 'Search a shelter…',
  hotlines: 'Search a hotline…',
  alerts: 'Search an alert…',
  zones: 'Search a zone or city…',
  reports: 'Search a report or area…',
  requests: 'Search a request title or sender…',
};

const STATUS_ORDER: Record<FeedbackStatus, number> = { pending: 0, accepted: 1, declined: 2 };
const STATUS_PILL: Record<FeedbackStatus, { bg: string; fg: string }> = {
  pending:  { bg: 'var(--bw-bg-subtle)', fg: 'var(--bw-ink-soft)' },
  accepted: { bg: 'var(--bw-tint-ok)', fg: 'var(--bw-on-tint-ok)' },
  declined: { bg: 'var(--bw-tint-danger)', fg: 'var(--bw-on-tint-danger)' },
};

const SOCIAL_STATUS_PILL: Record<SocialPost['status'], { bg: string; fg: string }> = {
  pending: { bg: 'var(--bw-bg-subtle)', fg: 'var(--bw-ink-soft)' },
  sent:    { bg: 'var(--bw-tint-ok)', fg: 'var(--bw-on-tint-ok)' },
  failed:  { bg: 'var(--bw-tint-danger)', fg: 'var(--bw-on-tint-danger)' },
  skipped: { bg: 'var(--bw-tint-warn)', fg: 'var(--bw-on-tint-warn)' },
};
const SOCIAL_NETWORK_LABEL: Record<SocialNetwork, string> = { facebook: 'Facebook', x: 'X' };

const PAGE_SIZE = 10;

/** One uniform row shape every tab's list (except requests, which has its own card layout) maps
 *  into — explicit here because the per-tab `.map()` branches below would otherwise widen `rows`
 *  to a union of five distinct array types, and unions of arrays don't have a `.filter` in common. */
type AdminRow = { id: number; primary: string; secondary: string; rec: Record<string, unknown> };

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
  background: 'var(--bw-surface-sunken)',
  boxSizing: 'border-box',
};


const AdminPanel: React.FC<AdminPanelProps> = (props) => {
  const {
    centers, hotlines, alerts, zones, reports, liveStream, onToggleLive, chatEnabled, onToggleChat,
    socialAutopostFacebook, socialAutopostX, onToggleSocialAutopost, rainActive, onToggleRain,
    socialPosts, onRetrySocialPost, onClose,
  } = props;
  const [tab, setTab] = React.useState<Tab>('shelters');
  const [editing, setEditing] = React.useState<{ id: number | null; form: FormValues } | null>(null);
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [page, setPage] = React.useState(0);
  const [query, setQuery] = React.useState('');
  const q = query.trim().toLowerCase();
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
  // Requests tab has its own card layout (not the shared `rows` model), so it gets its own filter
  // over the fields a request search plausibly means: title, details, sender, type, status.
  const visibleFeedback = React.useMemo(
    () => (q ? sortedFeedback.filter((f) =>
      f.title.toLowerCase().includes(q) ||
      (f.details ?? '').toLowerCase().includes(q) ||
      (f.submitterName ?? '').toLowerCase().includes(q) ||
      f.type.toLowerCase().includes(q) ||
      f.status.toLowerCase().includes(q)
    ) : sortedFeedback),
    [sortedFeedback, q]
  );

  const switchTab = (t: Tab): void => {
    setTab(t);
    setEditing(null);
    setError(null);
    setPage(0);
    setQuery('');
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
          // Blank ⇒ omit the key so the save leaves the column unchanged rather than clearing the
          // TTL back to the severity default — same "null/absent = unchanged" rule the DTO documents.
          ttlMinutes: num(form.ttlMinutes) || undefined,
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
    // Zones only: refuse to create a zone on top of an existing one's advisory circle — that place
    // is already covered, so a second row would just split it across two records. Never PATCH the
    // matched zone instead: its level/note/radius are admin-curated and must not be silently
    // rewritten by what's meant to be a duplicate-prevention check.
    //
    // Deliberately scoped to a create, or an edit that MOVES the pin. A plain edit (rename, retune
    // the radius, deactivate) must always go through, even when the zone overlaps another — the
    // duplicates this guard was added to stop already exist in the data, and blocking their edit
    // would leave delete as the only way to clean them up. `excludeId` still keeps a move from
    // tripping over the row's own circle.
    if (tab === 'zones') {
      const loc = { lat: num(editing.form.latitude), lng: num(editing.form.longitude) };
      const before = editing.id == null ? undefined : zones.find((z) => z.id === editing.id);
      const moved = before != null && (before.latitude !== loc.lat || before.longitude !== loc.lng);
      const dup = editing.id == null || moved ? matchingProneZone(zones, loc, editing.id ?? undefined) : undefined;
      if (dup) {
        setError(`That location is already covered by the flood-prone zone “${dup.name}”. Edit that zone instead of adding a duplicate.`);
        return;
      }
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
  const rows = React.useMemo<AdminRow[]>(() => {
    if (tab === 'requests') return [];
    if (tab === 'shelters') return centers.map((c) => ({ id: c.id, primary: c.name, secondary: c.contact, rec: c as unknown as Record<string, unknown> }));
    if (tab === 'hotlines') return [...hotlines].sort((a, b) => a.position - b.position).map((h) => ({ id: h.id, primary: h.name, secondary: h.phoneNumber, rec: h as unknown as Record<string, unknown> }));
    if (tab === 'alerts') return alerts.map((a) => ({ id: a.id, primary: a.title, secondary: `${a.level.toUpperCase()} · ${a.active ? 'active' : 'inactive'}`, rec: a as unknown as Record<string, unknown> }));
    if (tab === 'zones') return zones.map((z) => ({ id: z.id, primary: z.name, secondary: `${z.district} · ${z.radiusM} m · ${z.level.toUpperCase()}${z.active ? '' : ' · inactive'}`, rec: z as unknown as Record<string, unknown> }));
    return [...reports]
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .map((r) => ({ id: r.id, primary: r.name, secondary: `${SEV_META[r.severity].label} · ${formatDepth(r.depthCm)} · ${r.district}`, rec: r as unknown as Record<string, unknown> }));
  }, [tab, centers, hotlines, alerts, zones, reports]);

  // Search filters on primary (name) + secondary (detail line, e.g. a zone's "City, Province"
  // district) — the same two fields every tab's row already surfaces, so one box covers all six.
  const visibleRows = React.useMemo(
    () => (q ? rows.filter((r) =>
      r.primary.toLowerCase().includes(q) || r.secondary.toLowerCase().includes(q)) : rows),
    [rows, q]
  );

  // Paginate the list (10 per page). Clamp the page if the row count shrinks (e.g. after a delete
  // or a search that narrows the set).
  const pageCount = Math.max(1, Math.ceil(visibleRows.length / PAGE_SIZE));
  const safePage = Math.min(page, pageCount - 1);
  React.useEffect(() => {
    if (page !== safePage) setPage(safePage);
  }, [page, safePage]);
  const pagedRows = visibleRows.slice(safePage * PAGE_SIZE, safePage * PAGE_SIZE + PAGE_SIZE);

  const tabs: Tab[] = ['shelters', 'hotlines', 'alerts', 'zones', 'reports', 'requests'];

  return (
    <div
      onClick={onClose}
      style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,.55)', backdropFilter: 'blur(3px)', zIndex: 1200, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 18 }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{ width: 560, maxWidth: '100%', maxHeight: '90vh', display: 'flex', flexDirection: 'column', background: 'var(--bw-surface-raised)', borderRadius: 20, boxShadow: '0 24px 70px rgba(15,23,42,.4)', overflow: 'hidden', animation: 'popIn .16s ease-out' }}
      >
        {/* Header */}
        <div style={{ background: 'linear-gradient(135deg,var(--bw-primary),var(--bw-primary-deep))', padding: '16px 20px', color: 'var(--bw-on-accent)', display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 18, fontWeight: 800 }}>Admin console</div>
            <div style={{ fontSize: 12, opacity: 0.9 }}>Manage shelters, hotlines, alerts, reports &amp; requests</div>
          </div>
          <button onClick={onClose} style={{ border: 0, background: 'rgba(255,255,255,.18)', color: 'var(--bw-on-accent)', width: 28, height: 28, borderRadius: 8, fontSize: 17, cursor: 'pointer' }}>×</button>
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
            style={{ position: 'relative', width: 46, height: 26, borderRadius: 13, border: 0, cursor: 'pointer', background: liveStream ? 'var(--bw-primary)' : 'var(--bw-line-strong)', transition: 'background .15s', flex: 'none' }}
          >
            <span style={{ position: 'absolute', top: 3, left: liveStream ? 23 : 3, width: 20, height: 20, borderRadius: '50%', background: 'var(--bw-surface)', transition: 'left .15s', boxShadow: '0 1px 3px rgba(0,0,0,.3)' }} />
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
            style={{ position: 'relative', width: 46, height: 26, borderRadius: 13, border: 0, cursor: 'pointer', background: chatEnabled ? 'var(--bw-primary)' : 'var(--bw-line-strong)', transition: 'background .15s', flex: 'none' }}
          >
            <span style={{ position: 'absolute', top: 3, left: chatEnabled ? 23 : 3, width: 20, height: 20, borderRadius: '50%', background: 'var(--bw-surface)', transition: 'left .15s', boxShadow: '0 1px 3px rgba(0,0,0,.3)' }} />
          </button>
        </div>

        {/* Auto-post kill switches — global; the per-report toggle in the incident modal only
            takes effect when its network is also enabled here. */}
        <div style={{ padding: '13px 20px', borderBottom: '1px solid var(--bw-line-soft)', display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 13.5, fontWeight: 800 }}>Auto-post to Facebook</div>
            <div style={{ fontSize: 11.5, color: 'var(--bw-muted)' }}>System reports post to the FloodedArea Facebook Page automatically.</div>
          </div>
          <button
            onClick={() => onToggleSocialAutopost('facebook', !socialAutopostFacebook)}
            aria-pressed={socialAutopostFacebook}
            style={{ position: 'relative', width: 46, height: 26, borderRadius: 13, border: 0, cursor: 'pointer', background: socialAutopostFacebook ? 'var(--bw-primary)' : 'var(--bw-line-strong)', transition: 'background .15s', flex: 'none' }}
          >
            <span style={{ position: 'absolute', top: 3, left: socialAutopostFacebook ? 23 : 3, width: 20, height: 20, borderRadius: '50%', background: 'var(--bw-surface)', transition: 'left .15s', boxShadow: '0 1px 3px rgba(0,0,0,.3)' }} />
          </button>
        </div>
        <div style={{ padding: '13px 20px', borderBottom: '1px solid var(--bw-line-soft)', display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 13.5, fontWeight: 800 }}>Auto-post to X</div>
            <div style={{ fontSize: 11.5, color: 'var(--bw-muted)' }}>System reports post to the FloodedArea X account automatically.</div>
          </div>
          <button
            onClick={() => onToggleSocialAutopost('x', !socialAutopostX)}
            aria-pressed={socialAutopostX}
            style={{ position: 'relative', width: 46, height: 26, borderRadius: 13, border: 0, cursor: 'pointer', background: socialAutopostX ? 'var(--bw-primary)' : 'var(--bw-line-strong)', transition: 'background .15s', flex: 'none' }}
          >
            <span style={{ position: 'absolute', top: 3, left: socialAutopostX ? 23 : 3, width: 20, height: 20, borderRadius: '50%', background: 'var(--bw-surface)', transition: 'left .15s', boxShadow: '0 1px 3px rgba(0,0,0,.3)' }} />
          </button>
        </div>

        {/* Rain toggle — flips the predictive water-level model on every report from receding to
            rising. Default off; see AppSettings.rainActive. */}
        <div style={{ padding: '13px 20px', borderBottom: '1px solid var(--bw-line-soft)', display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 13.5, fontWeight: 800 }}>Rain is falling now</div>
            <div style={{ fontSize: 11.5, color: 'var(--bw-muted)' }}>Water levels are projected to keep rising instead of receding. Predictive — not measured.</div>
          </div>
          <button
            onClick={() => onToggleRain(!rainActive)}
            aria-pressed={rainActive}
            style={{ position: 'relative', width: 46, height: 26, borderRadius: 13, border: 0, cursor: 'pointer', background: rainActive ? 'var(--bw-primary)' : 'var(--bw-line-strong)', transition: 'background .15s', flex: 'none' }}
          >
            <span style={{ position: 'absolute', top: 3, left: rainActive ? 23 : 3, width: 20, height: 20, borderRadius: '50%', background: 'var(--bw-surface)', transition: 'left .15s', boxShadow: '0 1px 3px rgba(0,0,0,.3)' }} />
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
            <div style={{ background: 'var(--bw-tint-danger)', color: 'var(--bw-on-tint-danger)', padding: '8px 11px', borderRadius: 9, fontSize: 12.5, fontWeight: 600, marginBottom: 11 }}>{error}</div>
          )}

          {/* One search box above every tab's body (including Requests, which has its own card
              layout below rather than the shared `rows` model) — hidden while a form is open since
              there's nothing to filter underneath it then. */}
          {!editing && (
            <div style={{ marginBottom: 12 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 9, padding: '0 13px', height: 40, background: 'var(--bw-bg-subtle)', border: '1px solid var(--bw-line)', borderRadius: 11 }}>
                <span style={{ fontSize: 14, color: 'var(--bw-faint)', flex: 'none' }}>⌕</span>
                <input
                  value={query}
                  onChange={(e) => { setQuery(e.target.value); setPage(0); }}
                  placeholder={SEARCH_PLACEHOLDER[tab]}
                  style={{ border: 0, background: 'transparent', outline: 'none', fontSize: 13.5, width: '100%', color: 'var(--bw-ink)' }}
                />
                {query && (
                  <button
                    type="button"
                    aria-label="Clear search"
                    onClick={() => setQuery('')}
                    style={{ border: 0, background: 'transparent', color: 'var(--bw-faint)', fontSize: 15, cursor: 'pointer', flex: 'none', padding: 0, lineHeight: 1 }}
                  >
                    ×
                  </button>
                )}
              </div>
              {q && (
                <div style={{ fontSize: 11.5, color: 'var(--bw-muted)', marginTop: 5, padding: '0 2px' }}>
                  {tab === 'requests' ? visibleFeedback.length : visibleRows.length} of {tab === 'requests' ? sortedFeedback.length : rows.length}
                </div>
              )}
            </div>
          )}

          {tab === 'requests' ? (
            <div>
              {visibleFeedback.length === 0 && (
                <div style={{ fontSize: 12.5, color: 'var(--bw-muted)', textAlign: 'center', padding: 14 }}>
                  {sortedFeedback.length === 0 ? 'No feedback yet.' : `No matches for “${query.trim()}”.`}
                </div>
              )}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {visibleFeedback.map((f) => {
                  const acting = actingId === f.id;
                  const isFeature = f.type === 'feature';
                  const sc = STATUS_PILL[f.status];
                  return (
                    <div key={f.id} style={{ padding: '11px 12px', background: 'var(--bw-surface-sunken)', borderRadius: 11, border: '1px solid var(--bw-line-soft)' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 5 }}>
                        <span style={{ fontSize: 11, fontWeight: 800, padding: '2px 8px', borderRadius: 999, background: isFeature ? 'var(--bw-tint-info)' : 'var(--bw-tint-danger)', color: isFeature ? 'var(--bw-primary)' : 'var(--bw-on-tint-danger)' }}>
                          {isFeature ? '💡 Feature' : '🐞 Bug'}
                        </span>
                        <span style={{ fontSize: 11, fontWeight: 800, padding: '2px 8px', borderRadius: 999, background: sc.bg, color: sc.fg, textTransform: 'capitalize' }}>{f.status}</span>
                        <span title={`${f.upvotes} upvote${f.upvotes === 1 ? '' : 's'}`} style={{ fontSize: 11, fontWeight: 800, padding: '2px 8px', borderRadius: 999, background: 'var(--bw-tint-info)', color: 'var(--bw-primary)' }}>▲ {f.upvotes}</span>
                        <span style={{ marginLeft: 'auto', fontSize: 11, color: 'var(--bw-faint)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '40%' }}>{f.submitterName ?? 'Someone'}</span>
                      </div>
                      <div style={{ fontSize: 13.5, fontWeight: 800, color: 'var(--bw-ink)' }}>{f.title}</div>
                      {f.details && <div style={{ fontSize: 12, color: 'var(--bw-muted)', lineHeight: 1.45, marginTop: 2 }}>{f.details}</div>}
                      <div style={{ display: 'flex', gap: 8, marginTop: 9 }}>
                        {f.status !== 'accepted' && (
                          <button onClick={() => void moderate(f.id, 'accepted')} disabled={acting} style={{ border: '1px solid var(--bw-tint-ok-border)', background: 'var(--bw-tint-ok)', color: 'var(--bw-on-tint-ok)', padding: '6px 13px', borderRadius: 8, fontSize: 12, fontWeight: 800, cursor: acting ? 'wait' : 'pointer' }}>Accept</button>
                        )}
                        {f.status !== 'declined' && (
                          <button onClick={() => void moderate(f.id, 'declined')} disabled={acting} style={{ border: '1px solid var(--bw-tint-danger-border)', background: 'var(--bw-tint-danger)', color: 'var(--bw-on-tint-danger)', padding: '6px 13px', borderRadius: 8, fontSize: 12, fontWeight: 800, cursor: acting ? 'wait' : 'pointer' }}>Decline</button>
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
                          near={props.userLoc}
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
                                style={{ marginTop: 6, border: '1px solid var(--bw-line)', background: 'var(--bw-surface)', color: 'var(--bw-ink-soft)', padding: '6px 11px', borderRadius: 8, fontSize: 11.5, fontWeight: 700, cursor: 'pointer' }}
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
                    ) : f.key === 'depthCm' ? (
                      /* Depth is typed and stored in cm (see the unit rule in utils/format.ts).
                         Echo the imperial equivalent so this raw editor agrees with every
                         read-only depth elsewhere in the app instead of being the cm-only corner. */
                      <>
                        <input type="number" value={String(editing.form[f.key] ?? '')} onChange={(e) => setField(f.key, e.target.value)} style={inputStyle} />
                        {String(editing.form[f.key] ?? '') !== '' && Number.isFinite(Number(editing.form[f.key])) && (
                          <div style={{ fontSize: 10.5, fontWeight: 700, color: 'var(--bw-faint)', marginTop: 4 }}>
                            {formatDepth(Number(editing.form[f.key]))}
                          </div>
                        )}
                      </>
                    ) : (
                      <input type={f.type === 'number' ? 'number' : 'text'} value={String(editing.form[f.key] ?? '')} onChange={(e) => setField(f.key, e.target.value)} style={inputStyle} />
                    )}
                  </Wrap>
                  );
                })}
              </div>
              <div style={{ display: 'flex', gap: 9, marginTop: 16 }}>
                <button onClick={() => void submit()} disabled={busy} style={{ flex: 1, border: 0, background: 'var(--bw-primary)', color: 'var(--bw-on-accent)', padding: 11, borderRadius: 10, fontSize: 13.5, fontWeight: 800, cursor: busy ? 'wait' : 'pointer', opacity: busy ? 0.7 : 1 }}>
                  {busy ? 'Saving…' : 'Save'}
                </button>
                <button onClick={() => setEditing(null)} disabled={busy} style={{ border: '1px solid var(--bw-line)', background: 'var(--bw-surface)', color: 'var(--bw-ink-soft)', padding: '11px 16px', borderRadius: 10, fontSize: 13.5, fontWeight: 700, cursor: 'pointer' }}>
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <div>
              {/* Zones-only: a bulk "report flooding now" entry point, above the generic + Add
                  zone form — this is the fast path admins actually reach for during a flood event,
                  vs. one-off zone bookkeeping. Opens ZoneReportModal (mounted in App) with every
                  active zone ticked. */}
              {tab === 'zones' && (
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 8 }}>
                  <button
                    onClick={() => props.onReportZones()}
                    style={{ flex: '1 1 200px', border: '1px solid var(--bw-tint-info-border)', background: 'var(--bw-tint-info)', color: 'var(--bw-primary)', padding: 10, borderRadius: 10, fontSize: 13, fontWeight: 800, cursor: 'pointer' }}
                  >
                    ⚡ Report flooding on zones…
                  </button>
                  <button
                    onClick={() => props.onScopedWarn()}
                    style={{ flex: '1 1 200px', border: '1px solid var(--bw-tint-warn-border)', background: 'var(--bw-tint-warn)', color: 'var(--bw-on-tint-warn)', padding: 10, borderRadius: 10, fontSize: 13, fontWeight: 800, cursor: 'pointer' }}
                  >
                    ⚠ Warn an area…
                  </button>
                </div>
              )}
              <button onClick={startAdd} style={{ width: '100%', border: '1px dashed var(--bw-primary)', background: 'var(--bw-tint-info)', color: 'var(--bw-primary)', padding: 10, borderRadius: 10, fontSize: 13, fontWeight: 800, cursor: 'pointer', marginBottom: 12 }}>
                + Add {TAB_LABEL[tab].toLowerCase().replace(/s$/, '')}
              </button>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
                {visibleRows.length === 0 && (
                  <div style={{ fontSize: 12.5, color: 'var(--bw-muted)', textAlign: 'center', padding: 14 }}>
                    {rows.length === 0 ? 'No records yet.' : `No matches for “${query.trim()}”.`}
                  </div>
                )}
                {pagedRows.map((r) => {
                  const zoneRec = tab === 'zones' ? (r.rec as unknown as FloodProneArea) : null;
                  const reportRec = tab === 'reports' ? (r.rec as unknown as EnrichedReport) : null;
                  // Zone rows carry four actions (Report now / Warn / Edit / Delete) — one more
                  // than every other tab — which squeezed the name column down to an ellipsis.
                  // They alone wrap: the name/district block takes the full first line and the
                  // button strip drops to a second. Other tabs keep the original single row.
                  return (
                  <div key={r.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', background: 'var(--bw-surface-sunken)', borderRadius: 11, ...(zoneRec ? { flexWrap: 'wrap' as const } : null) }}>
                    <div style={{ flex: 1, minWidth: 0, ...(zoneRec ? { flexBasis: '100%' } : null) }}>
                      <div style={{ fontSize: 13, fontWeight: 800, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{r.primary}</div>
                      <div style={{ fontSize: 11.5, color: 'var(--bw-muted)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{r.secondary}</div>
                      {zoneRec && (
                        <div style={{ fontSize: 10.5, color: 'var(--bw-faint)', marginTop: 2 }}>
                          {zoneRec.lastWarnedAt ? `Last warned ${timeAgo(zoneRec.lastWarnedAt)}` : 'Never warned'}
                        </div>
                      )}
                    </div>
                    {zoneRec && (
                      <button onClick={() => props.onReportZones(zoneRec)} disabled={busy} title="Report flooding for this zone now" style={{ border: '1px solid var(--bw-tint-info-border)', background: 'var(--bw-tint-info)', color: 'var(--bw-primary)', padding: '6px 11px', borderRadius: 8, fontSize: 12, fontWeight: 700, cursor: 'pointer', flex: 'none' }}>
                        ⚡ Report now
                      </button>
                    )}
                    {zoneRec && (
                      <button onClick={() => props.onWarnZone(zoneRec)} disabled={busy} title="Send a flood warning for this zone" style={{ border: '1px solid var(--bw-tint-warn-border)', background: 'var(--bw-tint-warn)', color: 'var(--bw-on-tint-warn)', padding: '6px 11px', borderRadius: 8, fontSize: 12, fontWeight: 700, cursor: 'pointer', flex: 'none' }}>
                        ⚠ Warn
                      </button>
                    )}
                    {reportRec?.expired && reportRec.status !== 'resolved' && (
                      // Only for reports that aged out (TTL/drained) — never for one an admin
                      // resolved on purpose, matching the Archive tab's rule in App.tsx. A resolved
                      // report stays expired through `status` alone, so this shortcut could not
                      // revive it anyway; flipping Status back to active is a deliberate Edit.
                      // Pre-seeds the form's `ttlMinutes` with an estimate from the report's own
                      // observed depth — the same drainMinutes model the ADMIN OVERRIDE reopen
                      // control in ReportDetailCard uses. buildPayload always emits depthCm, so
                      // saving this form re-anchors observationAnchorMs and the report goes live.
                      <button
                        onClick={() => startEdit(r.id, { ...r.rec, ttlMinutes: drainMinutes(reportRec.depthCm, rainActive) })}
                        disabled={busy}
                        title="Reopen this expired report"
                        style={{ border: '1px solid var(--bw-tint-info-border)', background: 'var(--bw-tint-info)', color: 'var(--bw-primary)', padding: '6px 11px', borderRadius: 8, fontSize: 12, fontWeight: 700, cursor: 'pointer', flex: 'none' }}
                      >
                        ↻ Reopen
                      </button>
                    )}
                    <button onClick={() => startEdit(r.id, r.rec)} disabled={busy} style={{ border: '1px solid var(--bw-line)', background: 'var(--bw-surface)', color: 'var(--bw-ink-soft)', padding: '6px 11px', borderRadius: 8, fontSize: 12, fontWeight: 700, cursor: 'pointer', flex: 'none' }}>
                      Edit
                    </button>
                    <button onClick={() => void remove(r.id)} disabled={busy} style={{ border: '1px solid var(--bw-tint-danger-border)', background: 'var(--bw-tint-danger)', color: 'var(--bw-on-tint-danger)', padding: '6px 11px', borderRadius: 8, fontSize: 12, fontWeight: 700, cursor: 'pointer', flex: 'none' }}>
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
                    style={{ border: '1px solid var(--bw-line)', background: 'var(--bw-surface)', color: 'var(--bw-ink-soft)', padding: '7px 13px', borderRadius: 9, fontSize: 12.5, fontWeight: 700, cursor: safePage === 0 ? 'default' : 'pointer', opacity: safePage === 0 ? 0.45 : 1 }}
                  >
                    ← Prev
                  </button>
                  <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--bw-muted)' }}>
                    Page {safePage + 1} of {pageCount} · {visibleRows.length} total
                  </span>
                  <button
                    onClick={() => setPage((p) => Math.min(pageCount - 1, p + 1))}
                    disabled={safePage >= pageCount - 1}
                    style={{ border: '1px solid var(--bw-line)', background: 'var(--bw-surface)', color: 'var(--bw-ink-soft)', padding: '7px 13px', borderRadius: 9, fontSize: 12.5, fontWeight: 700, cursor: safePage >= pageCount - 1 ? 'default' : 'pointer', opacity: safePage >= pageCount - 1 ? 0.45 : 1 }}
                  >
                    Next →
                  </button>
                </div>
              )}

              {tab === 'reports' && (
                <div style={{ marginTop: 18 }}>
                  <div style={{ fontSize: 12.5, fontWeight: 800, color: 'var(--bw-ink-soft)', marginBottom: 8 }}>Social posts</div>
                  {socialPosts.length === 0 && (
                    <div style={{ fontSize: 12, color: 'var(--bw-muted)', textAlign: 'center', padding: 12 }}>No auto-post attempts yet.</div>
                  )}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    {socialPosts.map((sp) => {
                      const reportName = reports.find((r) => r.id === sp.reportId)?.name ?? `Report #${sp.reportId}`;
                      const pill = SOCIAL_STATUS_PILL[sp.status];
                      return (
                        <div key={sp.id} style={{ display: 'flex', alignItems: 'center', gap: 9, padding: '8px 10px', background: 'var(--bw-surface-sunken)', borderRadius: 10 }}>
                          {sp.network === 'facebook' ? (
                            <svg viewBox="0 0 24 24" width={13} height={13} fill="#1877F2" style={{ flex: 'none' }}><path d={FB_GLYPH_PATH} /></svg>
                          ) : (
                            <span style={{ fontSize: 12, fontWeight: 800, flex: 'none' }}>𝕏</span>
                          )}
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontSize: 12, fontWeight: 700, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{reportName}</div>
                            <div style={{ fontSize: 10.5, color: 'var(--bw-faint)' }}>
                              {SOCIAL_NETWORK_LABEL[sp.network]} · {timeAgo(sp.updatedAt)}{sp.lastError ? ` · ${sp.lastError}` : ''}
                            </div>
                          </div>
                          <span style={{ fontSize: 10.5, fontWeight: 800, padding: '2px 8px', borderRadius: 999, background: pill.bg, color: pill.fg, textTransform: 'capitalize', flex: 'none' }}>{sp.status}</span>
                          {/* The payoff of a sent row: open the real post on the network. */}
                          {sp.externalUrl && (
                            <a href={sp.externalUrl} target="_blank" rel="noopener noreferrer" style={{ border: '1px solid var(--bw-line)', background: 'var(--bw-surface)', color: 'var(--bw-ink-soft)', padding: '5px 10px', borderRadius: 7, fontSize: 11, fontWeight: 700, textDecoration: 'none', flex: 'none' }}>
                              View
                            </a>
                          )}
                          {/* Skipped rows are retryable too — that's how a dry-run or
                              kill-switched post gets published once the blocker is cleared. */}
                          {(sp.status === 'failed' || sp.status === 'skipped') && (
                            <button onClick={() => onRetrySocialPost(sp.id)} style={{ border: '1px solid var(--bw-line)', background: 'var(--bw-surface)', color: 'var(--bw-ink-soft)', padding: '5px 10px', borderRadius: 7, fontSize: 11, fontWeight: 700, cursor: 'pointer', flex: 'none' }}>
                              Retry
                            </button>
                          )}
                        </div>
                      );
                    })}
                  </div>
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
