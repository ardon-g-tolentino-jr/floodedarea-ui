import React from 'react';
import type { AlertLevel, LatLng, NewAlert, NewCenter, NewHotline, NewReport, ReportStatus, Road, Severity } from './types';
import { useAuth } from './hooks/useAuth';
import { useIsMobile } from './hooks/useBreakpoint';
import { useAlerts, useCenters, useHotlines, useReports, useRescues, useRoadStatus } from './hooks/useDomainData';
import { useActivityStream } from './hooks/useActivityStream';
import { mutations } from './api/queries';
import { ApiError } from './api/client';
import type { GeoResult } from './api/geocode';
import { reverseGeocode } from './api/geocode';
import type { MapFocus, SearchMark } from './components/map/FloodMap';
import { SEVERITY_PRESET } from './utils/floodMeta';
import {
  computeStatus,
  enrichReports,
  type EnrichedReport,
  type RoadEntry,
  WATER_RISE_DEFAULT,
  MONITOR_RADIUS_KM,
} from './utils/viewModel';
import TopBar from './components/panels/TopBar';
import AlertRibbon from './components/panels/AlertRibbon';
import Sidebar from './components/panels/Sidebar';
import FloodMap from './components/map/FloodMap';
import RoadLegend from './components/map/RoadLegend';
import ReportDetailCard from './components/panels/ReportDetailCard';
import EvacDetailCard from './components/panels/EvacDetailCard';
import SeverityPicker from './components/panels/SeverityPicker';
import SosModal from './components/panels/SosModal';
import Toast, { type ToastData } from './components/panels/Toast';
import NotifyModal, { type NotifyPrefs, DEFAULT_NOTIFY_PREFS } from './components/panels/NotifyModal';
import WaterLevelModal from './components/panels/WaterLevelModal';
import RoadConditionsModal from './components/panels/RoadConditionsModal';
import RescueChartModal from './components/panels/RescueChartModal';
import AdminPanel from './components/panels/AdminPanel';
import LoginView from './views/LoginView';

const NOTIFY_STORAGE_KEY = 'baha_notify_v1';
const LIVE_STORAGE_KEY = 'baha_live_v1';

function loadNotifyPrefs(): NotifyPrefs {
  try {
    const raw = localStorage.getItem(NOTIFY_STORAGE_KEY);
    return raw ? { ...DEFAULT_NOTIFY_PREFS, ...(JSON.parse(raw) as NotifyPrefs) } : DEFAULT_NOTIFY_PREFS;
  } catch {
    return DEFAULT_NOTIFY_PREFS;
  }
}

function loadLivePref(): boolean {
  try {
    return localStorage.getItem(LIVE_STORAGE_KEY) !== '0';
  } catch {
    return true;
  }
}

const DEFAULT_LOCATION: LatLng = { lat: 14.66, lng: 121.12 }; // Marikina Heights
const REGION_LABEL = 'Philippines';

type PendingPin = LatLng & { atYou: boolean };

const App: React.FC = () => {
  const { auth, loginWithGoogle, logout } = useAuth();
  const isMobile = useIsMobile();

  const reports = useReports();
  const centers = useCenters();
  const hotlines = useHotlines();
  const alerts = useAlerts();
  const roads = useRoadStatus();
  const rescues = useRescues();

  const [userLoc, setUserLoc] = React.useState<LatLng>(DEFAULT_LOCATION);

  // Ticking clock so report expiry (30-min TTL) and the safety status update in real time
  // without waiting on a refetch.
  const [now, setNow] = React.useState<number>(() => Date.now());
  React.useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 15000);
    return () => window.clearInterval(id);
  }, []);

  // UI state
  const [mode, setMode] = React.useState<'idle' | 'report'>('idle');
  const [pending, setPending] = React.useState<PendingPin | null>(null);
  // Road auto-detected from the pending pin via reverse geocoding (which street it's on).
  const [detectedRoad, setDetectedRoad] = React.useState<{ road: string | null; district: string | null }>({ road: null, district: null });
  const [detectingRoad, setDetectingRoad] = React.useState(false);
  const geocodeReqId = React.useRef(0);
  const [selectedReportId, setSelectedReportId] = React.useState<number | null>(null);
  const [selEvacId, setSelEvacId] = React.useState<number | null>(null);
  const [tab, setTab] = React.useState<'nearby' | 'activity'>('nearby');
  const [filters, setFilters] = React.useState<Record<Severity, boolean>>({ high: true, medium: true, low: true });
  const [roadFilters, setRoadFilters] = React.useState<Record<Road, boolean>>({ passable: true, risky: true, impassable: true });
  const [projectedRiseCm, setProjectedRiseCm] = React.useState<number>(WATER_RISE_DEFAULT);
  const [monitorRadiusKm, setMonitorRadiusKm] = React.useState<number>(MONITOR_RADIUS_KM);
  const [showShelters, setShowShelters] = React.useState(true);
  const [showRoads, setShowRoads] = React.useState(true);
  const [sosOpen, setSosOpen] = React.useState(false);
  const [mapFocus, setMapFocus] = React.useState<MapFocus | null>(null);
  const [searchMark, setSearchMark] = React.useState<SearchMark | null>(null);
  const [notifyPrefs, setNotifyPrefs] = React.useState<NotifyPrefs>(loadNotifyPrefs);
  const [notifyOpen, setNotifyOpen] = React.useState(false);
  const [waterChartOpen, setWaterChartOpen] = React.useState(false);
  const [roadsModalOpen, setRoadsModalOpen] = React.useState(false);
  const [rescueChartOpen, setRescueChartOpen] = React.useState(false);
  const [adminOpen, setAdminOpen] = React.useState(false);
  const [liveStream, setLiveStream] = React.useState<boolean>(loadLivePref);
  const [notifyPerm, setNotifyPerm] = React.useState<NotificationPermission | 'unsupported'>(
    typeof Notification !== 'undefined' ? Notification.permission : 'unsupported'
  );
  const [dismissedAlerts, setDismissedAlerts] = React.useState<Set<number>>(new Set());
  const [toast, setToast] = React.useState<ToastData | null>(null);
  const [login_, setLogin] = React.useState<{ open: boolean; reason?: string }>({ open: false });
  const [busyPick, setBusyPick] = React.useState(false);
  const [confirming, setConfirming] = React.useState(false);
  const [removing, setRemoving] = React.useState(false);
  const [sending, setSending] = React.useState(false);

  const toastTimer = React.useRef<number | undefined>(undefined);
  const showToast = React.useCallback((msg: string, actionLabel?: string, onAction?: () => void): void => {
    window.clearTimeout(toastTimer.current);
    setToast({ msg, actionLabel, onAction });
    toastTimer.current = window.setTimeout(() => setToast(null), 4800);
  }, []);

  // Try to use the device location (falls back to the default monitoring area).
  React.useEffect(() => {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      (pos) => setUserLoc({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      () => {/* keep default */},
      { enableHighAccuracy: false, timeout: 8000 }
    );
  }, []);

  // Persist the alert subscription across sessions.
  React.useEffect(() => {
    try { localStorage.setItem(NOTIFY_STORAGE_KEY, JSON.stringify(notifyPrefs)); } catch {/* ignore */}
  }, [notifyPrefs]);

  // Persist the admin live-stream preference.
  React.useEffect(() => {
    try { localStorage.setItem(LIVE_STORAGE_KEY, liveStream ? '1' : '0'); } catch {/* ignore */}
  }, [liveStream]);

  // Only admins can switch the live stream off; everyone else stays always-on.
  const isAdmin = auth?.role === 'ADMIN';
  const streamEnabled = !isAdmin || liveStream;

  // Live activity → refresh the affected collection in the background.
  useActivityStream((event) => {
    if (event.startsWith('alert')) {
      void alerts.refetch(true);
    } else if (event.startsWith('rescue')) {
      void rescues.refetch(true);
    } else {
      // Report activity may shift map-matched road status too.
      void reports.refetch(true);
      void roads.refetch(true);
    }
  }, streamEnabled);

  const reportList = reports.data ?? [];
  const centerList = centers.data ?? [];
  const hotlineList = hotlines.data ?? [];
  const alertList = alerts.data ?? [];
  const roadList = roads.data ?? [];
  const rescueList = rescues.data ?? [];

  const enriched = React.useMemo(
    () => enrichReports(reportList, userLoc, auth?.userId ?? null, now),
    [reportList, userLoc, auth?.userId, now]
  );

  // Only reports posted within the last 30 min count as "live" — expired ones drop off the
  // map, feed, status and counts.
  const active = React.useMemo(() => enriched.filter((r) => !r.expired), [enriched]);

  // Representative (median) depth of active reports — drives the sidebar water-rise ratio readout.
  const representativeDepthCm = React.useMemo(() => {
    const ds = active.map((r) => r.depthCm).sort((a, b) => a - b);
    return ds.length ? ds[Math.floor(ds.length / 2)] : 0;
  }, [active]);

  const visible = React.useMemo(
    () => active.filter((r) => filters[r.severity] && roadFilters[r.road]),
    [active, filters, roadFilters]
  );
  const nearby = React.useMemo(() => [...visible].sort((a, b) => a.distKm - b.distKm), [visible]);
  const feed = React.useMemo(
    () => [...active].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()),
    [active]
  );
  const status = React.useMemo(() => computeStatus(active), [active]);

  // ── New-flood-report alert subscription ──
  // Detect reports that arrive (via the SSE-driven refetch) and alert when they match the
  // user's criteria. `enriched` already carries distance and `mine`, so matching is local.
  const seenReportIds = React.useRef<Set<number>>(new Set());
  const alertsPrimed = React.useRef(false);

  React.useEffect(() => {
    // First population (initial load): remember existing reports without alerting.
    if (!alertsPrimed.current) {
      for (const r of enriched) seenReportIds.current.add(r.id);
      alertsPrimed.current = true;
      return;
    }
    const fresh = enriched.filter((r) => !seenReportIds.current.has(r.id));
    if (!fresh.length) return;
    for (const r of fresh) seenReportIds.current.add(r.id);

    if (!notifyPrefs.enabled) return;
    const matches = fresh.filter(
      (r) => !r.mine && r.status === 'active' && r.distKm <= notifyPrefs.radiusKm && notifyPrefs.severities[r.severity]
    );
    if (!matches.length) return;

    // System notification(s) when permitted; an in-app toast either way.
    if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
      for (const r of matches.slice(0, 3)) {
        try {
          new Notification('New flood reported nearby', {
            body: `${r.sev.label} flooding ~${r.distKm.toFixed(1)} km away at ${r.name} (${r.depthCm} cm).`,
          });
        } catch {/* ignore */}
      }
    }

    if (matches.length === 1) {
      const r = matches[0];
      showToast(`${r.sev.label} flood reported ~${r.distKm.toFixed(1)} km away`, 'View', () => {
        setTab('nearby');
        setSelEvacId(null);
        setSelectedReportId(r.id);
        setMapFocus({ lat: r.latitude, lng: r.longitude, key: Date.now() });
      });
    } else {
      showToast(`${matches.length} new flood reports near you`);
    }
  }, [enriched, notifyPrefs, showToast]);

  const filterCounts = React.useMemo(() => {
    const c: Record<Severity, number> = { high: 0, medium: 0, low: 0 };
    for (const r of active) c[r.severity]++;
    return c;
  }, [active]);

  const roadCounts = React.useMemo(() => {
    const c: Record<Road, number> = { passable: 0, risky: 0, impassable: 0 };
    for (const r of active) c[r.road]++;
    return c;
  }, [active]);

  // Road segments shown on the map, gated by the per-status ROADS chips so toggling a
  // passability category hides both its road lines and its report dots (the dots are filtered
  // via `visible` above).
  const visibleRoadSegments = React.useMemo(
    () => roadList.filter((s) => roadFilters[s.status]),
    [roadList, roadFilters]
  );

  // Impassable road segments — counted in the sidebar summary (always the true count).
  const impassableRoads = React.useMemo(
    () => roadList.filter((s) => s.status === 'impassable'),
    [roadList]
  );

  const selectedReport: EnrichedReport | undefined = enriched.find((r) => r.id === selectedReportId);
  const selEvac = centerList.find((c) => c.id === selEvacId);
  // Surface the most severe active, non-dismissed alert (red > orange > yellow).
  const activeAlert = React.useMemo(() => {
    const rank: Record<AlertLevel, number> = { red: 3, orange: 2, yellow: 1 };
    return alertList
      .filter((a) => a.active && !dismissedAlerts.has(a.id))
      .sort((a, b) => rank[b.level] - rank[a.level])[0];
  }, [alertList, dismissedAlerts]);

  // Proactively nudge on a newly-active severe (orange/red) rainfall warning. Keyed by id+level
  // so an escalation (e.g. orange → red) re-fires, but a steady warning doesn't repeat.
  const notifiedAlertLevels = React.useRef<Map<number, AlertLevel>>(new Map());
  const severeAlertsPrimed = React.useRef(false);

  React.useEffect(() => {
    const severe = alertList.filter((a) => a.active && (a.level === 'red' || a.level === 'orange'));
    if (!severeAlertsPrimed.current) {
      for (const a of severe) notifiedAlertLevels.current.set(a.id, a.level);
      severeAlertsPrimed.current = true;
      return;
    }
    const fresh = severe.filter((a) => notifiedAlertLevels.current.get(a.id) !== a.level);
    if (!fresh.length) return;
    for (const a of fresh) notifiedAlertLevels.current.set(a.id, a.level);

    const worst = fresh.find((a) => a.level === 'red') ?? fresh[0];
    if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
      try { new Notification(worst.title, { body: worst.body }); } catch {/* ignore */}
    }
    showToast(worst.title);
  }, [alertList, showToast]);

  // ── Actions ──
  const requireAuth = (reason: string): boolean => {
    if (auth) return true;
    setLogin({ open: true, reason });
    return false;
  };

  // A stale session (cached profile but a missing/expired JWT) makes the API reject authed writes
  // with 401/403. Treat that as a sign-in failure: drop the dead session and re-prompt sign-in.
  // Returns true if it handled an auth error, so callers can skip their generic error toast.
  const handleAuthError = (err: unknown, reason: string): boolean => {
    if (err instanceof ApiError && (err.status === 401 || err.status === 403)) {
      logout();
      setSosOpen(false);
      setLogin({ open: true, reason });
      return true;
    }
    return false;
  };

  // The rescue chart reads /rescue, which needs a valid session. `requireAuth` only checks that a
  // local session exists, so an expired/invalid JWT lets the chart open but the read then 401/403s.
  // Recover like the write paths: drop the dead session, close the chart and re-prompt — otherwise
  // reopening just loops on the same error.
  React.useEffect(() => {
    if (!rescueChartOpen) return;
    if (rescues.error instanceof ApiError && (rescues.error.status === 401 || rescues.error.status === 403)) {
      setRescueChartOpen(false);
      handleAuthError(rescues.error, 'Your session expired. Please sign in again to view rescue requests by district.');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rescueChartOpen, rescues.error]);

  // Reverse-geocode a pin location to the street it sits on, guarding against stale responses
  // when the pin moves quickly. Feeds the editable road field in the report dialog.
  const runReverseGeocode = React.useCallback((loc: LatLng): void => {
    const myId = ++geocodeReqId.current;
    setDetectingRoad(true);
    setDetectedRoad({ road: null, district: null });
    void reverseGeocode(loc.lat, loc.lng).then((r) => {
      if (myId !== geocodeReqId.current) return;
      setDetectedRoad({ road: r.road, district: r.district });
      setDetectingRoad(false);
    });
  }, []);

  const startReport = (): void => {
    if (!requireAuth('Sign in to report a flood in your area.')) return;
    // Anti-spam: one live report per person. While the user's last report is still within its
    // 30-min window, point them at it instead of letting them post another.
    const existing = enriched.find((r) => r.mine && !r.expired);
    if (existing) {
      const wait = Math.max(1, existing.expiresInMin);
      showToast(`You already have an active report — you can post again in ${wait} min.`, 'View', () => {
        setTab('nearby');
        setSelEvacId(null);
        setSelectedReportId(existing.id);
        setMapFocus({ lat: existing.latitude, lng: existing.longitude, key: Date.now() });
      });
      return;
    }
    setSelectedReportId(null);
    setSelEvacId(null);
    setMode('report');
    // Drop the pin at the user's location and recenter the map there.
    setPending({ ...userLoc, atYou: true });
    setMapFocus({ ...userLoc, key: Date.now() });
    runReverseGeocode(userLoc);
    // Refresh the GPS fix so the pin/centering reflect where they actually are right now
    // (the on-mount fix may be stale, or fell back to the default monitoring area).
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const loc = { lat: pos.coords.latitude, lng: pos.coords.longitude };
          setUserLoc(loc);
          // Only re-pin/recenter if they haven't already moved the pin themselves.
          setPending((p) => {
            if (p && p.atYou) {
              setMapFocus({ ...loc, key: Date.now() });
              runReverseGeocode(loc);
            }
            return p && p.atYou ? { ...loc, atYou: true } : p;
          });
        },
        () => {/* keep the current location */},
        { enableHighAccuracy: true, timeout: 8000 }
      );
    }
  };

  const cancelReport = (): void => {
    setMode('idle');
    setPending(null);
    setDetectedRoad({ road: null, district: null });
    setDetectingRoad(false);
  };

  const onMapClick = (latlng: LatLng): void => {
    if (mode !== 'report') return;
    setPending({ ...latlng, atYou: false });
    runReverseGeocode(latlng);
  };

  const pickSeverity = async (sev: Severity, depthCm: number, identify: boolean, road: string): Promise<void> => {
    if (!pending) return;
    const preset = SEVERITY_PRESET[sev];
    setBusyPick(true);
    try {
      // The road name identifies WHICH street is flooded (reverse-geocoded from the pin, then
      // editable by the reporter). Fall back to the detected road, then a generic label.
      const roadName =
        road || detectedRoad.road || (identify ? (auth?.name?.trim() ? `${auth.name.trim()}’s spot` : 'Near dropped pin') : 'Near dropped pin');
      const created = await mutations.createReport({
        name: roadName,
        district: detectedRoad.district ?? 'Unknown area',
        latitude: pending.lat,
        longitude: pending.lng,
        severity: sev,
        depthCm,
        trend: preset.trend,
        road: preset.road,
      });
      await reports.refetch(true);
      setMode('idle');
      setPending(null);
      setDetectedRoad({ road: null, district: null });
      setTab('activity');
      setSelectedReportId(created.id);
      showToast('Flood report posted — thank you!');
    } catch (err) {
      if (handleAuthError(err, 'Your session expired. Please sign in again to post a report.')) return;
      showToast('Could not post your report. Please try again.');
    } finally {
      setBusyPick(false);
    }
  };

  const confirmReport = async (id: number): Promise<void> => {
    if (!requireAuth('Sign in to confirm flood reports.')) return;
    setConfirming(true);
    try {
      await mutations.confirmReport(id);
      await reports.refetch(true);
      showToast('Thanks — your confirmation was added.');
    } catch (err) {
      if (handleAuthError(err, 'Your session expired. Please sign in again to confirm reports.')) return;
      showToast('Could not confirm right now. Please try again.');
    } finally {
      setConfirming(false);
    }
  };

  const removeReport = async (id: number): Promise<void> => {
    if (!requireAuth('Sign in to manage your reports.')) return;
    setRemoving(true);
    try {
      await mutations.deleteReport(id);
      await reports.refetch(true);
      if (selectedReportId === id) setSelectedReportId(null);
      showToast('Your report was removed.');
    } catch (err) {
      if (handleAuthError(err, 'Your session expired. Please sign in again to manage your reports.')) return;
      showToast('Could not remove the report. Please try again.');
    } finally {
      setRemoving(false);
    }
  };

  const sendRescue = async (): Promise<void> => {
    if (!requireAuth('Sign in to send a rescue request with your location.')) {
      setSosOpen(false);
      return;
    }
    setSending(true);
    try {
      // Attribute the request to the nearest reported district so it can be tallied per district.
      const nearest = [...enriched].sort((a, b) => a.distKm - b.distKm)[0];
      await mutations.createRescue({
        latitude: userLoc.lat,
        longitude: userLoc.lng,
        district: nearest?.district ?? 'Unknown area',
      });
      await rescues.refetch(true);
      setSosOpen(false);
      showToast('Rescue request sent with your location. Stay safe.');
    } catch (err) {
      if (handleAuthError(err, 'Your session expired. Please sign in again to send a rescue request.')) return;
      showToast('Could not send the rescue request. Please call a hotline.');
    } finally {
      setSending(false);
    }
  };

  const share = (): void => {
    try {
      void navigator.clipboard?.writeText(window.location.href);
    } catch {/* ignore */}
    setSosOpen(false);
    showToast('Live status link copied to clipboard');
  };

  // ── Admin data management ──
  // Each wraps a mutation, refetches the affected collection in the background, and toasts.
  // Errors propagate so AdminPanel can keep its form open and surface an inline message.
  const adminAction = async (fn: () => Promise<unknown>, refetch: () => Promise<unknown>, ok: string): Promise<void> => {
    await fn();
    await refetch();
    showToast(ok);
  };

  const onCreateCenter = (b: NewCenter) => adminAction(() => mutations.createCenter(b), () => centers.refetch(true), 'Shelter added.');
  const onUpdateCenter = (id: number, b: Partial<NewCenter>) => adminAction(() => mutations.updateCenter(id, b), () => centers.refetch(true), 'Shelter updated.');
  const onDeleteCenter = (id: number) => adminAction(() => mutations.deleteCenter(id), () => centers.refetch(true), 'Shelter removed.');

  const onCreateHotline = (b: NewHotline) => adminAction(() => mutations.createHotline(b), () => hotlines.refetch(true), 'Hotline added.');
  const onUpdateHotline = (id: number, b: Partial<NewHotline>) => adminAction(() => mutations.updateHotline(id, b), () => hotlines.refetch(true), 'Hotline updated.');
  const onDeleteHotline = (id: number) => adminAction(() => mutations.deleteHotline(id), () => hotlines.refetch(true), 'Hotline removed.');

  const onCreateAlert = (b: NewAlert) => adminAction(() => mutations.createAlert(b), () => alerts.refetch(true), 'Alert published.');
  const onUpdateAlert = (id: number, b: Partial<NewAlert>) => adminAction(() => mutations.updateAlert(id, b), () => alerts.refetch(true), 'Alert updated.');
  const onDeleteAlert = (id: number) => adminAction(() => mutations.deleteAlert(id), () => alerts.refetch(true), 'Alert removed.');

  const onCreateReport = (b: NewReport) => adminAction(() => mutations.createReport(b), () => reports.refetch(true), 'Report added.');
  const onUpdateReport = (id: number, b: Partial<NewReport & { status: ReportStatus }>) => adminAction(() => mutations.updateReport(id, b), () => reports.refetch(true), 'Report updated.');
  const onDeleteReport = (id: number) => adminAction(() => mutations.deleteReport(id), () => reports.refetch(true), 'Report removed.');

  const onSearchSelect = (r: GeoResult): void => {
    setSearchMark({ lat: r.lat, lng: r.lng, label: r.label });
    setMapFocus({ lat: r.lat, lng: r.lng, key: Date.now() });
  };

  const setNotifyEnabled = async (on: boolean): Promise<void> => {
    // Ask for system-notification permission the first time the user opts in.
    if (on && typeof Notification !== 'undefined' && Notification.permission === 'default') {
      try {
        setNotifyPerm(await Notification.requestPermission());
      } catch {/* ignore */}
    }
    setNotifyPrefs((prev) => ({ ...prev, enabled: on }));
  };

  const toggleFilter = (s: Severity): void => setFilters((f) => ({ ...f, [s]: !f[s] }));
  const toggleRoad = (r: Road): void => setRoadFilters((f) => ({ ...f, [r]: !f[r] }));

  // From the road-conditions directory: open the road's report on the map and close the modal.
  const openRoadOnMap = (entry: RoadEntry): void => {
    setRoadsModalOpen(false);
    setTab('nearby');
    setSelEvacId(null);
    setSelectedReportId(entry.reportId);
    setMapFocus({ lat: entry.latitude, lng: entry.longitude, key: Date.now() });
  };

  const highCount = filterCounts.high;
  const totalCount = active.length;

  const mapAreaStyle: React.CSSProperties = isMobile
    ? { position: 'relative', height: '52vh', flex: 'none', background: 'var(--bw-map-bg)' }
    : { flex: 1, position: 'relative', minWidth: 0, background: 'var(--bw-map-bg)' };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', overflow: 'hidden', color: 'var(--bw-ink)' }}>
      <TopBar
        regionLabel={REGION_LABEL}
        isMobile={isMobile}
        auth={auth}
        onReport={startReport}
        onShare={share}
        onSOS={() => setSosOpen(true)}
        onSignIn={() => setLogin({ open: true })}
        onSignOut={logout}
        onSearchSelect={onSearchSelect}
        onNotify={() => setNotifyOpen(true)}
        notifyOn={notifyPrefs.enabled}
        onWaterChart={() => setWaterChartOpen(true)}
        onRescueChart={() => {
          // The backend requires auth to read /rescue, so prompt sign-in before opening the chart.
          if (!requireAuth('Sign in to view rescue requests by district.')) return;
          setRescueChartOpen(true);
          void rescues.refetch(true);
        }}
        isAdmin={!!isAdmin}
        onAdmin={() => setAdminOpen(true)}
      />

      {activeAlert && (
        <AlertRibbon alert={activeAlert} onClose={() => setDismissedAlerts((s) => new Set(s).add(activeAlert.id))} />
      )}

      <div style={{ flex: 1, display: 'flex', flexDirection: isMobile ? 'column' : 'row', overflow: isMobile ? 'auto' : 'hidden' }}>
        <div style={mapAreaStyle}>
          <FloodMap
            userLoc={userLoc}
            reports={visible}
            centers={centerList}
            roadSegments={visibleRoadSegments}
            showRoads={showRoads}
            showShelters={showShelters}
            projectedRiseCm={projectedRiseCm}
            monitorRadiusKm={monitorRadiusKm}
            selectedReportId={selectedReportId}
            selEvacId={selEvacId}
            reportMode={mode === 'report'}
            pending={pending}
            focus={mapFocus}
            searchMark={searchMark}
            onMapClick={onMapClick}
            onSelectReport={(id) => { setSelectedReportId(id); setSelEvacId(null); }}
            onSelectEvac={(id) => { setSelEvacId(id); setSelectedReportId(null); }}
          />

          {!isMobile && <RoadLegend />}

          {/* Report-mode hint */}
          {mode === 'report' && (
            <div style={{ position: 'absolute', top: 14, left: '50%', transform: 'translateX(-50%)', zIndex: 500, display: 'flex', alignItems: 'center', gap: 9, maxWidth: '94%', padding: '10px 13px', background: '#0F172A', color: '#fff', borderRadius: 13, boxShadow: '0 8px 24px rgba(15,23,42,.35)', fontSize: 12.5, fontWeight: 700 }}>
              <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#0EA5E9', boxShadow: '0 0 0 4px rgba(14,165,233,.3)', flex: 'none' }} />
              <span style={{ lineHeight: 1.3 }}>{pending?.atYou ? 'Reporting at your location — tap the map to move the pin' : 'Tap the map where it’s flooding'}</span>
              <button onClick={cancelReport} style={{ border: 0, background: 'rgba(255,255,255,.14)', color: '#fff', padding: '6px 12px', borderRadius: 8, fontSize: 12, fontWeight: 700, cursor: 'pointer', flex: 'none' }}>Cancel</button>
            </div>
          )}

          {selectedReport && (
            <ReportDetailCard
              report={selectedReport}
              isMobile={isMobile}
              canConfirm={!!auth && !selectedReport.mine}
              confirming={confirming}
              onConfirm={() => void confirmReport(selectedReport.id)}
              canRemove={selectedReport.mine}
              removing={removing}
              onRemove={() => void removeReport(selectedReport.id)}
              onShowLocation={() => setMapFocus({ lat: selectedReport.latitude, lng: selectedReport.longitude, key: Date.now() })}
              projectedRiseCm={projectedRiseCm}
              onClose={() => setSelectedReportId(null)}
            />
          )}

          {selEvac && (
            <EvacDetailCard
              center={selEvac}
              userLoc={userLoc}
              isMobile={isMobile}
              onClose={() => setSelEvacId(null)}
            />
          )}

          {mode === 'report' && pending && (
            <SeverityPicker
              isMobile={isMobile}
              busy={busyPick}
              reporterName={auth?.name ?? ''}
              detectedRoad={detectedRoad.road}
              detecting={detectingRoad}
              onPick={(s, d, id, road) => void pickSeverity(s, d, id, road)}
              onCancel={cancelReport}
            />
          )}
        </div>

        <Sidebar
          isMobile={isMobile}
          status={status}
          list={tab === 'nearby' ? nearby : feed}
          tab={tab}
          onTab={setTab}
          filters={filters}
          filterCounts={filterCounts}
          onToggleFilter={toggleFilter}
          roadFilters={roadFilters}
          roadCounts={roadCounts}
          onToggleRoad={toggleRoad}
          onOpenRoads={() => setRoadsModalOpen(true)}
          projectedRiseCm={projectedRiseCm}
          onChangeRise={setProjectedRiseCm}
          representativeDepthCm={representativeDepthCm}
          monitorRadiusKm={monitorRadiusKm}
          onChangeMonitor={setMonitorRadiusKm}
          notifyOn={notifyPrefs.enabled}
          notifyRadiusKm={notifyPrefs.radiusKm}
          onOpenNotify={() => setNotifyOpen(true)}
          showShelters={showShelters}
          onToggleShelters={() => setShowShelters((v) => !v)}
          showRoads={showRoads}
          onToggleRoads={() => setShowRoads((v) => !v)}
          impassableRoadCount={impassableRoads.length}
          highCount={highCount}
          totalCount={totalCount}
          selectedReportId={selectedReportId}
          onSelectReport={(id) => { setSelectedReportId(id); setSelEvacId(null); }}
          onSOS={() => setSosOpen(true)}
        />
      </div>

      {/* Mobile FAB */}
      {isMobile && mode !== 'report' && (
        <button
          onClick={startReport}
          style={{ position: 'fixed', right: 16, bottom: 20, zIndex: 45, display: 'flex', alignItems: 'center', gap: 8, height: 52, padding: '0 22px', border: 0, background: 'var(--bw-primary)', color: '#fff', borderRadius: 26, fontSize: 15, fontWeight: 800, boxShadow: '0 8px 22px rgba(14,165,233,.45)', cursor: 'pointer' }}
        >
          <span style={{ fontSize: 20, fontWeight: 700 }}>+</span> Report flood
        </button>
      )}

      {sosOpen && (
        <SosModal hotlines={hotlineList} sending={sending} onSendRescue={() => void sendRescue()} onClose={() => setSosOpen(false)} />
      )}

      {notifyOpen && (
        <NotifyModal
          prefs={notifyPrefs}
          permission={notifyPerm}
          onEnable={(on) => void setNotifyEnabled(on)}
          onChange={setNotifyPrefs}
          onClose={() => setNotifyOpen(false)}
        />
      )}

      {waterChartOpen && (
        <WaterLevelModal reports={reportList} isMobile={isMobile} onClose={() => setWaterChartOpen(false)} />
      )}

      {roadsModalOpen && (
        <RoadConditionsModal
          reports={active}
          isMobile={isMobile}
          onSelectRoad={openRoadOnMap}
          onClose={() => setRoadsModalOpen(false)}
        />
      )}

      {rescueChartOpen && (
        <RescueChartModal
          rescues={rescueList}
          loading={rescues.loading && rescueList.length === 0}
          error={rescues.error}
          isMobile={isMobile}
          onClose={() => setRescueChartOpen(false)}
        />
      )}

      {adminOpen && isAdmin && (
        <AdminPanel
          centers={centerList}
          hotlines={hotlineList}
          alerts={alertList}
          reports={reportList}
          liveStream={liveStream}
          onToggleLive={setLiveStream}
          onCreateCenter={onCreateCenter}
          onUpdateCenter={onUpdateCenter}
          onDeleteCenter={onDeleteCenter}
          onCreateHotline={onCreateHotline}
          onUpdateHotline={onUpdateHotline}
          onDeleteHotline={onDeleteHotline}
          onCreateAlert={onCreateAlert}
          onUpdateAlert={onUpdateAlert}
          onDeleteAlert={onDeleteAlert}
          onCreateReport={onCreateReport}
          onUpdateReport={onUpdateReport}
          onDeleteReport={onDeleteReport}
          onClose={() => setAdminOpen(false)}
        />
      )}

      {toast && <Toast toast={toast} />}

      {login_.open && (
        <LoginView
          reason={login_.reason}
          onGoogle={loginWithGoogle}
          onClose={() => setLogin({ open: false })}
        />
      )}
    </div>
  );
};

export default App;
