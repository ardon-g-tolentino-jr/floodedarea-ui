import React from 'react';
import type { AlertLevel, FeedbackStatus, FloodAlert, LatLng, NewAlert, NewCenter, NewFeedback, NewHotline, NewReport, ReportStatus, RescueStatus, Road, RoadSegment, Severity } from './types';
import { useAuth } from './hooks/useAuth';
import { captchaEnabled } from './utils/turnstile';
import { useIsMobile } from './hooks/useBreakpoint';
import { useAcceptedFeatures, useAlerts, useAllFeedback, useCenters, useHotlines, useReports, useRescues } from './hooks/useDomainData';
import { useActivityStream } from './hooks/useActivityStream';
import { useVisitCounter } from './hooks/useVisitCounter';
import { useI18n, tFormat } from './i18n';
import { mutations } from './api/queries';
import { ApiError } from './api/client';
import type { GeoResult } from './api/geocode';
import { reverseGeocode } from './api/geocode';
import type { MapFocus, SearchMark } from './components/map/FloodMap';
import { SEVERITY_PRESET } from './utils/floodMeta';
import { buildShareText, buildShareLinks } from './utils/share';
import {
  buildPossibleClosures,
  buildRoadDirectory,
  computeStatus,
  enrichReports,
  nearbyOwnActiveReport,
  type EnrichedReport,
  type PossibleClosure,
  type RoadEntry,
  WATER_RISE_DEFAULT,
  MONITOR_RADIUS_KM,
} from './utils/viewModel';
import { loadRoads, roadsLoaded } from './utils/roadSnap';
import { locateWithAccuracy } from './utils/geolocate';
import type { SearchBoxHandle } from './components/panels/SearchBox';
import TopBar from './components/panels/TopBar';
import AlertRibbon from './components/panels/AlertRibbon';
import AlertModal from './components/panels/AlertModal';
import Sidebar from './components/panels/Sidebar';
import FloodMap from './components/map/FloodMap';
import RoadLegend from './components/map/RoadLegend';
import LocateButton from './components/map/LocateButton';
import ReportDetailCard from './components/panels/ReportDetailCard';
import EvacDetailCard from './components/panels/EvacDetailCard';
import SeverityPicker from './components/panels/SeverityPicker';
import SosModal from './components/panels/SosModal';
import LocationHelpModal from './components/panels/LocationHelpModal';
import Toast, { type ToastData } from './components/panels/Toast';
import NotifyModal, { type NotifyPrefs, DEFAULT_NOTIFY_PREFS } from './components/panels/NotifyModal';
import WaterLevelModal from './components/panels/WaterLevelModal';
import RoadConditionsModal from './components/panels/RoadConditionsModal';
import PublicDashboardModal from './components/panels/PublicDashboardModal';
import RescueChartModal from './components/panels/RescueChartModal';
import SupportModal from './components/panels/SupportModal';
import ShareModal from './components/panels/ShareModal';
import FeaturesModal from './components/panels/FeaturesModal';
import FeedbackFormModal from './components/panels/FeedbackFormModal';
import AdminPanel from './components/panels/AdminPanel';
import ResponseConsole from './components/panels/ResponseConsole';
import LoginView from './views/LoginView';

const NOTIFY_STORAGE_KEY = 'baha_notify_v1';
const LIVE_STORAGE_KEY = 'baha_live_v1';

/** Bundled GCash donation QR — lives in public/, served under the app's base path. */
const GCASH_QR_SRC = `${import.meta.env.BASE_URL}gcash-qr.png`;

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

type PendingPin = LatLng & { atYou: boolean };

/** A flood-alert dialog: the alert to show plus an optional primary action (e.g. jump to the
 *  report on the map). Used for both rainfall alerts and new-nearby-report notifications. */
type AlertDialog = { alert: FloodAlert; action?: { label: string; run: () => void } };

/** Map a report severity onto an alert level for the dialog's color/label. */
const SEV_TO_LEVEL: Record<Severity, AlertLevel> = { high: 'red', medium: 'orange', low: 'yellow' };

const App: React.FC = () => {
  const { auth, loginWithGoogle, ensureGuest, logout } = useAuth();
  const isMobile = useIsMobile();
  const visitCount = useVisitCounter();
  const { t, lang } = useI18n();

  const reports = useReports();
  const centers = useCenters();
  const hotlines = useHotlines();
  const alerts = useAlerts();
  const rescues = useRescues();
  const acceptedFeatures = useAcceptedFeatures();
  const allFeedback = useAllFeedback();

  const [userLoc, setUserLoc] = React.useState<LatLng>(DEFAULT_LOCATION);
  // Accuracy (meters) of the latest GPS fix — drives the map's uncertainty ring and the
  // "approximate location" guidance. Null until the first fix lands.
  const [userAccuracyM, setUserAccuracyM] = React.useState<number | null>(null);
  // Lets a coarse-fix toast jump focus into the TopBar location search (the manual fallback).
  const searchBoxRef = React.useRef<SearchBoxHandle>(null);
  // "How to enable location" help modal — opened from the permission-denied toast.
  const [locHelpOpen, setLocHelpOpen] = React.useState(false);

  // Ticking clock so report expiry (severity-scaled TTL) and the safety status update in real time
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
  const [detectedRoad, setDetectedRoad] = React.useState<{ road: string | null; district: string | null; barangay: string | null }>({ road: null, district: null, barangay: null });
  const [detectingRoad, setDetectingRoad] = React.useState(false);
  const geocodeReqId = React.useRef(0);
  const [selectedReportId, setSelectedReportId] = React.useState<number | null>(null);
  const [selEvacId, setSelEvacId] = React.useState<number | null>(null);
  const [tab, setTab] = React.useState<'nearby' | 'activity'>('nearby');
  const [filters, setFilters] = React.useState<Record<Severity, boolean>>({ high: true, medium: true, low: true });
  const [roadFilters, setRoadFilters] = React.useState<Record<Road, boolean>>({ passable: true, risky: true, impassable: true });
  const [projectedRiseCm, setProjectedRiseCm] = React.useState<number>(WATER_RISE_DEFAULT);
  const [monitorRadiusKm, setMonitorRadiusKm] = React.useState<number>(MONITOR_RADIUS_KM);
  // Shelter markers start hidden — users opt in via the sidebar toggle.
  const [showShelters, setShowShelters] = React.useState(false);
  const [showRoads, setShowRoads] = React.useState(true);
  // Flips once the bundled road network finishes loading, so the road overlay re-derives with it.
  const [roadsReady, setRoadsReady] = React.useState(false);
  const [sosOpen, setSosOpen] = React.useState(false);
  const [mapFocus, setMapFocus] = React.useState<MapFocus | null>(null);
  const [locating, setLocating] = React.useState(false);
  const [searchMark, setSearchMark] = React.useState<SearchMark | null>(null);
  const [notifyPrefs, setNotifyPrefs] = React.useState<NotifyPrefs>(loadNotifyPrefs);
  const [notifyOpen, setNotifyOpen] = React.useState(false);
  const [waterChartOpen, setWaterChartOpen] = React.useState(false);
  const [roadsModalOpen, setRoadsModalOpen] = React.useState(false);
  const [dashboardOpen, setDashboardOpen] = React.useState(false);
  const [rescueChartOpen, setRescueChartOpen] = React.useState(false);
  const [supportOpen, setSupportOpen] = React.useState(false);
  const [shareOpen, setShareOpen] = React.useState(false);
  const [featuresOpen, setFeaturesOpen] = React.useState(false);
  const [feedbackOpen, setFeedbackOpen] = React.useState(false);
  const [feedbackSending, setFeedbackSending] = React.useState(false);
  const [adminOpen, setAdminOpen] = React.useState(false);
  const [responseOpen, setResponseOpen] = React.useState(false);
  const [rescueBusyId, setRescueBusyId] = React.useState<number | null>(null);
  const [liveStream, setLiveStream] = React.useState<boolean>(loadLivePref);
  const [notifyPerm, setNotifyPerm] = React.useState<NotificationPermission | 'unsupported'>(
    typeof Notification !== 'undefined' ? Notification.permission : 'unsupported'
  );
  const [dismissedAlerts, setDismissedAlerts] = React.useState<Set<number>>(new Set());
  const [alertModal, setAlertModal] = React.useState<AlertDialog | null>(null);
  const alertSound = React.useRef<HTMLAudioElement | null>(null);
  const playAlertSound = React.useCallback(() => {
    if (!alertSound.current) alertSound.current = new Audio(`${import.meta.env.BASE_URL}alert.wav`);
    alertSound.current.currentTime = 0;
    void alertSound.current.play().catch(() => {/* autoplay blocked until first interaction */});
  }, []);

  // Mobile browsers (Android Chrome / iOS Safari) block programmatic audio until it's been played
  // once inside a user gesture. Prime the element silently on the first tap/click anywhere, so a
  // later SSE-driven playAlertSound() is allowed to sound. Runs once, then unbinds.
  React.useEffect(() => {
    const unlock = (): void => {
      if (!alertSound.current) alertSound.current = new Audio(`${import.meta.env.BASE_URL}alert.wav`);
      const a = alertSound.current;
      const vol = a.volume;
      a.volume = 0;
      a.play().then(() => { a.pause(); a.currentTime = 0; a.volume = vol; }).catch(() => { a.volume = vol; });
      window.removeEventListener('pointerdown', unlock);
      window.removeEventListener('touchend', unlock);
    };
    window.addEventListener('pointerdown', unlock, { once: true });
    window.addEventListener('touchend', unlock, { once: true });
    return () => {
      window.removeEventListener('pointerdown', unlock);
      window.removeEventListener('touchend', unlock);
    };
  }, []);
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
  const didAutoCenter = React.useRef(false);
  React.useEffect(() => {
    // Let the fix converge in the background and keep the best reading; the map's "You" marker
    // and accuracy ring follow each improvement. On failure we keep the default monitoring area.
    //
    // Center the map on the user the first time a fix lands so their location shows automatically
    // (same effect as the locate button) — but only once, and never yank them away from a place
    // they already searched/selected while the fix was still converging (`prev ?? …`).
    const autoCenter = (lat: number, lng: number): void => {
      if (didAutoCenter.current) return;
      didAutoCenter.current = true;
      setMapFocus((prev) => prev ?? { lat, lng, key: Date.now() });
    };
    void locateWithAccuracy({
      desiredAccuracyM: 60,
      totalTimeoutMs: 10000,
      onProgress: (fix) => {
        setUserLoc({ lat: fix.lat, lng: fix.lng });
        setUserAccuracyM(fix.accuracyM);
        autoCenter(fix.lat, fix.lng);
      },
    }).then(
      (fix) => { setUserLoc({ lat: fix.lat, lng: fix.lng }); setUserAccuracyM(fix.accuracyM); autoCenter(fix.lat, fix.lng); },
      () => {/* keep default; the locate button is still available */}
    );
  }, []);

  // Lazily fetch the bundled road network the first time the Roads overlay is shown, then snap
  // reports to real roads (see utils/roadSnap). Failure degrades the overlay to report pins only.
  React.useEffect(() => {
    if (!showRoads || roadsLoaded()) return;
    let cancelled = false;
    void fetch(`${import.meta.env.BASE_URL}roads.json`)
      .then((r) => (r.ok ? r.json() : null))
      .then((asset) => { if (!cancelled && asset) { loadRoads(asset); setRoadsReady(true); } })
      .catch(() => {/* overlay shows pins only */});
    return () => { cancelled = true; };
  }, [showRoads]);

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

  // Refresh the feedback lists once a user who can see them is present (handles login after mount).
  React.useEffect(() => { if (auth && auth.role !== 'GUEST') void acceptedFeatures.refetch(true); }, [auth?.userId]); // eslint-disable-line react-hooks/exhaustive-deps
  React.useEffect(() => { if (isAdmin) void allFeedback.refetch(true); }, [isAdmin]); // eslint-disable-line react-hooks/exhaustive-deps
  const streamEnabled = !isAdmin || liveStream;

  // Live activity → refresh the affected collection in the background.
  useActivityStream((event) => {
    if (event.startsWith('alert')) {
      void alerts.refetch(true);
    } else if (event.startsWith('rescue')) {
      void rescues.refetch(true);
    } else {
      // Report activity re-derives the road overlay (it's computed from the reports).
      void reports.refetch(true);
    }
  }, streamEnabled);

  const reportList = reports.data ?? [];
  const centerList = centers.data ?? [];
  const hotlineList = hotlines.data ?? [];
  const alertList = alerts.data ?? [];
  const rescueList = rescues.data ?? [];

  const enriched = React.useMemo(
    () => enrichReports(reportList, userLoc, auth?.userId ?? null, now),
    [reportList, userLoc, auth?.userId, now]
  );

  // Only reports still within their severity-scaled freshness window count as "live" — expired
  // ones drop off the map, feed, status and counts.
  const active = React.useMemo(() => enriched.filter((r) => !r.expired), [enriched]);

  // Snap active reports to real roads (bundled OSM data) → one directory of affected roads with real
  // geometry, shared by the map overlay, the sidebar count, and the Road-conditions modal.
  // `roadsReady` re-runs this once the dataset finishes loading.
  const roadDirectory = React.useMemo(() => {
    void roadsReady;
    return buildRoadDirectory(active);
  }, [active, roadsReady]);

  // Map overlay: only roads we have real geometry for draw a line (un-snapped ones still pin/list).
  const roadList: RoadSegment[] = React.useMemo(
    () => roadDirectory.flatMap((d) => d.roads)
      .filter((r) => r.path && r.path.length >= 2)
      .map((r) => ({ id: r.roadId ?? r.reportId, name: r.name, status: r.road, path: r.path!, reportsCount: r.reportCount, updatedAt: '' })),
    [roadDirectory]
  );

  // Inferred closures: roads inside each report's flooded ring, graded by estimated depth — a distinct
  // (dashed) layer, separate from the directly-reported roads above. Filtered by the same ROADS chips.
  const possibleClosures: PossibleClosure[] = React.useMemo(() => {
    void roadsReady;
    return buildPossibleClosures(active);
  }, [active, roadsReady]);
  const visiblePossibleClosures = React.useMemo(
    () => possibleClosures.filter((c) => roadFilters[c.status]),
    [possibleClosures, roadFilters]
  );

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
  const status = React.useMemo(() => computeStatus(active, lang), [active, lang]);

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

    // Surface the alert as a dialog box (with sound), not just a toast.
    const now = new Date().toISOString();
    if (matches.length === 1) {
      const r = matches[0];
      setAlertModal({
        alert: {
          id: -r.id, // synthetic id (negative) so it never collides with rainfall alerts
          title: 'New flood reported nearby',
          body: `${r.sev.label} flooding reported ~${r.distKm.toFixed(1)} km away at ${r.name} — about ${r.depthCm} cm deep.`,
          region: r.name ?? null,
          level: SEV_TO_LEVEL[r.severity],
          active: true,
          createdAt: now,
          updatedAt: now,
        },
        action: {
          label: 'View on map',
          run: () => {
            setTab('nearby');
            setSelEvacId(null);
            setSelectedReportId(r.id);
            setMapFocus({ lat: r.latitude, lng: r.longitude, key: Date.now() });
          },
        },
      });
    } else {
      const worst = matches.find((r) => r.severity === 'high') ?? matches.find((r) => r.severity === 'medium') ?? matches[0];
      setAlertModal({
        alert: {
          id: -worst.id,
          title: `${matches.length} new flood reports near you`,
          body: `${matches.length} new floods reported within ${notifyPrefs.radiusKm} km. The nearest is ${worst.sev.label.toLowerCase()} at ${worst.name}.`,
          region: null,
          level: SEV_TO_LEVEL[worst.severity],
          active: true,
          createdAt: now,
          updatedAt: now,
        },
      });
    }
    playAlertSound();
  }, [enriched, notifyPrefs, playAlertSound]);

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

  // Impassable roads — counted in the sidebar summary; from the full directory (snapped or not).
  const impassableRoads = React.useMemo(
    () => roadDirectory.flatMap((d) => d.roads).filter((r) => r.road === 'impassable'),
    [roadDirectory]
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
  const modaledAlertLevels = React.useRef<Map<number, AlertLevel>>(new Map());

  React.useEffect(() => {
    const severe = alertList.filter((a) => a.active && (a.level === 'red' || a.level === 'orange'));

    // Hard interrupt: pop a centered modal + alarm for the worst active severe alert we haven't
    // shown this session — including one already active on first load. Keyed by id+level so it
    // re-fires on escalation (orange → red) but not on every refetch. The play() rejection
    // (autoplay block before the user's first interaction) is swallowed.
    const worstActive = severe.find((a) => a.level === 'red') ?? severe[0];
    if (worstActive && modaledAlertLevels.current.get(worstActive.id) !== worstActive.level) {
      modaledAlertLevels.current.set(worstActive.id, worstActive.level);
      setAlertModal({ alert: worstActive });
      playAlertSound();
    }

    // OS notification + toast: only for a newly-active/escalated severe alert. Primed on first
    // load so we don't re-nag about already-known warnings on every page reload.
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
  }, [alertList, showToast, playAlertSound]);

  // ── Actions ──
  // Full-account gate for higher-stakes actions (SOS, the responder/rescue views, feedback). A
  // no-login guest session does NOT satisfy this — prompt sign-in so the guest can upgrade. Low-stakes
  // writes (report/confirm) skip this and silently provision a guest via `ensureGuest` instead.
  const requireFullAuth = (reason: string): boolean => {
    if (auth && auth.role !== 'GUEST') return true;
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

  // The rescue chart reads /rescue, which needs a valid session. `requireFullAuth` only checks that a
  // local (non-guest) session exists, so an expired/invalid JWT lets the chart open but the read then 401s.
  // Recover like the write paths: drop the dead session, close the chart and re-prompt — otherwise
  // reopening just loops on the same error. Only a 401 (no/invalid session) triggers this; a 403
  // means we're signed in but lack permission, and signing in again as the same user won't help —
  // so we leave the modal up to show its "no permission" message instead of logging out.
  React.useEffect(() => {
    if (!rescueChartOpen && !responseOpen) return;
    if (rescues.error instanceof ApiError && rescues.error.status === 401) {
      setRescueChartOpen(false);
      setResponseOpen(false);
      handleAuthError(rescues.error, 'Your session expired. Please sign in again to view rescue requests.');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rescueChartOpen, responseOpen, rescues.error]);

  // Reverse-geocode a pin location to the street it sits on, guarding against stale responses
  // when the pin moves quickly. Feeds the editable road field in the report dialog.
  const runReverseGeocode = React.useCallback((loc: LatLng): void => {
    const myId = ++geocodeReqId.current;
    setDetectingRoad(true);
    setDetectedRoad({ road: null, district: null, barangay: null });
    void reverseGeocode(loc.lat, loc.lng).then((r) => {
      if (myId !== geocodeReqId.current) return;
      setDetectedRoad({ road: r.road, district: r.district, barangay: r.barangay });
      setDetectingRoad(false);
    });
  }, []);

  const startReport = async (): Promise<void> => {
    // No login wall: silently provision a no-login guest session (idempotent per device) so anyone
    // can report in seconds. The guest still gets a real userId, which keeps the spam guard,
    // "my reports", and "can't confirm your own" working exactly as for full accounts.
    const session = await ensureGuest();
    if (!session) {
      showToast('Could not start reporting right now. Please try again.');
      return;
    }
    // Anti-spam: one live report per LOCATION. A new report in a distinct area is allowed (you may
    // have driven on to another flooded street), but re-reporting a spot you already have an active
    // report at is a duplicate — point them at it (to Confirm/update) instead of posting another.
    const existing = nearbyOwnActiveReport(enriched, userLoc);
    if (existing) {
      showToast('You already reported flooding here — confirm that report instead. To report a different area, move along and try again.', 'View', () => {
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
    // (the on-mount fix may be stale, or fell back to the default monitoring area). As the fix
    // converges, re-pin to each better reading — but only while the pin is still "at you", so we
    // never yank a pin the user has already dragged/searched somewhere else.
    const applyFix = (loc: LatLng, accuracyM: number): void => {
      setUserLoc(loc);
      setUserAccuracyM(accuracyM);
      setPending((p) => {
        if (p && p.atYou) {
          setMapFocus({ ...loc, key: Date.now() });
          runReverseGeocode(loc);
        }
        return p && p.atYou ? { ...loc, atYou: true } : p;
      });
    };
    void locateWithAccuracy({
      desiredAccuracyM: 30,
      onProgress: (fix) => applyFix({ lat: fix.lat, lng: fix.lng }, fix.accuracyM),
    }).then(
      (fix) => applyFix({ lat: fix.lat, lng: fix.lng }, fix.accuracyM),
      () => {/* keep the current location */}
    );
  };

  const cancelReport = (): void => {
    setMode('idle');
    setPending(null);
    setDetectedRoad({ road: null, district: null, barangay: null });
    setDetectingRoad(false);
  };

  const onMapClick = (latlng: LatLng): void => {
    if (mode !== 'report') return;
    setPending({ ...latlng, atYou: false });
    runReverseGeocode(latlng);
  };

  const pickSeverity = async (sev: Severity, depthCm: number, identify: boolean, road: string, captchaToken?: string): Promise<void> => {
    if (!pending) return;
    const preset = SEVERITY_PRESET[sev];
    setBusyPick(true);
    try {
      // Ensure a session (guest is fine) before posting.
      const session = await ensureGuest();
      if (!session) {
        showToast('Could not post your report. Please try again.');
        return;
      }
      // Guests must clear the CAPTCHA (the report form shows the widget) when Turnstile is enabled.
      if (session.role === 'GUEST' && captchaEnabled() && !captchaToken) {
        showToast('Please complete the security check, then post again.');
        return;
      }
      // Re-check the actual pin location at submit time (the pre-form gate used the GPS fix, but the
      // user can drag the pin back onto an area they already reported). Same-location → duplicate.
      const dup = nearbyOwnActiveReport(enriched, pending);
      if (dup) {
        showToast('You already reported flooding here. Confirm that report, or move the pin to a different area.', 'View', () => {
          setTab('nearby');
          setSelEvacId(null);
          setSelectedReportId(dup.id);
          setMapFocus({ lat: dup.latitude, lng: dup.longitude, key: Date.now() });
        });
        return;
      }
      // The label identifies WHICH street is flooded (reverse-geocoded from the pin, then editable
      // by the reporter). Lead with the public street and append the barangay for context
      // ("Lilac St, Batasan Hills"). With no public street, fall back to the barangay, then
      // district — never a private subdivision, which is excluded in geocode.ts. Only if no area
      // is known and the reporter chose to be named do we use their name. `district` is kept clean
      // (no barangay) below since it's the water-level chart's grouping key.
      const street = road.trim() || detectedRoad.road?.trim() || '';
      const area = detectedRoad.barangay?.trim() || '';
      const roadName = street
        ? (area && area !== street ? `${street}, ${area}` : street)
        : area || detectedRoad.district?.trim() || (identify && auth?.name?.trim() ? `${auth.name.trim()}’s spot` : 'Flooded area');
      const created = await mutations.createReport({
        name: roadName,
        district: detectedRoad.district ?? 'Unknown area',
        latitude: pending.lat,
        longitude: pending.lng,
        severity: sev,
        depthCm,
        trend: preset.trend,
        road: preset.road,
        captchaToken,
      });
      await reports.refetch(true);
      setMode('idle');
      setPending(null);
      setDetectedRoad({ road: null, district: null, barangay: null });
      setTab('activity');
      setSelectedReportId(created.id);
      if (session.role === 'GUEST') {
        showToast('Posted as guest — sign in to verify your reports.', 'Sign in', () =>
          setLogin({ open: true, reason: 'Sign in to verify and manage your reports.' })
        );
      } else {
        showToast('Flood report posted — thank you!');
      }
    } catch (err) {
      if (handleAuthError(err, 'Your session expired. Please sign in again to post a report.')) return;
      // Surface an intentional server rejection (e.g. a backend duplicate/rate-limit guard) so the
      // user sees the actual reason instead of a generic failure.
      if (err instanceof ApiError && (err.status === 409 || err.status === 429)) {
        showToast(err.message);
        return;
      }
      showToast('Could not post your report. Please try again.');
    } finally {
      setBusyPick(false);
    }
  };

  const confirmReport = async (id: number): Promise<void> => {
    if (!(await ensureGuest())) {
      showToast('Could not confirm right now. Please try again.');
      return;
    }
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
    // Only ever shown for the user's own report (`mine`), so a session already exists; ensureGuest
    // just guarantees one before the authed DELETE.
    if (!(await ensureGuest())) {
      showToast('Could not remove the report. Please try again.');
      return;
    }
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
    if (!requireFullAuth('Sign in to send a rescue request with your location.')) {
      setSosOpen(false);
      return;
    }
    setSending(true);
    try {
      // Attribute the request to a district so it can be tallied per district. Prefer the actual
      // sender location reverse-geocoded to a district (works even with no nearby reports); fall
      // back to the nearest reported district, then a generic label.
      const geo = await reverseGeocode(userLoc.lat, userLoc.lng).catch(() => null);
      const nearest = [...enriched].sort((a, b) => a.distKm - b.distKm)[0];
      const district = geo?.district?.trim() || nearest?.district?.trim() || 'Unknown area';
      await mutations.createRescue({
        latitude: userLoc.lat,
        longitude: userLoc.lng,
        district,
        city: geo?.city?.trim() || undefined,
        barangay: geo?.barangay?.trim() || undefined,
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

  // Responder action: advance a rescue request's status (dispatch / resolve / reopen). ADMIN-only
  // surface; mirrors adminAction but tracks the in-flight row so its buttons can show progress.
  const onUpdateRescueStatus = async (id: number, status: RescueStatus): Promise<void> => {
    setRescueBusyId(id);
    try {
      await mutations.updateRescue(id, { status });
      await rescues.refetch(true);
      showToast(status === 'dispatched' ? 'Marked as dispatched.' : status === 'resolved' ? 'Marked as resolved.' : 'Request reopened.');
    } catch (err) {
      if (handleAuthError(err, 'Your session expired. Please sign in again to update rescue requests.')) return;
      showToast('Could not update the request. Please try again.');
    } finally {
      setRescueBusyId(null);
    }
  };

  // The Share dialog's contents. A signed-in user's own still-live report turns Share into a
  // situation snapshot; otherwise it's an enticing pitch with live stats. (Same "mine && !expired"
  // pick as startReport.) Recomputed only when the live data or page URL changes.
  const shareData = React.useMemo(() => {
    const myReport = enriched.find((r) => r.mine && !r.expired) ?? null;
    const url = window.location.href;
    const st = buildShareText({
      myReport,
      activeCount: active.length,
      alertLevel: activeAlert?.level ?? null,
      url,
    });
    return { ...st, url, links: buildShareLinks({ url, body: st.body, text: st.text }) };
  }, [enriched, active.length, activeAlert]);

  const canNativeShare = typeof navigator !== 'undefined' && typeof navigator.share === 'function';

  // The Share modal's "Share via your apps…" button (mobile native sheet — covers Messenger/Viber/etc).
  const nativeShare = async (): Promise<void> => {
    try {
      await navigator.share?.({ title: shareData.title, text: shareData.text, url: shareData.url });
    } catch (err) {
      // User dismissed the sheet → done; swallow other failures (the in-modal buttons remain).
      if (err instanceof DOMException && err.name === 'AbortError') return;
    }
  };

  // Clipboard copy for the modal's "Copy link" / "Copy message" actions.
  const copyShare = async (textToCopy: string, successMsg: string): Promise<void> => {
    try {
      await navigator.clipboard?.writeText(textToCopy);
      showToast(successMsg);
    } catch {
      showToast('Could not copy — please copy it manually');
    }
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

  // Admin: accept/decline a bug report or feature request; accepted features become public.
  const updateFeedbackStatus = (id: number, status: FeedbackStatus) =>
    adminAction(
      () => mutations.updateFeedbackStatus(id, status),
      () => Promise.all([allFeedback.refetch(true), acceptedFeatures.refetch(true)]),
      'Request updated.'
    );

  // Any signed-in user files a bug report or feature request.
  const submitFeedback = async (body: NewFeedback): Promise<void> => {
    if (!requireFullAuth('Sign in to send feedback.')) return;
    setFeedbackSending(true);
    try {
      await mutations.createFeedback(body);
      setFeedbackOpen(false);
      showToast(body.type === 'bug' ? 'Thanks — your bug report was sent.' : 'Thanks — your feature request was sent for review.');
      if (isAdmin) void allFeedback.refetch(true);
    } catch (e) {
      showToast(e instanceof ApiError ? e.message : 'Could not send feedback. Please try again.');
    } finally {
      setFeedbackSending(false);
    }
  };

  const onSearchSelect = (r: GeoResult): void => {
    setSearchMark({ lat: r.lat, lng: r.lng, label: r.label });
    setMapFocus({ lat: r.lat, lng: r.lng, key: Date.now() });
    // While reporting, a search is the manual fallback for a poor GPS fix: drop the report pin at
    // the chosen place (no longer "at you", so a converging fix won't drag it back) and re-resolve
    // its road/district.
    if (mode === 'report') {
      setPending({ lat: r.lat, lng: r.lng, atYou: false });
      runReverseGeocode({ lat: r.lat, lng: r.lng });
    }
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

  // Floating locate control: let a high-accuracy fix converge, recenter the map on the best one,
  // then report how precise it ended up. The pulsing "You" marker + accuracy ring track each
  // improvement. A coarse fix (typically desktop WiFi/IP) points the user at the address search.
  const locateMe = React.useCallback((): void => {
    if (!navigator.geolocation) {
      showToast(tFormat(lang, 'loc.unavailable', {}));
      return;
    }
    setLocating(true);
    const track = (lat: number, lng: number, accuracyM: number): void => {
      setUserLoc({ lat, lng });
      setUserAccuracyM(accuracyM);
    };
    void locateWithAccuracy({
      desiredAccuracyM: 30,
      onProgress: (fix) => track(fix.lat, fix.lng, fix.accuracyM),
    }).then(
      (fix) => {
        track(fix.lat, fix.lng, fix.accuracyM);
        setMapFocus({ lat: fix.lat, lng: fix.lng, key: Date.now() });
        setLocating(false);
        const m = Math.round(fix.accuracyM);
        if (fix.accuracyM > 100) {
          showToast(tFormat(lang, 'loc.approx', { m }), tFormat(lang, 'loc.searchAction', {}), () => searchBoxRef.current?.focus());
        } else {
          showToast(tFormat(lang, 'loc.found', { m }));
        }
      },
      (err: unknown) => {
        setLocating(false);
        const denied = typeof err === 'object' && err !== null && (err as GeolocationPositionError).code === 1;
        // A denied permission is fixable — offer step-by-step help to re-enable it.
        if (denied) showToast(tFormat(lang, 'loc.denied', {}), tFormat(lang, 'loc.enableHelp', {}), () => setLocHelpOpen(true));
        else showToast(tFormat(lang, 'loc.failed', {}));
      }
    );
  }, [showToast, lang]);

  const highCount = filterCounts.high;
  const totalCount = active.length;

  // `isolation: isolate` gives the map area its own stacking context so Leaflet's internal
  // z-indexes (panes 200–700, controls up to 1000) stay contained instead of leaking into the
  // root context — otherwise they paint over the TopBar's overflow menu / search-results dropdowns.
  const mapAreaStyle: React.CSSProperties = isMobile
    ? { position: 'relative', isolation: 'isolate', height: '52vh', flex: 'none', background: 'var(--bw-map-bg)' }
    : { flex: 1, position: 'relative', isolation: 'isolate', minWidth: 0, background: 'var(--bw-map-bg)' };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', overflow: 'hidden', color: 'var(--bw-ink)' }}>
      <TopBar
        isMobile={isMobile}
        // A guest session is intentionally shown as "not signed in" in the bar, so the guest still
        // sees a "Sign in" affordance to upgrade (rather than a profile avatar + Sign out).
        auth={auth?.role === 'GUEST' ? null : auth}
        onReport={startReport}
        onShare={() => setShareOpen(true)}
        onSOS={() => setSosOpen(true)}
        onSignIn={() => setLogin({ open: true })}
        onSignOut={logout}
        onSearchSelect={onSearchSelect}
        searchRef={searchBoxRef}
        onNotify={() => setNotifyOpen(true)}
        notifyOn={notifyPrefs.enabled}
        onDashboard={() => setDashboardOpen(true)}
        onWaterChart={() => setWaterChartOpen(true)}
        onRescueChart={() => {
          // The backend requires auth to read /rescue, so prompt sign-in before opening the chart.
          if (!requireFullAuth('Sign in to view rescue requests by district.')) return;
          setRescueChartOpen(true);
          void rescues.refetch(true);
        }}
        onSupport={() => setSupportOpen(true)}
        onShowFeatures={() => { setFeaturesOpen(true); if (auth && auth.role !== 'GUEST') void acceptedFeatures.refetch(true); }}
        isAdmin={!!isAdmin}
        onAdmin={() => { setAdminOpen(true); void allFeedback.refetch(true); }}
        onResponse={() => {
          // /rescue reads need auth; prompt sign-in before opening, then warm the data.
          if (!requireFullAuth('Sign in to open the response console.')) return;
          setResponseOpen(true);
          void rescues.refetch(true);
        }}
      />

      {activeAlert && (
        <AlertRibbon alert={activeAlert} onClose={() => setDismissedAlerts((s) => new Set(s).add(activeAlert.id))} />
      )}

      {alertModal && <AlertModal alert={alertModal.alert} action={alertModal.action} onClose={() => setAlertModal(null)} />}

      <div style={{ flex: 1, display: 'flex', flexDirection: isMobile ? 'column' : 'row', overflow: isMobile ? 'auto' : 'hidden' }}>
        <div style={mapAreaStyle}>
          <FloodMap
            userLoc={userLoc}
            userAccuracyM={userAccuracyM}
            reports={visible}
            centers={centerList}
            roadSegments={visibleRoadSegments}
            possibleClosures={visiblePossibleClosures}
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

          {/* Floating "show my location" control — recenters the map on a fresh GPS fix. */}
          <LocateButton onClick={locateMe} locating={locating} />

          {/* Report-mode hint */}
          {mode === 'report' && (
            <div style={{ position: 'absolute', top: 14, left: '50%', transform: 'translateX(-50%)', zIndex: 500, display: 'flex', alignItems: 'center', gap: 9, maxWidth: '94%', padding: '10px 13px', background: '#0F172A', color: '#fff', borderRadius: 13, boxShadow: '0 8px 24px rgba(15,23,42,.35)', fontSize: 12.5, fontWeight: 700 }}>
              <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#0EA5E9', boxShadow: '0 0 0 4px rgba(14,165,233,.3)', flex: 'none' }} />
              <span style={{ lineHeight: 1.3 }}>{
                !pending?.atYou
                  ? t('report.hintTap')
                  : userAccuracyM != null
                    ? tFormat(lang, 'report.hintAtYouAcc', { m: Math.round(userAccuracyM) })
                    : t('report.hintAtYou')
              }</span>
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
              captchaRequired={captchaEnabled() && auth?.role === 'GUEST'}
              onPick={(s, d, id, road, token) => void pickSeverity(s, d, id, road, token)}
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
          visitCount={visitCount}
        />
      </div>

      {/* Mobile FAB */}
      {isMobile && mode !== 'report' && (
        <button
          onClick={startReport}
          style={{ position: 'fixed', right: 16, bottom: 20, zIndex: 45, display: 'flex', alignItems: 'center', gap: 8, height: 52, padding: '0 22px', border: 0, background: 'var(--bw-primary)', color: '#fff', borderRadius: 26, fontSize: 15, fontWeight: 800, boxShadow: '0 8px 22px rgba(14,165,233,.45)', cursor: 'pointer' }}
        >
          <span style={{ fontSize: 20, fontWeight: 700 }}>+</span> {t('topbar.report')}
        </button>
      )}

      {sosOpen && (
        <SosModal hotlines={hotlineList} sending={sending} onSendRescue={() => void sendRescue()} onClose={() => setSosOpen(false)} />
      )}

      {locHelpOpen && (
        <LocationHelpModal onRetry={() => { setLocHelpOpen(false); locateMe(); }} onClose={() => setLocHelpOpen(false)} />
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
        <WaterLevelModal userLoc={userLoc} isMobile={isMobile} onClose={() => setWaterChartOpen(false)} />
      )}

      {roadsModalOpen && (
        <RoadConditionsModal
          directory={roadDirectory}
          closures={possibleClosures}
          isMobile={isMobile}
          onSelectRoad={openRoadOnMap}
          onSelectClosure={(c) => {
            setRoadsModalOpen(false);
            const mid = c.path[Math.floor(c.path.length / 2)] ?? c.path[0];
            if (mid) setMapFocus({ lat: mid.lat, lng: mid.lng, key: Date.now() });
          }}
          onClose={() => setRoadsModalOpen(false)}
        />
      )}

      {dashboardOpen && (
        <PublicDashboardModal
          reports={reportList}
          directory={roadDirectory}
          closures={possibleClosures}
          isMobile={isMobile}
          now={now}
          onShowOnMap={(loc) => setMapFocus({ lat: loc.lat, lng: loc.lng, key: Date.now() })}
          onClose={() => setDashboardOpen(false)}
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

      {shareOpen && (
        <ShareModal
          text={shareData.text}
          url={shareData.url}
          links={shareData.links}
          activeCount={active.length}
          isMobile={isMobile}
          canNativeShare={canNativeShare}
          onNativeShare={() => void nativeShare()}
          onCopy={(t, msg) => void copyShare(t, msg)}
          onClose={() => setShareOpen(false)}
        />
      )}
      {supportOpen && (
        <SupportModal qrSrc={GCASH_QR_SRC} isMobile={isMobile} onClose={() => setSupportOpen(false)} />
      )}

      {featuresOpen && (
        <FeaturesModal
          isMobile={isMobile}
          auth={auth}
          acceptedFeatures={acceptedFeatures.data ?? []}
          onSuggest={() => { if (requireFullAuth('Sign in to suggest a feature or report a bug.')) setFeedbackOpen(true); }}
          onClose={() => setFeaturesOpen(false)}
        />
      )}

      {feedbackOpen && (
        <FeedbackFormModal isMobile={isMobile} sending={feedbackSending} onSubmit={submitFeedback} onClose={() => setFeedbackOpen(false)} />
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
          feedback={allFeedback.data ?? []}
          onUpdateFeedbackStatus={updateFeedbackStatus}
          onClose={() => setAdminOpen(false)}
        />
      )}

      {responseOpen && isAdmin && (
        <ResponseConsole
          rescues={rescueList}
          reports={active}
          centers={centerList}
          roadSegments={roadList}
          alerts={alertList}
          userLoc={userLoc}
          now={now}
          isMobile={isMobile}
          loading={rescues.loading && rescueList.length === 0}
          error={rescues.error}
          busyId={rescueBusyId}
          onUpdateRescueStatus={(id, s) => void onUpdateRescueStatus(id, s)}
          onClose={() => setResponseOpen(false)}
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
