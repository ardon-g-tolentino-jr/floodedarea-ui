import React from 'react';
import type { AlertLevel, FeedbackStatus, FloodAlert, FloodProneArea, FloodReport, LatLng, NewAlert, NewCenter, NewFeedback, NewFloodProneArea, NewHotline, NewReport, ReportStatus, RescueStatus, Road, RoadSegment, Severity, Trip, TripStop, WarnArea } from './types';
import { useAuth } from './hooks/useAuth';
import { captchaEnabled } from './utils/turnstile';
import { useIsMobile } from './hooks/useBreakpoint';
import { useWakeLock } from './hooks/useWakeLock';
import { useAcceptedFeedback, useAlerts, useAllFeedback, useCenters, useFloodProneAreas, useHotlines, useReports, useRescues, useSettings, useSocialPosts } from './hooks/useDomainData';
import { useActivityStream } from './hooks/useActivityStream';
import { useVisitCounter } from './hooks/useVisitCounter';
import { useI18n, tFormat } from './i18n';
import { mutations } from './api/queries';
import { ApiError, API_BASE } from './api/client';
import type { GeoResult } from './api/geocode';
import { reverseGeocode } from './api/geocode';
import type { MapFocus, SearchMark } from './components/map/FloodMap';
import { SEVERITY_PRESET, SEV_RANK } from './utils/floodMeta';
import { buildShareText, buildShareLinks, buildReportShareText, buildReportUrl, buildReportOgUrl, buildFloodDigest, FB_PAGE_URL } from './utils/share';
import {
  alertsForUser,
  alertsInMonitorArea,
  buildPossibleClosures,
  buildRoadDirectory,
  computeStatus,
  enrichReports,
  matchingProneZone,
  nearbyOwnActiveReport,
  type EnrichedReport,
  type PossibleClosure,
  type RoadEntry,
  WATER_RISE_DEFAULT,
  MONITOR_RADIUS_KM,
} from './utils/viewModel';
import { loadRoads, roadsLoaded, snapToRoad } from './utils/roadSnap';
import { locateWithAccuracy, watchLocation, WEAK_FIX_M } from './utils/geolocate';
import { kmBetween } from './utils/geo';
import {
  loadTrip,
  matchTripStops,
  groupStopMatches,
  newStopId,
  newTripId,
  EMPTY_TRIP,
  MAX_STOPS,
  STOP_RADIUS_DEFAULT,
  DUPLICATE_STOP_KM,
  ALERT_BURST,
  TRIP_STORAGE_KEY,
} from './utils/tripWatch';
import type { SearchBoxHandle } from './components/panels/SearchBox';
import TopBar from './components/panels/TopBar';
import AlertRibbon from './components/panels/AlertRibbon';
import ActivityTicker from './components/panels/ActivityTicker';
import AlertModal, { type AlertSource } from './components/panels/AlertModal';
import Sidebar from './components/panels/Sidebar';
import FloodMap from './components/map/FloodMap';
import RoadLegend from './components/map/RoadLegend';
import LocateButton from './components/map/LocateButton';
import ReportDetailCard from './components/panels/ReportDetailCard';
import EvacDetailCard from './components/panels/EvacDetailCard';
import ReportOptions from './components/panels/ReportOptions';
import SeverityPicker from './components/panels/SeverityPicker';
import QuickReportSheet from './components/panels/QuickReportSheet';
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
import CommunityFeedbackModal from './components/panels/CommunityFeedbackModal';
import AdminPanel from './components/panels/AdminPanel';
import AdminReportIncidentModal from './components/panels/AdminReportIncidentModal';
import FloodDigestModal from './components/panels/FloodDigestModal';
import AdminWarnZoneModal from './components/panels/AdminWarnZoneModal';
import AdminScopedWarnModal from './components/panels/AdminScopedWarnModal';
import ZoneReportModal, { type ZoneReportOptions } from './components/panels/ZoneReportModal';
import ResponseConsole from './components/panels/ResponseConsole';
import ChatWidget from './components/panels/ChatWidget';
import TripPanel from './components/panels/TripPanel';
import AddStopSheet from './components/panels/AddStopSheet';
import LoginView from './views/LoginView';

const NOTIFY_STORAGE_KEY = 'baha_notify_v1';
const LIVE_STORAGE_KEY = 'baha_live_v1';
const REPORT_MODE_STORAGE_KEY = 'baha_report_mode_v1';
const GUEST_NUDGE_STORAGE_KEY = 'baha_guest_nudge_v1';
const FLOOD_PRONE_STORAGE_KEY = 'baha_flood_prone_v1';

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

/** Remembered report entry choice — orders/highlights the two ReportOptions, both stay clickable. */
function loadReportPref(): 'report' | 'quick' {
  try {
    return localStorage.getItem(REPORT_MODE_STORAGE_KEY) === 'quick' ? 'quick' : 'report';
  } catch {
    return 'report';
  }
}

function loadGuestNudgeDismissed(): boolean {
  try {
    return localStorage.getItem(GUEST_NUDGE_STORAGE_KEY) === '1';
  } catch {
    return false;
  }
}

/** Flood-prone filter — defaults ON, so only an explicit '0' turns it off. */
function loadFloodPronePref(): boolean {
  try {
    return localStorage.getItem(FLOOD_PRONE_STORAGE_KEY) !== '0';
  } catch {
    return true;
  }
}

const DEFAULT_LOCATION: LatLng = { lat: 14.66, lng: 121.12 }; // Marikina Heights

type PendingPin = LatLng & { atYou: boolean };

/** A flood-alert dialog: the alert to show plus an optional primary action (e.g. jump to the
 *  report on the map). Used for rainfall/PAGASA alerts, trip-stop alerts, and new-nearby-report
 *  notifications alike — `source` drives the AlertModal chip that tells them apart. */
type AlertDialog = { alert: FloodAlert; action?: { label: string; run: () => void }; source?: AlertSource };

/** Map a report severity onto an alert level for the dialog's color/label. */
const SEV_TO_LEVEL: Record<Severity, AlertLevel> = { high: 'red', medium: 'orange', low: 'yellow' };
const ARCHIVE_MAX = 10; // Archive keeps the 10 most recent expired reports; they linger indefinitely
// with no activity and are only pushed out as newer reports expire — a lasting record that flooding happened.
// A zone counts as "already reported" (ZoneReportModal's disabled/unticked rows) when an active
// report's center lies within this of the zone's own center.
const ZONE_ALREADY_REPORTED_KM = 0.15;

const App: React.FC = () => {
  const { auth, loginWithGoogle, ensureGuest, logout } = useAuth();
  const isMobile = useIsMobile();
  const visitCount = useVisitCounter();
  const { t, lang } = useI18n();

  const reports = useReports();
  const centers = useCenters();
  const hotlines = useHotlines();
  const alerts = useAlerts();
  const floodProne = useFloodProneAreas();
  const rescues = useRescues();
  const settings = useSettings();
  const acceptedFeedback = useAcceptedFeedback();
  // Admin-only queue — gated so a normal visitor never hits the admin endpoint (it 403s). The fetch
  // starts automatically when an admin session appears.
  const allFeedback = useAllFeedback(auth?.role === 'ADMIN');
  // Admin-only social auto-post status list — same gate as allFeedback above.
  const socialPosts = useSocialPosts(auth?.role === 'ADMIN');

  const [userLoc, setUserLoc] = React.useState<LatLng>(DEFAULT_LOCATION);
  // Accuracy (meters) of the latest GPS fix — drives the map's uncertainty ring and the
  // "approximate location" guidance. Null until the first fix lands.
  const [userAccuracyM, setUserAccuracyM] = React.useState<number | null>(null);
  // Lets a coarse-fix toast jump focus into the TopBar location search (the manual fallback).
  const searchBoxRef = React.useRef<SearchBoxHandle>(null);
  // "How to enable location" help modal — opened from the permission-denied toast.
  const [locHelpOpen, setLocHelpOpen] = React.useState(false);
  // True while the report flow is converging a GPS fix, so the report banner shows a transient
  // "Finding your location…" instead of prematurely declaring that location couldn't be found.
  const [reportLocating, setReportLocating] = React.useState(false);

  // Ticking clock so report expiry (severity-scaled TTL) and the safety status update in real time
  // without waiting on a refetch.
  const [now, setNow] = React.useState<number>(() => Date.now());
  React.useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 15000);
    return () => window.clearInterval(id);
  }, []);

  // Global settings (including the rain toggle) have no SSE event of their own, so one admin
  // flipping rain wouldn't reach other clients until they reload. Poll every 5 min — ample, since
  // the predictive model only steps hourly anyway.
  React.useEffect(() => {
    const id = window.setInterval(() => void settings.refetch(true), 300000);
    return () => window.clearInterval(id);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Timestamp of the most recent SSE activity event — drives the ActivityTicker's pulsing "LIVE"
  // dot (pulsing within ~90s of an event, static otherwise). `now` above already re-renders every
  // 15s, which is enough resolution to flip the dot off without a dedicated timer.
  const [lastEventAt, setLastEventAt] = React.useState<number | null>(null);

  // UI state. 'quick' is the in-transit mode: a live GPS watch keeps `pending` glued to the
  // vehicle's current position and each severity tap posts immediately (see the quick-mode effect
  // and quickPost below), vs. 'report' where the pin is fixed once and adjustable.
  const [mode, setMode] = React.useState<'idle' | 'report' | 'quick'>('idle');
  const [pending, setPending] = React.useState<PendingPin | null>(null);
  // Remembered report entry point — orders/highlights ReportOptions (mobile fan-out + desktop
  // popover). Persisted below alongside the other localStorage-backed prefs.
  const [reportPref, setReportPref] = React.useState<'report' | 'quick'>(loadReportPref);
  // Dismissible sidebar nudge for guest/no-session visitors — persisted per device.
  const [guestNudgeDismissed, setGuestNudgeDismissed] = React.useState<boolean>(loadGuestNudgeDismissed);
  // Mobile-only: whether the bottom-center FAB has fanned out its two ReportOptions.
  const [fanOpen, setFanOpen] = React.useState(false);
  // Road auto-detected from the pending pin via reverse geocoding (which street it's on).
  const [detectedRoad, setDetectedRoad] = React.useState<{ road: string | null; district: string | null; barangay: string | null }>({ road: null, district: null, barangay: null });
  const [detectingRoad, setDetectingRoad] = React.useState(false);
  const geocodeReqId = React.useRef(0);
  const [selectedReportId, setSelectedReportId] = React.useState<number | null>(null);
  const [selEvacId, setSelEvacId] = React.useState<number | null>(null);
  const [tab, setTab] = React.useState<'nearby' | 'activity' | 'archive'>('nearby');
  const [filters, setFilters] = React.useState<Record<Severity, boolean>>({ high: true, medium: true, low: true });
  const [roadFilters, setRoadFilters] = React.useState<Record<Road, boolean>>({ passable: true, risky: true, impassable: true });
  const [projectedRiseCm, setProjectedRiseCm] = React.useState<number>(WATER_RISE_DEFAULT);
  const [monitorRadiusKm, setMonitorRadiusKm] = React.useState<number>(MONITOR_RADIUS_KM);
  // Shelter markers start hidden — users opt in via the sidebar toggle.
  const [showShelters, setShowShelters] = React.useState(false);
  const [showRoads, setShowRoads] = React.useState(true);
  // Flood-prone zone circles + map name bubbles — a map-layer toggle only, defaults ON and
  // persists across visits (loadFloodPronePref). It never hides a report from the list/feed/
  // counts; those always show every live report regardless of whether it sits in a known
  // flood-prone zone.
  const [showFloodProne, setShowFloodProne] = React.useState(loadFloodPronePref);
  // Flips once the bundled road network finishes loading, so the road overlay re-derives with it.
  const [roadsReady, setRoadsReady] = React.useState(false);
  const [sosOpen, setSosOpen] = React.useState(false);
  const [mapFocus, setMapFocus] = React.useState<MapFocus | null>(null);
  const [locating, setLocating] = React.useState(false);
  const [searchMark, setSearchMark] = React.useState<SearchMark | null>(null);
  const [notifyPrefs, setNotifyPrefs] = React.useState<NotifyPrefs>(loadNotifyPrefs);
  const [notifyOpen, setNotifyOpen] = React.useState(false);
  // Trip monitoring: an ordered set of tagged stops, watched for new flood reports while active.
  const [trip, setTrip] = React.useState<Trip>(loadTrip);
  const [addStopOpen, setAddStopOpen] = React.useState(false);
  const [addStopBusy, setAddStopBusy] = React.useState(false);
  const [selectedStopId, setSelectedStopId] = React.useState<string | null>(null);
  // Mobile-only bottom sheet for the trip panel, opened from the floating trip chip.
  const [tripSheetOpen, setTripSheetOpen] = React.useState(false);
  useWakeLock(trip.active);
  // Two things at fixed/bottom:0/zIndex:1110 stack badly (see the report-mode sheets' own
  // comments) — force-close the trip sheet the instant a report flow starts.
  React.useEffect(() => { if (mode !== 'idle') setTripSheetOpen(false); }, [mode]);
  const [waterChartOpen, setWaterChartOpen] = React.useState(false);
  const [roadsModalOpen, setRoadsModalOpen] = React.useState(false);
  const [dashboardOpen, setDashboardOpen] = React.useState(false);
  const [rescueChartOpen, setRescueChartOpen] = React.useState(false);
  const [supportOpen, setSupportOpen] = React.useState(false);
  const [shareOpen, setShareOpen] = React.useState(false);
  const [featuresOpen, setFeaturesOpen] = React.useState(false);
  const [feedbackBoardOpen, setFeedbackBoardOpen] = React.useState(false);
  const [feedbackOpen, setFeedbackOpen] = React.useState(false);
  const [feedbackSending, setFeedbackSending] = React.useState(false);
  const [adminOpen, setAdminOpen] = React.useState(false);
  const [responseOpen, setResponseOpen] = React.useState(false);
  // Admin "Report incident" modal, and the report currently offered up for social sharing.
  const [incidentOpen, setIncidentOpen] = React.useState(false);
  const [shareReportTarget, setShareReportTarget] = React.useState<FloodReport | null>(null);
  // Admin "Flood digest" modal — the consolidated situational-roundup post (all active reports),
  // distinct from shareReportTarget's single-report share.
  const [digestOpen, setDigestOpen] = React.useState(false);
  // Admin "Warn this zone" modal target — the manual second action, never auto-triggered by
  // saving/editing a zone (see AdminWarnZoneModal's doc comment).
  const [zoneWarnTarget, setZoneWarnTarget] = React.useState<FloodProneArea | null>(null);
  // Admin "Warn an area" modal (AdminScopedWarnModal) — the scoped/bulk counterpart to
  // zoneWarnTarget above, cascading island/province/city/area down to a region of zones.
  const [scopedWarnOpen, setScopedWarnOpen] = React.useState(false);
  // Admin "Report flooding on zones" modal (ZoneReportModal) — bulk from AdminPanel's zones tab,
  // or a single zone preselected from a row's "⚡ Report now" or a map bubble tap.
  const [zoneReportOpen, setZoneReportOpen] = React.useState(false);
  const [zoneReportPreselect, setZoneReportPreselect] = React.useState<number | null>(null);
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

  // Quick mode posts on every severity tap, so the guest nudge is fired at most once per session
  // (otherwise an in-transit reporter gets a sign-in toast after every tap). The timer is tracked so
  // a rapid second post can't leave a stray toast queued behind it.
  const guestNudgeShown = React.useRef(false);
  const guestNudgeTimer = React.useRef<number | undefined>(undefined);
  React.useEffect(() => () => window.clearTimeout(guestNudgeTimer.current), []);

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
    // A running trip also needs the road index for the road-name arm of stop matching, even if
    // the visible Roads overlay is off.
    if ((!showRoads && !trip.active) || roadsLoaded()) return;
    let cancelled = false;
    void fetch(`${import.meta.env.BASE_URL}roads.json`)
      .then((r) => (r.ok ? r.json() : null))
      .then((asset) => { if (!cancelled && asset) { loadRoads(asset); setRoadsReady(true); } })
      .catch(() => {/* overlay shows pins only */});
    return () => { cancelled = true; };
  }, [showRoads, trip.active]);

  // Persist the alert subscription across sessions.
  React.useEffect(() => {
    try { localStorage.setItem(NOTIFY_STORAGE_KEY, JSON.stringify(notifyPrefs)); } catch {/* ignore */}
  }, [notifyPrefs]);

  // Persist the trip (stops + active flag) across sessions.
  React.useEffect(() => {
    try { localStorage.setItem(TRIP_STORAGE_KEY, JSON.stringify(trip)); } catch {/* ignore */}
  }, [trip]);

  // Persist the admin live-stream preference.
  React.useEffect(() => {
    try { localStorage.setItem(LIVE_STORAGE_KEY, liveStream ? '1' : '0'); } catch {/* ignore */}
  }, [liveStream]);

  // Persist the flood-prone map-layer toggle across sessions.
  React.useEffect(() => {
    try { localStorage.setItem(FLOOD_PRONE_STORAGE_KEY, showFloodProne ? '1' : '0'); } catch {/* ignore */}
  }, [showFloodProne]);

  // Persist the remembered report entry-point preference.
  React.useEffect(() => {
    try { localStorage.setItem(REPORT_MODE_STORAGE_KEY, reportPref); } catch {/* ignore */}
  }, [reportPref]);

  // Dismiss is one-way for the device — no un-dismiss path, so a plain write on click (not an
  // effect) is enough.
  const dismissGuestNudge = (): void => {
    setGuestNudgeDismissed(true);
    try { localStorage.setItem(GUEST_NUDGE_STORAGE_KEY, '1'); } catch {/* ignore */}
  };

  // Only admins can switch the live stream off; everyone else stays always-on.
  const isAdmin = auth?.role === 'ADMIN';

  // The public board is loaded on mount; re-pull when the identity changes so `upvotedByMe` reflects
  // the new account/guest. (The admin queue auto-loads via its `enabled` gate once an admin appears.)
  React.useEffect(() => { if (auth) void acceptedFeedback.refetch(true); }, [auth?.userId]); // eslint-disable-line react-hooks/exhaustive-deps
  const streamEnabled = !isAdmin || liveStream;

  // Live activity → refresh the affected collection in the background. `lastEventAt` only drives the
  // ActivityTicker's pulsing-vs-static LIVE dot — the stream contract itself (event name only, no
  // payload) is untouched.
  useActivityStream((event) => {
    setLastEventAt(Date.now());
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
  const floodProneList = floodProne.data ?? [];
  const rescueList = rescues.data ?? [];

  // Proximity-gate the alert list before anything shows it: a global alert (no geometry) always
  // passes through unchanged; a geo-stamped warning (from a zone's "Warn" action) only applies to
  // people near it. See alertsForUser's doc comment for the fail-open reasoning.
  const visibleAlerts = React.useMemo(() => alertsForUser(alertList, userLoc), [alertList, userLoc]);

  // Warnings issued anywhere inside the user's "My area" circle — surfaced as a label on the live
  // ticker. Fed the RAW `alertList`, deliberately NOT `visibleAlerts`: that list is already cut to
  // the tight "you are practically standing in it" gate (zone radius + 300 m), which would have
  // discarded exactly the warnings this is meant to catch — the ones near you but not on top of
  // you. Nearest first, so the ticker can lead with the closest.
  const monitorAreaWarnings = React.useMemo(
    () => alertsInMonitorArea(alertList, userLoc, monitorRadiusKm),
    [alertList, userLoc, monitorRadiusKm]
  );

  // Default OFF (unlike the other three settings flags, which default on) — a fetch failure or a
  // settings row that predates this feature must never make every report look like it's worsening.
  const rainActive = settings.data?.rainActive === true;

  const enriched = React.useMemo(
    () => enrichReports(reportList, userLoc, auth?.userId ?? null, now, rainActive),
    [reportList, userLoc, auth?.userId, now, rainActive]
  );

  // Only reports still within their severity-scaled freshness window count as "live" — expired
  // ones drop off the map, feed, status and counts.
  const active = React.useMemo(() => enriched.filter((r) => !r.expired), [enriched]);

  // Zones ZoneReportModal should treat as "already reported" — a fixed ~150 m dedup gate distinct
  // from zonesWithStatus's radius-based "is it currently flooded" signal (that one drives the map
  // bubble color; this one just keeps the bulk-report checklist from posting an obvious duplicate).
  const alreadyReportedZoneIds = React.useMemo(
    () =>
      floodProneList
        .filter((z) =>
          active.some((r) => kmBetween({ lat: z.latitude, lng: z.longitude }, { lat: r.latitude, lng: r.longitude }) <= ZONE_ALREADY_REPORTED_KM)
        )
        .map((z) => z.id),
    [floodProneList, active]
  );

  // Current per-stop status for the trip panel/map badges — separate from the alert effect below,
  // which only fires for newly-arrived reports. `roadsReady` isn't read directly but the road arm's
  // quality depends on the index being loaded, so recompute once it lands.
  const tripStopMatches = React.useMemo(() => {
    void roadsReady;
    return matchTripStops(active, trip.stops);
  }, [active, trip.stops, roadsReady]);
  const tripStopStatus = React.useMemo(() => groupStopMatches(tripStopMatches), [tripStopMatches]);
  const tripAlertStopIds = React.useMemo(
    () => trip.stops.filter((s) => (tripStopStatus.get(s.id)?.length ?? 0) > 0).map((s) => s.id),
    [trip.stops, tripStopStatus]
  );

  // Stop id → the flood-prone zone it sits in. Advisory ("this street floods in heavy rain"),
  // deliberately distinct from tripStopMatches' live "water is there right now" signal. Gated on the
  // flood-prone toggle, so hiding the layer hides its advisories too.
  const tripStopZones = React.useMemo(() => {
    const m = new Map<string, FloodProneArea>();
    if (!showFloodProne) return m;
    for (const s of trip.stops) {
      const z = matchingProneZone(floodProneList, { lat: s.lat, lng: s.lng });
      if (z) m.set(s.id, z);
    }
    return m;
  }, [trip.stops, floodProneList, showFloodProne]);

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
  // Nearby must mean nearby — the safety banner already says "no flooding within 2.5 km" while this
  // list used to show every visible report sorted but never cut off, including ones tens of km
  // away. Cut to the "My area" monitoring radius. The selected report is kept regardless of
  // distance so a deep link (?report=<id>) or a marker tap never selects a row that isn't in the
  // list. Note: `visible` itself (below) is left unfiltered by radius — it still feeds the map,
  // which must keep pinning every live report no matter how far.
  const nearby = React.useMemo(
    () =>
      visible
        .filter((r) => r.distKm <= monitorRadiusKm || r.id === selectedReportId)
        .sort((a, b) => a.distKm - b.distKm),
    [visible, monitorRadiusKm, selectedReportId]
  );
  const feed = React.useMemo(
    () => [...active].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()),
    [active]
  );
  // Expired reports linger here so others can see a report happened, even after it drops off the
  // live map/feed. We keep the 10 most recent (by createdAt) with no time limit: with no new activity
  // they stay put, and are only pushed out as newer reports expire — a record that flooding occurred.
  const archived = React.useMemo(
    () =>
      enriched
        .filter((r) => r.expired && r.status !== 'resolved') // resolved reports were closed on purpose — not archive
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
        .slice(0, ARCHIVE_MAX),
    [enriched]
  );
  const status = React.useMemo(() => computeStatus(active, lang), [active, lang]);

  // ── Deep-link: open focused on a shared report (?report=<id>) ──
  // A shared social link is `…/?report=<id>`. On load, once reports arrive, select that report and
  // fly the map to it via the canonical focus pattern. Runs once (guarded), then leaves the param in
  // the URL so the address bar stays shareable.
  const deepLinkHandled = React.useRef(false);
  React.useEffect(() => {
    if (deepLinkHandled.current) return;
    const idStr = new URLSearchParams(window.location.search).get('report');
    if (!idStr) { deepLinkHandled.current = true; return; }
    const id = Number(idStr);
    if (!Number.isFinite(id)) { deepLinkHandled.current = true; return; }
    const r = enriched.find((x) => x.id === id);
    if (r) {
      deepLinkHandled.current = true;
      setTab('nearby');
      setSelectedReportId(id);
      setMapFocus({ lat: r.latitude, lng: r.longitude, key: Date.now() });
    } else if (!reports.loading) {
      // Reports settled but this id is gone (expired/removed) — tell the user instead of silently doing nothing.
      deepLinkHandled.current = true;
      showToast('That flood report is no longer active.');
    }
    // else: reports still loading — this effect re-runs when `enriched` updates.
  }, [enriched, reports.loading]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── New-flood-report alert subscription ──
  // Detect reports that arrive (via the SSE-driven refetch) and alert when they match the
  // user's criteria. `enriched` already carries distance and `mine`, so matching is local.
  const seenReportIds = React.useRef<Set<number>>(new Set());
  const alertsPrimed = React.useRef(false);

  React.useEffect(() => {
    // First population (initial load): remember existing reports without alerting. Wait for the
    // real fetch to land — `enriched` is `[]` on the very first render (reports.data is still
    // null), and priming against that empty set would make every already-existing report look
    // "new" once the fetch actually resolves.
    if (reports.loading) return;
    if (!alertsPrimed.current) {
      for (const r of enriched) seenReportIds.current.add(r.id);
      alertsPrimed.current = true;
      return;
    }
    const fresh = enriched.filter((r) => !seenReportIds.current.has(r.id));
    if (!fresh.length) return;
    for (const r of fresh) seenReportIds.current.add(r.id);

    // Shared eligibility for both arms below.
    const candidates = fresh.filter(
      (r) => !r.mine && r.status === 'active' && !r.expired && notifyPrefs.severities[r.severity]
    );
    if (!candidates.length) return;

    // ── Arm 1: trip stops. Independent of notifyPrefs.enabled — starting a trip IS the opt-in.
    const stopMatches = trip.active && trip.stops.length ? matchTripStops(candidates, trip.stops) : [];
    const claimedIds = new Set(stopMatches.map((m) => m.report.id));

    // ── Arm 2: the existing personal-radius alert, minus anything arm 1 already claimed.
    const nearbyMatches = notifyPrefs.enabled
      ? candidates.filter((r) => !claimedIds.has(r.id) && r.distKm <= notifyPrefs.radiusKm)
      : [];

    if (!stopMatches.length && !nearbyMatches.length) return;

    const nowIso = new Date().toISOString();
    // A stop the user explicitly tagged is a stronger signal than the ambient radius, so trip
    // matches win the modal; any nearby remainder surfaces as a toast instead of a second dialog.
    if (stopMatches.length) {
      const stopReports = [...new Map(stopMatches.map((m) => [m.report.id, m])).values()];

      if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
        for (const m of stopMatches.slice(0, 3)) {
          const stop = trip.stops.find((s) => s.id === m.stopId);
          try {
            new Notification(t('trip.alertTitleOne'), {
              body: tFormat(lang, 'trip.alertBodyOne', { sev: m.report.sev.label, stop: stop?.label ?? '', name: m.report.name, depth: m.report.depthCm }),
            });
          } catch {/* ignore */}
        }
      }

      if (stopReports.length >= ALERT_BURST) {
        const worst = stopReports.map((m) => m.report).reduce((w, r) => (SEV_RANK[r.severity] > SEV_RANK[w.severity] ? r : w), stopReports[0].report);
        setAlertModal({
          alert: {
            id: -worst.id,
            title: tFormat(lang, 'trip.alertTitleMany', { n: stopReports.length }),
            body: tFormat(lang, 'trip.alertBodyMany', { n: stopReports.length, sev: worst.sev.label.toLowerCase(), name: worst.name }),
            region: null,
            level: SEV_TO_LEVEL[worst.severity],
            active: true,
            latitude: null,
            longitude: null,
            radiusM: null,
            areaId: null,
            createdAt: nowIso,
            updatedAt: nowIso,
          },
          source: 'trip',
        });
      } else {
        const m = stopMatches[0];
        const stop = trip.stops.find((s) => s.id === m.stopId);
        const stopsForReport = stopMatches.filter((sm) => sm.report.id === m.report.id).length;
        setAlertModal({
          alert: {
            id: -m.report.id,
            title: stopReports.length > 1 ? tFormat(lang, 'trip.alertTitleMany', { n: stopReports.length }) : t('trip.alertTitleOne'),
            body: tFormat(lang, 'trip.alertBodyOne', { sev: m.report.sev.label, stop: stop?.label ?? '', name: m.report.name, depth: m.report.depthCm })
              + (stopsForReport > 1 ? ` (+${stopsForReport - 1})` : ''),
            region: m.report.name ?? null,
            level: SEV_TO_LEVEL[m.report.severity],
            active: true,
            latitude: null,
            longitude: null,
            radiusM: null,
            areaId: null,
            createdAt: nowIso,
            updatedAt: nowIso,
          },
          action: {
            label: t('trip.viewOnMap'),
            run: () => {
              setTab('nearby');
              setSelEvacId(null);
              setSelectedStopId(null);
              setSelectedReportId(m.report.id);
              setMapFocus({ lat: m.report.latitude, lng: m.report.longitude, key: Date.now() });
            },
          },
          source: 'trip',
        });
      }
      if (nearbyMatches.length) {
        showToast(tFormat(lang, 'status.stayAlertLine', { km: nearbyMatches[0].distKm.toFixed(1), name: nearbyMatches[0].name, sev: nearbyMatches[0].sev.label, rising: '' }));
      }
      playAlertSound();
      return;
    }

    // No trip match this round — the existing "near me" behaviour, unchanged.
    const matches = nearbyMatches;
    if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
      for (const r of matches.slice(0, 3)) {
        try {
          new Notification(t('notify.alertTitleOne'), {
            body: `${r.sev.label} flooding ~${r.distKm.toFixed(1)} km away at ${r.name} (${r.depthCm} cm).`,
          });
        } catch {/* ignore */}
      }
    }

    if (matches.length === 1) {
      const r = matches[0];
      setAlertModal({
        alert: {
          id: -r.id, // synthetic id (negative) so it never collides with rainfall alerts
          title: t('notify.alertTitleOne'),
          body: `${r.sev.label} flooding reported ~${r.distKm.toFixed(1)} km away at ${r.name} — about ${r.depthCm} cm deep.`,
          region: r.name ?? null,
          level: SEV_TO_LEVEL[r.severity],
          active: true,
          latitude: null,
          longitude: null,
          radiusM: null,
          areaId: null,
          createdAt: nowIso,
          updatedAt: nowIso,
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
        source: 'nearby',
      });
    } else {
      const worst = matches.find((r) => r.severity === 'high') ?? matches.find((r) => r.severity === 'medium') ?? matches[0];
      setAlertModal({
        alert: {
          id: -worst.id,
          title: tFormat(lang, 'notify.alertTitleMany', { n: matches.length }),
          body: `${matches.length} new floods reported within ${notifyPrefs.radiusKm} km. The nearest is ${worst.sev.label.toLowerCase()} at ${worst.name}.`,
          region: null,
          level: SEV_TO_LEVEL[worst.severity],
          active: true,
          latitude: null,
          longitude: null,
          radiusM: null,
          areaId: null,
          createdAt: nowIso,
          updatedAt: nowIso,
        },
        source: 'nearby',
      });
    }
    playAlertSound();
  }, [enriched, notifyPrefs, trip.active, trip.stops, lang, t, playAlertSound, showToast, reports.loading]);

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
    return visibleAlerts
      .filter((a) => a.active && !dismissedAlerts.has(a.id))
      .sort((a, b) => rank[b.level] - rank[a.level])[0];
  }, [visibleAlerts, dismissedAlerts]);

  // Proactively nudge on a newly-active severe (orange/red) rainfall warning. Keyed by id+level
  // so an escalation (e.g. orange → red) re-fires, but a steady warning doesn't repeat.
  const notifiedAlertLevels = React.useRef<Map<number, AlertLevel>>(new Map());
  const severeAlertsPrimed = React.useRef(false);
  const modaledAlertLevels = React.useRef<Map<number, AlertLevel>>(new Map());

  React.useEffect(() => {
    // Wait for the first alerts fetch to settle before priming, so we prime against real data and
    // not the empty initial state — otherwise every already-active alert reads as "new" the moment
    // data arrives and fires on load.
    if (alerts.loading) return;

    const severe = visibleAlerts.filter((a) => a.active && (a.level === 'red' || a.level === 'orange'));

    // First settled load: remember what's already active (id+level) without alerting. A rainfall
    // warning that was already ongoing when the user opened or navigated to the page must NOT
    // hard-interrupt them with a modal + alarm on arrival — the persistent AlertRibbon already
    // surfaces it. Only a genuinely new or escalated alert alarms. (Both the modal and the
    // OS-notification/toast paths prime here so neither re-nags on every reload.)
    if (!severeAlertsPrimed.current) {
      for (const a of severe) {
        notifiedAlertLevels.current.set(a.id, a.level);
        modaledAlertLevels.current.set(a.id, a.level);
      }
      severeAlertsPrimed.current = true;
      return;
    }

    // Hard interrupt: pop a centered modal + alarm for the worst newly-active/escalated severe
    // alert. Keyed by id+level so it re-fires on escalation (orange → red) but not on every
    // refetch. The play() rejection (autoplay block before the user's first interaction) is swallowed.
    const worstActive = severe.find((a) => a.level === 'red') ?? severe[0];
    if (worstActive && modaledAlertLevels.current.get(worstActive.id) !== worstActive.level) {
      modaledAlertLevels.current.set(worstActive.id, worstActive.level);
      setAlertModal({ alert: worstActive, source: worstActive.areaId != null ? 'zone' : 'weather' });
      playAlertSound();
    }

    // OS notification + toast: only for a newly-active/escalated severe alert.
    const fresh = severe.filter((a) => notifiedAlertLevels.current.get(a.id) !== a.level);
    if (!fresh.length) return;
    for (const a of fresh) notifiedAlertLevels.current.set(a.id, a.level);

    const worst = fresh.find((a) => a.level === 'red') ?? fresh[0];
    if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
      try { new Notification(worst.title, { body: worst.body }); } catch {/* ignore */}
    }
    showToast(worst.title);
  }, [visibleAlerts, alerts.loading, showToast, playAlertSound]);

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

  // Converge a high-accuracy GPS fix for the report flow, keeping the best reading. While the pin
  // is still "at you", re-pin/recenter to each improvement — but never yank a pin the user has
  // already tapped/searched somewhere else. Drives `reportLocating` so the banner can tell
  // "still finding" apart from "couldn't find" (which then guides the user to settings).
  // `repin` snaps the pin back onto the user first — used by the help-modal retry after the user
  // grants permission, so the fresh fix re-applies even if they'd moved the pin.
  const locateForReport = React.useCallback((repin = false): void => {
    if (repin) setPending((p) => (p ? { lat: p.lat, lng: p.lng, atYou: true } : p));
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
    setReportLocating(true);
    void locateWithAccuracy({
      desiredAccuracyM: 30,
      onProgress: (fix) => applyFix({ lat: fix.lat, lng: fix.lng }, fix.accuracyM),
    }).then(
      (fix) => { applyFix({ lat: fix.lat, lng: fix.lng }, fix.accuracyM); setReportLocating(false); },
      () => { setReportLocating(false); /* keep current location; the banner guides the user */ }
    );
  }, [runReverseGeocode]);

  // In-transit quick mode: keep `pending`/userLoc glued to a continuous GPS watch for as long as
  // the sheet is open (unlike the detailed flow's one-shot converge), so each severity tap posts at
  // wherever the vehicle currently is. Reverse-geocoding is throttled to actual movement, not every
  // fix, so it doesn't spam the geocoder while idling at a light.
  const lastQuickGeocodeLoc = React.useRef<LatLng | null>(null);
  React.useEffect(() => {
    if (mode !== 'quick') return;
    lastQuickGeocodeLoc.current = null;
    setReportLocating(true);
    let firstFix = true;
    const stop = watchLocation((fix) => {
      const loc: LatLng = { lat: fix.lat, lng: fix.lng };
      setUserLoc(loc);
      setUserAccuracyM(fix.accuracyM);
      setPending({ ...loc, atYou: true });
      if (firstFix) { firstFix = false; setReportLocating(false); }
      if (!lastQuickGeocodeLoc.current || kmBetween(lastQuickGeocodeLoc.current, loc) > 0.12) {
        lastQuickGeocodeLoc.current = loc;
        runReverseGeocode(loc);
      }
    });
    return stop;
  }, [mode, runReverseGeocode]);

  // Shared preamble for both entry points (Report flood / Quick report — see ReportOptions).
  // Provisions a guest session, runs the duplicate-report guard, clears any selected report/evac
  // card (otherwise a card selected beforehand stacks its bottom sheet under/over the new
  // report-mode sheet — both are fixed/bottom:0/zIndex:1110), remembers the choice as the
  // preference, and drops the pin at the user's location. 'report' additionally recenters the map
  // and converges a fresh GPS fix (a one-shot refinement); 'quick' instead starts a continuous GPS
  // watch once `mode` flips (see the effect above), which keeps re-pinning as the vehicle moves.
  const beginReport = async (target: 'report' | 'quick'): Promise<void> => {
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
    setReportPref(target);
    setMode(target);
    // Drop the pin at the user's location (quick mode's GPS-watch effect takes over from here).
    setPending({ ...userLoc, atYou: true });
    runReverseGeocode(userLoc);
    if (target === 'report') {
      setMapFocus({ ...userLoc, key: Date.now() });
      // Refresh the GPS fix so the pin/centering reflect where they actually are right now (the
      // on-mount fix may be stale, or fell back to the default monitoring area). If it can't get a
      // fix, the report-mode banner surfaces guidance — reporting is never blocked.
      locateForReport();
    }
  };

  const startReport = (): void => { void beginReport('report'); };
  const startQuickReport = (): void => { void beginReport('quick'); };

  const cancelReport = (): void => {
    setMode('idle');
    setPending(null);
    setReportLocating(false);
    setDetectedRoad({ road: null, district: null, barangay: null });
    setDetectingRoad(false);
  };

  const onMapClick = (latlng: LatLng): void => {
    if (mode !== 'report') return;
    setPending({ ...latlng, atYou: false });
    runReverseGeocode(latlng);
  };

  const pickSeverity = async (sev: Severity, depthCm: number, identify: boolean, road: string, captchaToken?: string, photoDataUrl?: string): Promise<void> => {
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
          // Leave report mode first — otherwise the still-open SeverityPicker sheet stacks with
          // the detail card that's about to open (both are fixed/bottom:0/zIndex:1110 on mobile).
          cancelReport();
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
        photoDataUrl,
      });
      await reports.refetch(true);
      setMode('idle');
      setPending(null);
      setDetectedRoad({ road: null, district: null, barangay: null });
      setTab('activity');
      setSelectedReportId(created.id);
      if (session.role === 'GUEST') {
        showToast(t('guest.quickNudge'), t('topbar.signIn'), () =>
          setLogin({ open: true, reason: t('guest.defaultReason') })
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

  // One-tap in-transit report: posts immediately at the live GPS location with depth/trend/road
  // from SEVERITY_PRESET (no pin drag, no depth slider — see quickPost's caller, QuickReportSheet).
  // Unlike pickSeverity, success does NOT leave report mode — the sheet stays open so a passenger
  // can mark several flooded points along the drive.
  const quickPost = async (sev: Severity, captchaToken?: string): Promise<void> => {
    const loc = pending ?? { ...userLoc, atYou: true };
    const preset = SEVERITY_PRESET[sev];
    setBusyPick(true);
    try {
      const session = await ensureGuest();
      if (!session) {
        showToast('Could not post your report. Please try again.');
        return;
      }
      if (session.role === 'GUEST' && captchaEnabled() && !captchaToken) {
        showToast('Please complete the security check, then post again.');
        return;
      }
      const dup = nearbyOwnActiveReport(enriched, loc);
      if (dup) {
        showToast('You already reported flooding here — drive on and try again further along.');
        return;
      }
      const street = detectedRoad.road?.trim() || '';
      const area = detectedRoad.barangay?.trim() || '';
      const roadName = street
        ? (area && area !== street ? `${street}, ${area}` : street)
        : area || detectedRoad.district?.trim() || 'Flooded area';
      const created = await mutations.createReport({
        name: roadName,
        district: detectedRoad.district ?? 'Unknown area',
        latitude: loc.lat,
        longitude: loc.lng,
        severity: sev,
        depthCm: preset.depthCm,
        trend: preset.trend,
        road: preset.road,
        captchaToken,
      });
      await reports.refetch(true);
      showToast(t('quick.reported'), t('quick.undo'), () => void undoQuickReport(created.id));
      // quickPost's toast slot is already spent on Undo — queue the guest nudge to appear right
      // after that toast auto-dismisses (4800ms) instead of showing two toasts at once. Once per
      // session only: quick mode posts on every severity tap, and nudging each time would nag.
      if (session.role === 'GUEST' && !guestNudgeShown.current) {
        guestNudgeShown.current = true;
        window.clearTimeout(guestNudgeTimer.current);
        guestNudgeTimer.current = window.setTimeout(() => {
          showToast(t('guest.quickNudge'), t('topbar.signIn'), () =>
            setLogin({ open: true, reason: t('guest.defaultReason') })
          );
        }, 5000);
      }
    } catch (err) {
      if (handleAuthError(err, 'Your session expired. Please sign in again to post a report.')) return;
      if (err instanceof ApiError && (err.status === 409 || err.status === 429)) {
        showToast(err.message);
        return;
      }
      showToast('Could not post your report. Please try again.');
    } finally {
      setBusyPick(false);
    }
  };

  // Undo for a quick-mode post (voice misrecognition or a mis-tap) — deletes the just-created
  // report the same way an owner would from the detail card, but without disturbing `removing`/
  // `selectedReportId` state (quick mode never selects a report).
  const undoQuickReport = async (id: number): Promise<void> => {
    try {
      await mutations.deleteReport(id);
      await reports.refetch(true);
      showToast(t('quick.undone'));
    } catch {
      showToast('Could not undo — you can remove it from your reports list.');
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

  // Share data for one specific report (the "post to social media" flow after an admin logs an
  // incident). Built from the report itself so it works with a freshly-created, not-yet-enriched one.
  const reportShareData = React.useMemo(() => {
    if (!shareReportTarget) return null;
    const url = buildReportUrl(window.location.origin, shareReportTarget.id);
    // Facebook/X scrape the backend share endpoint so their preview card shows THIS report's details
    // (the static site only serves generic OG to crawlers). Its og:url returns clickers to `url`.
    const ogUrl = buildReportOgUrl(API_BASE, shareReportTarget.id);
    const st = buildReportShareText(shareReportTarget, active.length, url);
    return { ...st, url, links: buildShareLinks({ url, body: st.body, text: st.text, ogUrl }) };
  }, [shareReportTarget, active.length]);

  // The admin Flood Digest's contents — every currently-active report, rebuilt whenever `active`
  // changes (which itself re-derives off the 15s `now` tick, so the digest stays fresh while open).
  const floodDigest = React.useMemo(
    () => buildFloodDigest(active, new Date(), window.location.origin),
    [active]
  );

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

  // Share a single report to Facebook. Hybrid: on mobile with a photo, use the Web Share API to
  // push the actual image file to the native sheet (the user picks Facebook there — Facebook's own
  // sharer can't accept an uploaded photo). Everywhere else, open Facebook's web sharer pointed at
  // the backend share endpoint, whose per-report OG tags give Facebook the report's own preview card
  // (and whose og:url returns clickers to the deep-link).
  const shareReport = async (report: FloodReport): Promise<void> => {
    const url = buildReportUrl(window.location.origin, report.id);
    const ogUrl = buildReportOgUrl(API_BASE, report.id);
    const { title, text } = buildReportShareText(report, active.length, url);
    try {
      if (report.photoUrl && typeof navigator.canShare === 'function') {
        const resp = await fetch(`${API_BASE}${report.photoUrl}`);
        if (resp.ok) {
          const blob = await resp.blob();
          const file = new File([blob], 'flood.jpg', { type: blob.type || 'image/jpeg' });
          if (navigator.canShare({ files: [file] })) {
            await navigator.share({ files: [file], title, text });
            return;
          }
        }
      }
    } catch (err) {
      // User dismissed the native sheet → done. Otherwise fall through to the web sharer.
      if (err instanceof DOMException && err.name === 'AbortError') return;
    }
    window.open(
      `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(ogUrl)}`,
      '_blank',
      'noopener,noreferrer'
    );
  };

  // Post the admin Flood Digest to Facebook. Facebook's sharer.php dropped the `quote` param in
  // 2017, so a client-side share can carry a URL only — the digest text can't be injected into the
  // composer. Copy it instead and toast the admin to paste it once the composer opens. Shares the
  // site origin (not a report deep-link — the digest has no single subject report; index.html
  // already serves site-wide OG tags for the card).
  const postDigestFacebook = async (text: string): Promise<void> => {
    try {
      await navigator.clipboard?.writeText(text);
    } catch { /* fall through — the composer still opens, admin can type it manually */ }
    window.open(
      `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(window.location.origin)}`,
      '_blank',
      'noopener,noreferrer'
    );
    showToast('Digest copied — paste it into the Facebook composer.');
  };

  // Post the digest to X. Unlike Facebook, intent/tweet accepts prefilled text, so this is one click.
  const postDigestX = (body: string): void => {
    window.open(
      `https://twitter.com/intent/tweet?text=${encodeURIComponent(body)}&url=${encodeURIComponent(window.location.origin)}`,
      '_blank',
      'noopener,noreferrer'
    );
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

  const onCreateZone = (b: NewFloodProneArea) => adminAction(() => mutations.createFloodProneArea(b), () => floodProne.refetch(true), 'Zone added.');
  const onUpdateZone = (id: number, b: Partial<NewFloodProneArea>) => adminAction(() => mutations.updateFloodProneArea(id, b), () => floodProne.refetch(true), 'Zone updated.');
  const onDeleteZone = (id: number) => adminAction(() => mutations.deleteFloodProneArea(id), () => floodProne.refetch(true), 'Zone removed.');

  // Manual warning trigger — the deliberate second action the feature is built around. Deliberately
  // NOT run through adminAction: it must throw on failure so AdminWarnZoneModal keeps its form open
  // and shows an error (same reasoning as onReportIncident), and it refetches BOTH alerts (the new
  // warning) and flood-prone areas (the zone's updated lastWarnedAt).
  const warnZone = async (id: number, b: WarnArea): Promise<void> => {
    await mutations.warnFloodProneArea(id, b);
    await alerts.refetch(true);
    await floodProne.refetch(true);
    showToast('Warning broadcast.');
  };

  // AdminScopedWarnModal: broadcast the same warning across every zone in the admin's picked
  // region. ONE request to /flood-prone/warn-bulk, which writes every alert in a single
  // transaction and emits a single `alert-created` SSE event. Looping the per-zone endpoint
  // instead would fan out one broadcast per zone — a Luzon-wide warn is 271 zones, and every
  // connected client refetches on every broadcast.
  //
  // The server skips ids it no longer has and returns them in `missingAreaIds` rather than failing
  // the batch, so a zone deleted while this modal was open costs that one warning, not all 271.
  const warnZonesInScope = async (picked: FloodProneArea[], b: WarnArea): Promise<{ ok: number; failed: string[] }> => {
    const res = await mutations.warnFloodProneAreasBulk({ ...b, areaIds: picked.map((z) => z.id) });
    await alerts.refetch(true);
    await floodProne.refetch(true);
    const missing = new Set(res.missingAreaIds);
    const failed = picked.filter((z) => missing.has(z.id)).map((z) => z.name);
    showToast(`Warned ${res.affected} of ${picked.length} area${picked.length === 1 ? '' : 's'}.`);
    return { ok: res.affected, failed };
  };

  // AdminScopedWarnModal's "Clear warnings in scope" — the undo for the bulk warn. The server
  // deactivates every active alert stamped from one of these zones in one transaction; a global
  // (non-geo) alert has no areaId and so can never be caught in the sweep, the same fail-safe as
  // alertsForUser's proximity gate.
  const clearWarningsInScope = async (picked: FloodProneArea[]): Promise<{ ok: number; failed: string[] }> => {
    const res = await mutations.clearFloodProneWarnings(picked.map((z) => z.id));
    await alerts.refetch(true);
    showToast(`Cleared ${res.affected} warning${res.affected === 1 ? '' : 's'}.`);
    return { ok: res.affected, failed: [] };
  };

  // Global (server-backed) community-chat visibility toggle, unlike the per-browser `liveStream` pref.
  const onToggleChat = async (on: boolean): Promise<void> => {
    try {
      await mutations.updateSettings({ chatEnabled: on });
      await settings.refetch(true);
    } catch {
      showToast('Could not update the chat setting. Please try again.');
    }
  };

  // Global (server-backed) auto-post kill switches — one per network, same pattern as onToggleChat.
  const onToggleSocialAutopost = async (network: 'facebook' | 'x', on: boolean): Promise<void> => {
    try {
      await mutations.updateSettings(network === 'facebook' ? { socialAutopostFacebook: on } : { socialAutopostX: on });
      await settings.refetch(true);
    } catch {
      showToast('Could not update the auto-post setting. Please try again.');
    }
  };

  // Global (server-backed) "rain is falling now" flag — flips the predictive water-level model
  // from receding to rising for every report. Same pattern as onToggleChat.
  const onToggleRain = async (on: boolean): Promise<void> => {
    try {
      await mutations.updateSettings({ rainActive: on });
      await settings.refetch(true);
    } catch {
      showToast('Could not update the rain setting. Please try again.');
    }
  };

  // Admin: retry one failed/pending social-post row from the AdminPanel list.
  const onRetrySocialPost = async (id: number): Promise<void> => {
    try {
      await mutations.retrySocialPost(id);
      await socialPosts.refetch(true);
      showToast('Retry queued.');
    } catch {
      showToast('Could not retry that post. Please try again.');
    }
  };

  // Reports an admin creates are authoritative "system" reports (news/other sources).
  const onCreateReport = (b: NewReport) => adminAction(() => mutations.createReport({ ...b, system: true }), () => reports.refetch(true), 'Report added.');

  // "Report incident" modal: post a system report, then offer to share it to social media. Throws
  // on failure (no adminAction wrapper) so the modal keeps its form open and shows an error.
  // `zone` is the optional "Also mark this place as flood-prone" checkbox from the modal — it is
  // strictly secondary to the report, so its failure must NOT fail the report or reopen the
  // modal: the admin already has their incident posted, and can always add the zone by hand from
  // Admin → Zones. Hence it's wrapped in its own try/catch rather than left to propagate.
  const onReportIncident = async (b: NewReport, zone?: NewFloodProneArea): Promise<void> => {
    const created = await mutations.createReport({ ...b, system: true });
    await reports.refetch(true);
    let zoneNote = '';
    if (zone) {
      // Belt-and-braces re-check against the freshest zone list, behind the modal's own
      // proneMatch guard: the modal's `zones` snapshot can be stale if another admin added the
      // same zone while this modal was open, so skip the POST rather than trust the client alone.
      const dup = matchingProneZone(floodProneList, { lat: zone.latitude, lng: zone.longitude });
      if (dup) {
        zoneNote = ` Already a flood-prone zone (${dup.name}).`;
      } else {
        try {
          await mutations.createFloodProneArea(zone);
          await floodProne.refetch(true);
          zoneNote = ' Flood-prone zone added.';
        } catch {
          zoneNote = ' (Could not add the flood-prone zone — add it from Admin → Zones.)';
        }
      }
    }
    // When the admin ticked at least one network, the server auto-posts it — reopening the
    // per-report ShareModal would ask them to do by hand what already just happened.
    if (b.socialNetworks && b.socialNetworks.length > 0) {
      showToast(`Report posted · publishing to ${b.socialNetworks.map((n) => (n === 'facebook' ? 'Facebook' : 'X')).join(' + ')}${zoneNote}`);
    } else {
      showToast(`System report posted.${zoneNote}`);
      setShareReportTarget(created);
    }
  };
  const onUpdateReport = (id: number, b: Partial<NewReport & { status: ReportStatus }>) => adminAction(() => mutations.updateReport(id, b), () => reports.refetch(true), 'Report updated.');
  const onDeleteReport = (id: number) => adminAction(() => mutations.deleteReport(id), () => reports.refetch(true), 'Report removed.');

  // ZoneReportModal: turn one or more flood-prone zones into live system reports. Posted
  // sequentially (not Promise.all) so partial results stay ordered and the API isn't hammered —
  // same reasoning as everywhere else a batch of admin writes goes out one at a time. No
  // adminAction wrapper: ZoneReportModal shows its own per-zone outcome (ok count / failed names)
  // and decides for itself whether to close or stay open, so this returns that tally instead of
  // throwing.
  const reportZones = async (picked: FloodProneArea[], opts: ZoneReportOptions): Promise<{ ok: number; failed: string[] }> => {
    const preset = SEVERITY_PRESET[opts.severity];
    let ok = 0;
    const failed: string[] = [];
    for (const z of picked) {
      const payload: NewReport = {
        name: z.name,
        district: z.district,
        latitude: z.latitude,
        longitude: z.longitude,
        severity: opts.severity,
        depthCm: opts.depthCm,
        trend: preset.trend,
        road: preset.road,
        system: true,
        reportedAt: new Date().toISOString(),
        ttlMinutes: opts.ttlMinutes,
      };
      try {
        await mutations.createReport(payload);
        ok++;
      } catch {
        failed.push(z.name);
      }
    }
    await reports.refetch(true);
    // A hint toward the consolidated digest only when it's actually worth consolidating — one
    // report doesn't need a roundup post.
    const hint = ok > 1 ? ' Consider the flood digest to share them as one post.' : '';
    showToast(`Posted ${ok} of ${picked.length} zone report${picked.length === 1 ? '' : 's'}.${hint}`);
    return { ok, failed };
  };

  // Admin: accept/decline a bug report or feature request; accepted items become public on the board.
  const updateFeedbackStatus = (id: number, status: FeedbackStatus) =>
    adminAction(
      () => mutations.updateFeedbackStatus(id, status),
      () => Promise.all([allFeedback.refetch(true), acceptedFeedback.refetch(true)]),
      'Request updated.'
    );

  // Anyone — including a no-login guest — files a bug report or feature request. It enters as
  // `pending` and only appears on the public board once an admin accepts it. Mirrors report posting:
  // silently provision a guest session, and require the CAPTCHA from guests when Turnstile is on.
  const submitFeedback = async (body: NewFeedback): Promise<void> => {
    setFeedbackSending(true);
    try {
      const session = await ensureGuest();
      if (!session) {
        showToast('Could not send feedback. Please try again.');
        return;
      }
      if (session.role === 'GUEST' && captchaEnabled() && !body.captchaToken) {
        showToast('Please complete the security check, then submit again.');
        return;
      }
      await mutations.createFeedback(body);
      setFeedbackOpen(false);
      showToast('Thanks — your feedback was sent for review.');
      if (isAdmin) void allFeedback.refetch(true);
    } catch (e) {
      if (handleAuthError(e, 'Your session expired. Please sign in again to send feedback.')) return;
      showToast(e instanceof ApiError ? e.message : 'Could not send feedback. Please try again.');
    } finally {
      setFeedbackSending(false);
    }
  };

  // Anyone can upvote an accepted item; provision a guest session first so the vote is attributable
  // (one per device/account). The backend toggles the vote, then we refresh the board in the
  // background (the list re-sorts by upvotes).
  const toggleUpvote = async (id: number): Promise<void> => {
    try {
      const session = await ensureGuest();
      if (!session) {
        showToast('Could not record your vote. Please try again.');
        return;
      }
      await mutations.upvoteFeedback(id);
      await acceptedFeedback.refetch(true);
    } catch (e) {
      if (handleAuthError(e, 'Your session expired. Please sign in again to vote.')) return;
      showToast(e instanceof ApiError ? e.message : 'Could not record your vote. Please try again.');
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

  // ── Trip monitoring ──────────────────────────────────────────────────────────────
  const startTrip = async (): Promise<void> => {
    if (!trip.stops.length) { setAddStopOpen(true); return; }
    if (typeof Notification !== 'undefined' && Notification.permission === 'default') {
      try { setNotifyPerm(await Notification.requestPermission()); } catch {/* ignore */}
    }
    setTrip((p) => ({ ...p, id: newTripId(), active: true, startedAt: Date.now() }));
    showToast(tFormat(lang, 'trip.started', { n: trip.stops.length }));
  };

  const endTrip = (): void => {
    setTrip((p) => ({ ...p, active: false })); // stops persist so the trip can resume
    setTripSheetOpen(false);
    showToast(t('trip.ended'), t('trip.clearStops'), () => setTrip({ ...EMPTY_TRIP, id: newTripId() }));
  };

  const focusStop = (stop: TripStop): void => {
    setSelectedStopId(stop.id);
    setSelectedReportId(null);
    setSelEvacId(null);
    setMapFocus({ lat: stop.lat, lng: stop.lng, key: Date.now() });
  };

  const addStop = async (pick: { lat: number; lng: number; label: string; radiusKm: number }): Promise<void> => {
    if (trip.stops.length >= MAX_STOPS) { showToast(tFormat(lang, 'trip.maxReached', { n: MAX_STOPS })); return; }
    const dupe = trip.stops.some((s) => kmBetween(s, pick) * 1000 <= DUPLICATE_STOP_KM * 1000);
    if (dupe) { showToast(t('trip.duplicate')); return; }

    const id = newStopId();
    const seededRoadName = pick.label.split(',')[0]?.trim() || null;
    const newStop: TripStop = { id, label: pick.label, lat: pick.lat, lng: pick.lng, radiusKm: pick.radiusKm, roadName: seededRoadName, city: null };
    setTrip((p) => ({ ...p, stops: [...p.stops, newStop] }));
    setAddStopOpen(false);

    const alreadyMatching = matchTripStops(active, [newStop]);
    if (alreadyMatching.length) showToast(tFormat(lang, 'trip.addedFlooded', { n: alreadyMatching.length }));

    // Resolve the canonical road name/city in the background: the snapped OSM name is preferred
    // (same source reports snap to, so both sides of a road-name comparison spell it identically)
    // — reverse geocoding fills in whatever it didn't provide (city always; road as a fallback).
    // Patches the stop in place by id, a no-op if it was removed before this lands.
    setAddStopBusy(true);
    try {
      const snapped = snapToRoad(pick.lat, pick.lng);
      const rev = await reverseGeocode(pick.lat, pick.lng);
      setTrip((p) => ({
        ...p,
        stops: p.stops.map((s) => (s.id === id ? { ...s, roadName: snapped?.name ?? rev.road ?? s.roadName, city: rev.city } : s)),
      }));
    } catch {
      // Keep the label-seeded roadName / null city — radius-only matching for this stop.
    } finally {
      setAddStopBusy(false);
    }
  };

  const removeStop = (id: string): void => setTrip((p) => ({ ...p, stops: p.stops.filter((s) => s.id !== id) }));

  const moveStop = (id: string, dir: -1 | 1): void => {
    setTrip((p) => {
      const i = p.stops.findIndex((s) => s.id === id);
      const j = i + dir;
      if (i < 0 || j < 0 || j >= p.stops.length) return p;
      const next = [...p.stops];
      [next[i], next[j]] = [next[j], next[i]];
      return { ...p, stops: next };
    });
  };

  const setStopRadius = (id: string, km: number): void =>
    setTrip((p) => ({ ...p, stops: p.stops.map((s) => (s.id === id ? { ...s, radiusKm: km } : s)) }));

  const viewTripReport = (reportId: number): void => {
    setTab('nearby');
    setSelEvacId(null);
    setSelectedStopId(null);
    setSelectedReportId(reportId);
    const r = enriched.find((x) => x.id === reportId);
    if (r) setMapFocus({ lat: r.latitude, lng: r.longitude, key: Date.now() });
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
        // Every failure here is usually fixable — a blocked permission OR the device's Location
        // Services being off (timeout / position-unavailable). Offer step-by-step help either way;
        // the modal's steps cover both. (Distinct messages keep "denied" clearer than a timeout.)
        const msg = denied ? 'loc.denied' : 'loc.failed';
        showToast(tFormat(lang, msg, {}), tFormat(lang, 'loc.enableHelp', {}), () => setLocHelpOpen(true));
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
        onChooseReport={(target) => (target === 'report' ? startReport() : startQuickReport())}
        reportPref={reportPref}
        onShare={() => setShareOpen(true)}
        onSOS={() => setSosOpen(true)}
        onSignIn={() => setLogin({ open: true, reason: t('guest.defaultReason') })}
        onSignOut={logout}
        onSearchSelect={onSearchSelect}
        searchNear={userLoc}
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
        onShowFeatures={() => setFeaturesOpen(true)}
        onShowFeedback={() => { setFeedbackBoardOpen(true); void acceptedFeedback.refetch(true); }}
        isAdmin={!!isAdmin}
        onAdmin={() => { setAdminOpen(true); void allFeedback.refetch(true); void socialPosts.refetch(true); }}
        onResponse={() => {
          // /rescue reads need auth; prompt sign-in before opening, then warm the data.
          if (!requireFullAuth('Sign in to open the response console.')) return;
          setResponseOpen(true);
          void rescues.refetch(true);
        }}
        onReportIncident={() => setIncidentOpen(true)}
        onFloodDigest={() => setDigestOpen(true)}
      />

      {activeAlert && (
        <AlertRibbon alert={activeAlert} onClose={() => setDismissedAlerts((s) => new Set(s).add(activeAlert.id))} />
      )}

      {/* Admin-flipped global flag — every projected water level on the map is currently climbing
          instead of receding. Not dismissible: it should stay visible for as long as it's true. */}
      {rainActive && (
        <div style={{ flex: 'none', display: 'flex', alignItems: 'center', gap: 9, padding: '8px 16px', background: '#EFF6FF', borderBottom: '1px solid #BFDBFE', fontSize: 12, fontWeight: 700, color: '#1D4ED8', zIndex: 34 }}>
          <span>🌧</span>
          <span>Rain is falling — water levels are projected to keep rising instead of receding. Predictive, not measured.</span>
        </div>
      )}

      <ActivityTicker
        report={feed[0] ?? null}
        warning={monitorAreaWarnings[0] ?? null}
        warningCount={monitorAreaWarnings.length}
        monitorRadiusKm={monitorRadiusKm}
        isLive={lastEventAt != null && now - lastEventAt < 90_000}
        isMobile={isMobile}
        onWarningClick={() => {
          const a = monitorAreaWarnings[0];
          if (!a) return;
          // Same modal the alarm path opens, so a warning reached from the ticker reads identically
          // to one that interrupted you. `source` mirrors the alert effect's zone-vs-weather split.
          setAlertModal({ alert: a, source: a.areaId != null ? 'zone' : 'weather' });
          if (a.latitude != null && a.longitude != null) {
            setMapFocus({ lat: Number(a.latitude), lng: Number(a.longitude), key: Date.now() });
          }
        }}
        onClick={() => {
          const r = feed[0];
          if (!r) return;
          // 'activity' (not 'nearby'): the ticker shows the newest report, which is row 1 of the
          // createdAt-sorted activity tab but could be far down the distance-sorted nearby tab.
          setTab('activity');
          setSelEvacId(null);
          setSelectedReportId(r.id);
          setMapFocus({ lat: r.latitude, lng: r.longitude, key: Date.now() });
        }}
      />

      {alertModal && <AlertModal alert={alertModal.alert} action={alertModal.action} source={alertModal.source} onClose={() => setAlertModal(null)} />}

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
            tripStops={trip.active ? trip.stops : undefined}
            affectedStopIds={tripAlertStopIds}
            selectedStopId={selectedStopId}
            onSelectStop={(id) => { setSelectedStopId(id); setSelectedReportId(null); setSelEvacId(null); }}
            floodProneAreas={floodProneList}
            showFloodProne={showFloodProne}
            // Passed only for admins (rather than a no-op guard inside the handler): FloodMap
            // treats the presence of this callback as "zones are actionable", which is what makes
            // the whole dashed circle tappable and keeps the citizen circle inert — for them the
            // bubble is already the information.
            onSelectZone={isAdmin ? (id) => {
              // ZoneReportModal below is fed active zones only, so preselecting an inactive one
              // would open an all-unticked modal that can't submit.
              if (!floodProneList.some((z) => z.id === id && z.active)) return;
              setZoneReportPreselect(id);
              setZoneReportOpen(true);
            } : undefined}
          />

          {!isMobile && <RoadLegend />}

          {/* Floating "show my location" control — recenters the map on a fresh GPS fix. */}
          <LocateButton onClick={locateMe} locating={locating} />

          {/* Report-mode hint */}
          {mode === 'report' && (() => {
            const atYou = !!pending?.atYou;
            const m = userAccuracyM != null ? Math.round(userAccuracyM) : 0;
            // Settled with no fix → location couldn't be determined: guide the user to settings.
            const noFix = atYou && !reportLocating && userAccuracyM == null;
            // A fix landed but it's too coarse to trust the auto-pin → nudge manual placement.
            const weak = atYou && userAccuracyM != null && userAccuracyM > WEAK_FIX_M;
            const hint = !atYou
              ? t('report.hintTap')
              : reportLocating && userAccuracyM == null
                ? t('report.hintLocating')
                : noFix
                  ? t('report.hintNoFix')
                  : weak
                    ? tFormat(lang, 'report.hintWeak', { m })
                    : tFormat(lang, 'report.hintAtYouAcc', { m });
            // Amber dot flags a location problem the user can act on; blue = all good.
            const attention = noFix || weak;
            return (
            <div style={{ position: 'absolute', top: 58, left: '50%', transform: 'translateX(-50%)', zIndex: 500, display: 'flex', alignItems: 'center', gap: 9, maxWidth: '94%', padding: '10px 13px', background: '#0F172A', color: '#fff', borderRadius: 13, boxShadow: '0 8px 24px rgba(15,23,42,.35)', fontSize: 12.5, fontWeight: 700 }}>
              <span style={{ width: 8, height: 8, borderRadius: '50%', flex: 'none', background: attention ? '#F59E0B' : '#0EA5E9', boxShadow: attention ? '0 0 0 4px rgba(245,158,11,.3)' : '0 0 0 4px rgba(14,165,233,.3)' }} />
              <span style={{ lineHeight: 1.3 }}>{hint}</span>
              {noFix && (
                <button onClick={() => setLocHelpOpen(true)} style={{ border: 0, background: 'rgba(255,255,255,.92)', color: '#0F172A', padding: '6px 12px', borderRadius: 8, fontSize: 12, fontWeight: 800, cursor: 'pointer', flex: 'none' }}>{t('report.enableLoc')}</button>
              )}
              <button onClick={cancelReport} style={{ border: 0, background: 'rgba(255,255,255,.14)', color: '#fff', padding: '6px 12px', borderRadius: 8, fontSize: 12, fontWeight: 700, cursor: 'pointer', flex: 'none' }}>Cancel</button>
            </div>
            );
          })()}

          {/* Gated on idle: a marker tap mid-report must never stack a detail card under/over the
              report-mode sheet (both are fixed/bottom:0/zIndex:1110 on mobile) — see beginReport
              and the dup-report toast's View action, which both clear the selection/cancel the form. */}
          {mode === 'idle' && selectedReport && (
            <ReportDetailCard
              report={selectedReport}
              isMobile={isMobile}
              // No auth gate here on purpose: confirmReport() already mints a guest session on
              // click (see ensureGuest() below), so a first-time visitor must see this button
              // before they've done anything else. Do not "restore" a !!auth check.
              canConfirm={!selectedReport.mine}
              confirming={confirming}
              onConfirm={() => void confirmReport(selectedReport.id)}
              canRemove={selectedReport.mine}
              removing={removing}
              onRemove={() => void removeReport(selectedReport.id)}
              photoSrc={selectedReport.photoUrl ? `${API_BASE}${selectedReport.photoUrl}` : null}
              onShareReport={() => setShareReportTarget(selectedReport)}
              projectedRiseCm={projectedRiseCm}
              onClose={() => setSelectedReportId(null)}
              isAdmin={!!isAdmin}
              rainActive={rainActive}
              now={now}
              onAdminUpdate={onUpdateReport}
            />
          )}

          {mode === 'idle' && selEvac && (
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
              onPick={(s, d, id, road, token, photo) => void pickSeverity(s, d, id, road, token, photo)}
              onCancel={cancelReport}
            />
          )}

          {mode === 'quick' && pending && (
            <QuickReportSheet
              isMobile={isMobile}
              busy={busyPick}
              detectedRoad={detectedRoad.road}
              accuracyM={userAccuracyM}
              captchaRequired={captchaEnabled() && auth?.role === 'GUEST'}
              onQuick={(sev, token) => void quickPost(sev, token)}
              onDone={cancelReport}
            />
          )}
        </div>

        <Sidebar
          isMobile={isMobile}
          status={status}
          list={tab === 'nearby' ? nearby : tab === 'archive' ? archived : feed}
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
          showFloodProne={showFloodProne}
          onToggleFloodProne={() => setShowFloodProne((v) => !v)}
          zoneCount={floodProneList.length}
          impassableRoadCount={impassableRoads.length}
          highCount={highCount}
          totalCount={totalCount}
          selectedReportId={selectedReportId}
          onSelectReport={(id) => { setSelectedReportId(id); setSelEvacId(null); }}
          visitCount={visitCount}
          auth={auth}
          guestNudgeDismissed={guestNudgeDismissed}
          onDismissGuestNudge={dismissGuestNudge}
          onSignIn={(reason) => setLogin({ open: true, reason: reason ?? t('guest.defaultReason') })}
          tripActive={trip.active}
          tripAlertCount={tripAlertStopIds.length}
          tripSlot={
            <TripPanel
              trip={trip}
              matches={tripStopStatus}
              stopZones={tripStopZones}
              notifyPermission={notifyPerm}
              onAddStop={() => setAddStopOpen(true)}
              onRemoveStop={removeStop}
              onMoveStop={moveStop}
              onChangeRadius={setStopRadius}
              onFocusStop={focusStop}
              onViewReport={viewTripReport}
              onStartTrip={() => void startTrip()}
              onEndTrip={endTrip}
            />
          }
        />
      </div>

      {/* Mobile FAB — bottom-center. Tapping fans out the two ReportOptions directly above it,
          centered, with a tap-anywhere scrim that only dismisses the fan-out (never starts a
          report). It's a root-level sibling of the map area, which is its own `isolation: isolate`
          stacking context (mapAreaStyle) — so the FAB paints ABOVE that entire context, including
          the detail sheet inside it at zIndex 1110, no matter what z-index the FAB itself carries.
          A z-index bump can't fix that (it's a sibling-context problem, not an ordering problem),
          so on mobile the FAB/trip-chip must be gated off whenever a detail card is open rather
          than merely stacked below it — see the `!selectedReport && !selEvac` guard below.
          z-index: the fan-out card sits at the same bottom:84 band as ChatWidget's mobile bubble
          (right:16, bottom:84, zIndex:1100), and on narrow viewports the two can overlap
          horizontally. While open, the scrim/FAB/card are lifted to 1140–1150 (above the bubble's
          1100) so the card is never painted over and a tap on the bubble's area dismisses the
          fan-out via the scrim instead of opening chat — do not drop these back into the
          low-40s bracket used for the FAB's resting (closed) state. */}
      {isMobile && mode === 'idle' && !selectedReport && !selEvac && (
        <>
          {/* Admins post system reports via the incident modal, so the Detailed/Quick fan-out
              (citizen-only) never opens for them — skip rendering the scrim/card entirely. */}
          {!isAdmin && fanOpen && (
            <div
              onClick={() => setFanOpen(false)}
              aria-hidden="true"
              style={{ position: 'fixed', inset: 0, zIndex: 1140 }}
            />
          )}
          {!isAdmin && fanOpen && (
            <div style={{ position: 'fixed', left: '50%', bottom: 84, transform: 'translateX(-50%)', zIndex: 1150, animation: 'popIn .14s ease-out' }}>
              <ReportOptions
                preferred={reportPref}
                onChoose={(target) => {
                  setFanOpen(false);
                  if (target === 'report') startReport(); else startQuickReport();
                }}
              />
            </div>
          )}
          <button
            onClick={() => (isAdmin ? setIncidentOpen(true) : setFanOpen((o) => !o))}
            aria-expanded={isAdmin ? undefined : fanOpen}
            aria-label={isAdmin ? t('topbar.report') : t('report.chooseHow')}
            style={{ position: 'fixed', left: '50%', bottom: 20, transform: 'translateX(-50%)', zIndex: fanOpen ? 1145 : 45, display: 'flex', alignItems: 'center', gap: 8, height: 52, padding: '0 22px', border: 0, background: 'var(--bw-primary)', color: '#fff', borderRadius: 26, fontSize: 15, fontWeight: 800, boxShadow: '0 8px 22px rgba(14,165,233,.45)', cursor: 'pointer' }}
          >
            <span style={{ fontSize: 20, fontWeight: 700, display: 'inline-block', transition: 'transform .15s', transform: !isAdmin && fanOpen ? 'rotate(45deg)' : 'none' }}>+</span> {t('topbar.report')}
          </button>
        </>
      )}

      {/* Mobile floating trip chip — the sidebar's "MY TRIP" section is below a 52vh map and not
          glanceable mid-drive. Gated on mode === 'idle', same as the report FAB, so the two can
          never coexist; sits left of the FAB (which is centered) so neither overlaps the other.
          Also gated on !selectedReport/!selEvac, same reason as the FAB above: it sits in the same
          bottom band the full-width mobile detail sheet covers. */}
      {isMobile && mode === 'idle' && !selectedReport && !selEvac && trip.active && (
        <button
          onClick={() => setTripSheetOpen(true)}
          style={{ position: 'fixed', left: 12, bottom: 20, zIndex: 44, display: 'flex', alignItems: 'center', gap: 7, height: 44, padding: '0 15px', border: 0, borderRadius: 22, background: tripAlertStopIds.length > 0 ? '#F59E0B' : '#7C3AED', color: '#fff', fontSize: 12.5, fontWeight: 800, boxShadow: '0 8px 20px rgba(15,23,42,.3)', cursor: 'pointer' }}
        >
          🚗 {trip.stops.length}
          {tripAlertStopIds.length > 0 && <span>· ⚠ {tripAlertStopIds.length}</span>}
        </button>
      )}

      {isMobile && tripSheetOpen && (
        <>
          <div onClick={() => setTripSheetOpen(false)} aria-hidden="true" style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,.45)', zIndex: 1100 }} />
          <div style={{ position: 'fixed', left: 0, right: 0, bottom: 0, zIndex: 1110, maxHeight: '82vh', overflowY: 'auto', background: '#fff', borderRadius: '18px 18px 0 0', boxShadow: '0 -8px 30px rgba(15,23,42,.3)', animation: 'sheetUp .22s ease-out', padding: '6px 0 10px' }}>
            <div style={{ display: 'flex', justifyContent: 'flex-end', padding: '8px 14px 0' }}>
              <button onClick={() => setTripSheetOpen(false)} style={{ border: 0, background: 'var(--bw-bg-subtle)', color: '#7C8B98', width: 28, height: 28, borderRadius: 8, fontSize: 16, cursor: 'pointer' }}>×</button>
            </div>
            {/* TripPanel renders its body only — the sidebar's control strip supplies the heading
                and padding there, so this sheet supplies its own. */}
            <div style={{ padding: '0 18px 12px' }}>
              <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: '.1em', color: 'var(--bw-faint)', marginBottom: 10 }}>{t('trip.title')}</div>
              <TripPanel
                trip={trip}
                matches={tripStopStatus}
                stopZones={tripStopZones}
                notifyPermission={notifyPerm}
                onAddStop={() => setAddStopOpen(true)}
                onRemoveStop={removeStop}
                onMoveStop={moveStop}
                onChangeRadius={setStopRadius}
                onFocusStop={(s) => { focusStop(s); setTripSheetOpen(false); }}
                onViewReport={(id) => { viewTripReport(id); setTripSheetOpen(false); }}
                onStartTrip={() => void startTrip()}
                onEndTrip={endTrip}
              />
            </div>
          </div>
        </>
      )}

      {addStopOpen && (
        <AddStopSheet
          isMobile={isMobile}
          near={userLoc}
          defaultRadiusKm={STOP_RADIUS_DEFAULT}
          busy={addStopBusy}
          onAdd={(pick) => void addStop(pick)}
          onClose={() => setAddStopOpen(false)}
        />
      )}

      {sosOpen && (
        <SosModal hotlines={hotlineList} sending={sending} onSendRescue={() => void sendRescue()} onClose={() => setSosOpen(false)} />
      )}

      {locHelpOpen && (
        <LocationHelpModal
          onRetry={() => {
            setLocHelpOpen(false);
            // In report/quick mode, re-pin onto the user (the freshly granted fix re-applies);
            // otherwise just recenter via the floating-locate flow.
            if (mode === 'report' || mode === 'quick') locateForReport(true);
            else locateMe();
          }}
          onClose={() => setLocHelpOpen(false)}
        />
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
        <WaterLevelModal
          userLoc={userLoc}
          isMobile={isMobile}
          onClose={() => setWaterChartOpen(false)}
          activeReports={active}
          rainActive={rainActive}
          now={now}
        />
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
          fbPageUrl={FB_PAGE_URL}
          activeCount={active.length}
          isMobile={isMobile}
          canNativeShare={canNativeShare}
          onNativeShare={() => void nativeShare()}
          onCopy={(t, msg) => void copyShare(t, msg)}
          onClose={() => setShareOpen(false)}
        />
      )}

      {/* Share a specific report to social media — opened from a report's Share button or after an
          admin logs an incident. The links carry the report's deep-link (?report=<id>). */}
      {shareReportTarget && reportShareData && (
        <ShareModal
          text={reportShareData.text}
          url={reportShareData.url}
          links={reportShareData.links}
          fbPageUrl={FB_PAGE_URL}
          activeCount={active.length}
          isMobile={isMobile}
          canNativeShare={canNativeShare}
          onNativeShare={() => void shareReport(shareReportTarget)}
          onCopy={(t, msg) => void copyShare(t, msg)}
          onClose={() => setShareReportTarget(null)}
        />
      )}

      {incidentOpen && isAdmin && (
        <AdminReportIncidentModal
          isMobile={isMobile}
          zones={floodProneList}
          onSubmit={onReportIncident}
          initialCenter={userLoc ?? DEFAULT_LOCATION}
          onClose={() => setIncidentOpen(false)}
        />
      )}
      {digestOpen && isAdmin && (
        <FloodDigestModal
          digest={floodDigest}
          isMobile={isMobile}
          onFacebook={(text) => void postDigestFacebook(text)}
          onX={postDigestX}
          onCopyX={(text) => void copyShare(text, 'X post copied — paste it into X.')}
          onCopy={(text) => void copyShare(text, 'Digest copied.')}
          onClose={() => setDigestOpen(false)}
        />
      )}
      {zoneWarnTarget && isAdmin && (
        <AdminWarnZoneModal
          isMobile={isMobile}
          zone={zoneWarnTarget}
          onSubmit={(b) => warnZone(zoneWarnTarget.id, b)}
          onClose={() => setZoneWarnTarget(null)}
        />
      )}
      {scopedWarnOpen && isAdmin && (
        <AdminScopedWarnModal
          isMobile={isMobile}
          zones={floodProneList.filter((z) => z.active)}
          alerts={alertList}
          onWarn={warnZonesInScope}
          onClearWarnings={clearWarningsInScope}
          onClose={() => setScopedWarnOpen(false)}
        />
      )}
      {zoneReportOpen && isAdmin && (
        <ZoneReportModal
          isMobile={isMobile}
          zones={floodProneList.filter((z) => z.active)}
          alreadyReportedIds={alreadyReportedZoneIds}
          preselectId={zoneReportPreselect}
          onSubmit={reportZones}
          onClose={() => { setZoneReportOpen(false); setZoneReportPreselect(null); }}
        />
      )}
      {supportOpen && (
        <SupportModal qrSrc={GCASH_QR_SRC} isMobile={isMobile} onClose={() => setSupportOpen(false)} />
      )}

      {featuresOpen && (
        <FeaturesModal
          isMobile={isMobile}
          onShowFeedback={() => { setFeaturesOpen(false); setFeedbackBoardOpen(true); void acceptedFeedback.refetch(true); }}
          onClose={() => setFeaturesOpen(false)}
        />
      )}

      {feedbackBoardOpen && (
        <CommunityFeedbackModal
          isMobile={isMobile}
          items={acceptedFeedback.data ?? []}
          loading={acceptedFeedback.loading}
          onUpvote={(id) => void toggleUpvote(id)}
          onSuggest={() => setFeedbackOpen(true)}
          onClose={() => setFeedbackBoardOpen(false)}
        />
      )}

      {feedbackOpen && (
        <FeedbackFormModal
          isMobile={isMobile}
          sending={feedbackSending}
          // The form can be opened with no session yet; submit provisions a guest. So show the CAPTCHA
          // to anyone who isn't already a full account (guest or not-signed-in), matching the submit guard.
          captchaRequired={captchaEnabled() && (!auth || auth.role === 'GUEST')}
          onSubmit={submitFeedback}
          onClose={() => setFeedbackOpen(false)}
        />
      )}

      {adminOpen && isAdmin && (
        <AdminPanel
          userLoc={userLoc}
          centers={centerList}
          hotlines={hotlineList}
          alerts={alertList}
          zones={floodProneList}
          reports={reportList}
          liveStream={liveStream}
          onToggleLive={setLiveStream}
          chatEnabled={settings.data?.chatEnabled !== false}
          onToggleChat={(on) => void onToggleChat(on)}
          socialAutopostFacebook={settings.data?.socialAutopostFacebook !== false}
          socialAutopostX={settings.data?.socialAutopostX !== false}
          onToggleSocialAutopost={(network, on) => void onToggleSocialAutopost(network, on)}
          rainActive={rainActive}
          onToggleRain={(on) => void onToggleRain(on)}
          socialPosts={socialPosts.data ?? []}
          onRetrySocialPost={(id) => void onRetrySocialPost(id)}
          onCreateCenter={onCreateCenter}
          onUpdateCenter={onUpdateCenter}
          onDeleteCenter={onDeleteCenter}
          onCreateHotline={onCreateHotline}
          onUpdateHotline={onUpdateHotline}
          onDeleteHotline={onDeleteHotline}
          onCreateAlert={onCreateAlert}
          onUpdateAlert={onUpdateAlert}
          onDeleteAlert={onDeleteAlert}
          onCreateZone={onCreateZone}
          onUpdateZone={onUpdateZone}
          onDeleteZone={onDeleteZone}
          onWarnZone={(zone) => setZoneWarnTarget(zone)}
          onReportZones={(zone) => { setZoneReportPreselect(zone ? zone.id : null); setZoneReportOpen(true); }}
          onScopedWarn={() => setScopedWarnOpen(true)}
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

      {/* Floating community-chat bubble — self-contained, always available over the map.
          Admin-gated via server settings; default-on so a fetch failure never silently hides it. */}
      {settings.data?.chatEnabled !== false && <ChatWidget isMobile={isMobile} />}

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
