// Single source of truth for FloodedArea domain types. Field names mirror the JSON
// the baha-api returns (camelCase).

export type Severity = 'high' | 'medium' | 'low';
export type Trend = 'rising' | 'steady' | 'receding';
export type Road = 'impassable' | 'risky' | 'passable';
export type ReportStatus = 'active' | 'resolved';
export type AlertLevel = 'yellow' | 'orange' | 'red';
export type RescueStatus = 'pending' | 'dispatched' | 'resolved';
export type UserRole = 'CITIZEN' | 'ADMIN' | 'GUEST';
/**
 * How much we trust the report's author: a full account, a no-login guest/device session, or
 * `system` — an authoritative report an admin logged from news/other sources.
 */
export type ReporterTrust = 'verified' | 'guest' | 'system';

export interface FloodReport {
  id: number;
  name: string;
  district: string;
  latitude: number;
  longitude: number;
  severity: Severity;
  depthCm: number;
  trend: Trend;
  road: Road;
  reportsCount: number;
  status: ReportStatus;
  reporterUserId: number | null;
  /** Backend-provided author trust. Absent (older payloads) is treated as 'verified'. */
  reporterTrust?: ReporterTrust;
  /** Relative URL to the report's photo (`/reports/:id/photo`), or null/absent when none was attached. */
  photoUrl?: string | null;
  /** When the flood was actually reported by the source (admin system reports). Anchors the TTL
   *  countdown; absent for citizen reports (they use createdAt/updatedAt). */
  reportedAt?: string | null;
  /** Admin-defined lifetime in minutes (system reports). Null/absent ⇒ the severity default TTL. */
  ttlMinutes?: number | null;
  createdAt: string;
  updatedAt: string;
}

export interface EvacuationCenter {
  id: number;
  name: string;
  latitude: number;
  longitude: number;
  contact: string;
  createdAt: string;
  updatedAt: string;
}

export interface Hotline {
  id: number;
  name: string;
  description: string | null;
  phoneNumber: string;
  position: number;
}

export interface FloodAlert {
  id: number;
  title: string;
  body: string;
  region: string | null;
  level: AlertLevel;
  active: boolean;
  /** Geo-stamp: non-null when this alert was broadcast from a flood-prone area (`/flood-prone/:id/warn`).
   *  Null (the default for every existing/global alert) means it applies everywhere, unchanged. */
  latitude: number | null;
  longitude: number | null;
  radiusM: number | null;
  /** The flood-prone area this warning was stamped from, if any. */
  areaId: number | null;
  createdAt: string;
  updatedAt: string;
}

/**
 * An admin-pinned, persistent "this place floods" advisory: a pin + radius drawn on the map for
 * everyone. Distinct from a FloodAlert (the individual broadcast) and a FloodReport (crowd-sourced,
 * expiring, "water is here now") — a zone stands quietly until an admin explicitly warns it.
 */
export interface FloodProneArea {
  id: number;
  name: string;
  district: string;
  latitude: number;
  longitude: number;
  radiusM: number;
  level: AlertLevel;
  note: string | null;
  active: boolean;
  /** When this zone was last warned (a FloodAlert stamped from it), or null if never. */
  lastWarnedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

/** Admin payload for creating/updating a flood-prone area (id/lastWarnedAt/timestamps are server-set). */
export interface NewFloodProneArea {
  name: string;
  district: string;
  latitude: number;
  longitude: number;
  radiusM: number;
  level: AlertLevel;
  note: string | null;
  active: boolean;
}

/** Payload for the manual "Warn" action — all fields optional; the backend falls back to the
 *  zone's own name/note/level when omitted. */
export interface WarnArea {
  title?: string;
  body?: string;
  level?: AlertLevel;
}

export interface LatLng {
  lat: number;
  lng: number;
}

/**
 * A stretch of road with a flood-passability status, map-matched by baha-api from the
 * coordinates citizens report. The backend only emits currently-flooded segments and drops
 * them as their underlying reports expire (mirrors the report TTL).
 */
export interface RoadSegment {
  id: number;
  name: string | null;
  status: Road;
  path: LatLng[];
  reportsCount: number;
  updatedAt: string;
}

/** Payload for creating a flood report (the reporter is taken from the JWT). */
export interface NewReport {
  name: string;
  district: string;
  latitude: number;
  longitude: number;
  severity: Severity;
  depthCm: number;
  trend: Trend;
  road: Road;
  /** Anti-abuse CAPTCHA proof, sent only for guest submissions when Turnstile is configured. */
  captchaToken?: string;
  /** Optional flood photo as a compressed JPEG data-URL; the backend stores the bytes in the DB. */
  photoDataUrl?: string;
  /** Admin-only: mark this as an authoritative "system" report (news/other sources). The backend
   *  honors it only for ADMIN callers and tags it `reporterTrust: 'system'`. */
  system?: boolean;
  /** Admin-only: when the flood was reported by the source (ISO). Anchors the TTL countdown. */
  reportedAt?: string;
  /** Admin-only: how long the report stays live, in minutes. Omit ⇒ severity default TTL. */
  ttlMinutes?: number;
  /** Admin-only: networks to auto-post this report to (server-side, after the report is saved). */
  socialNetworks?: SocialNetwork[];
  /** Admin-only: caption body for the auto-post, WITHOUT any URL — the server appends the deep link. */
  socialCaption?: string;
}

/**
 * A citizen SOS rescue request, pinned to the sender's coordinates and attributed to a district
 * (the nearest reported area) so requests can be tallied per district.
 */
export interface RescueRequest {
  id: number;
  latitude: number;
  longitude: number;
  district: string;
  city: string | null;
  barangay: string | null;
  note: string | null;
  status: RescueStatus;
  createdAt: string;
  lastRequestedAt?: string;
}

/** Payload for sending a rescue request (the sender is taken from the JWT). */
export interface NewRescue {
  latitude: number;
  longitude: number;
  district: string;
  city?: string;
  barangay?: string;
  note?: string;
}

/** Admin payloads — what the management forms submit to baha-api (id/timestamps are server-set). */
export interface NewCenter {
  name: string;
  latitude: number;
  longitude: number;
  contact: string;
}

export interface NewHotline {
  name: string;
  description: string | null;
  phoneNumber: string;
  position: number;
}

export interface NewAlert {
  title: string;
  body: string;
  region: string | null;
  level: AlertLevel;
  active: boolean;
}

export type FeedbackType = 'bug' | 'feature';
export type FeedbackStatus = 'pending' | 'accepted' | 'declined';

/**
 * A bug report or feature request. Anyone (including a no-login guest) can submit one; it enters as
 * `pending`. Admins accept/decline in the console, and accepted items — both bugs and features —
 * appear on the public Community feedback board, where anyone can upvote them.
 */
export interface Feedback {
  id: number;
  type: FeedbackType;
  title: string;
  details: string | null;
  status: FeedbackStatus;
  submittedByUserId: number | null;
  submitterName: string | null;
  /** Total upvotes from the community. */
  upvotes: number;
  /** Whether the current caller (account or guest device) has already upvoted — like `mine` on reports. */
  upvotedByMe: boolean;
  createdAt: string;
  updatedAt: string;
}

/** Payload for submitting feedback (the submitter is taken from the JWT, full account or guest). */
export interface NewFeedback {
  type: FeedbackType;
  title: string;
  details?: string;
  /** Anti-abuse CAPTCHA proof, sent only for guest submissions when Turnstile is configured. */
  captchaToken?: string;
}

/** Site visit tally — `total` is the all-time count returned by the public stats endpoint. */
export interface VisitStats {
  total: number;
}

/** Global, admin-controlled app settings (`GET /settings`, public read / ADMIN-only patch). */
export interface AppSettings {
  /** Whether the floating community-chat bubble is shown. Default true. */
  chatEnabled: boolean;
  /** Kill switch: whether system reports are ever auto-posted to Facebook. Default true. */
  socialAutopostFacebook: boolean;
  /** Kill switch: whether system reports are ever auto-posted to X. Default true. */
  socialAutopostX: boolean;
}

/** A social network a system report can be auto-posted to. */
export type SocialNetwork = 'facebook' | 'x';

/** Auto-post status for one (report, network) pair (`GET /social-posts`, ADMIN only). */
export interface SocialPost {
  id: number;
  reportId: number;
  network: SocialNetwork;
  status: 'pending' | 'sent' | 'failed' | 'skipped';
  externalId: string | null;
  externalUrl: string | null;
  caption: string | null;
  attempts: number;
  lastError: string | null;
  createdAt: string;
  updatedAt: string;
}

// ── Trip monitoring (client-only) ──────────────────────────────────────────────────
// A Trip and its Stops exist ONLY on the device (localStorage `baha_trip_v1`). Unlike every other
// type in this file, nothing here is ever sent to or received from baha-api.

/** One tagged place along a trip, monitored for new flood reports. */
export interface TripStop {
  /** Stable client id — never key off array index, stops reorder. */
  id: string;
  /** User-facing label, e.g. "EDSA / Ortigas". Seeded from the picked place, editable. */
  label: string;
  lat: number;
  lng: number;
  /** Per-stop alert radius, km. */
  radiusKm: number;
  /** Canonical road name captured when the stop was added (snapToRoad, else reverse geocode).
   *  Powers the road-name arm of alert matching; null when nothing could be resolved. */
  roadName: string | null;
  /** City/municipality at add time — disambiguates common road names ("Rizal St"). */
  city: string | null;
}

/** The single active trip. Stops persist across End/Start so a trip can be resumed. */
export interface Trip {
  /** Minted fresh on every Start trip; scopes per-trip bookkeeping. */
  id: string;
  /** true while stops are being monitored. false keeps the stops but silences alerts. */
  active: boolean;
  /** Ordered: [0] = start, last = destination. */
  stops: TripStop[];
  /** Epoch ms the trip was last started; 0 if never started. */
  startedAt: number;
}
