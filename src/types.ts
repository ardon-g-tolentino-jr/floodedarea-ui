// Single source of truth for FloodedArea domain types. Field names mirror the JSON
// the baha-api returns (camelCase).

export type Severity = 'high' | 'medium' | 'low';
export type Trend = 'rising' | 'steady' | 'receding';
export type Road = 'impassable' | 'risky' | 'passable';
export type ReportStatus = 'active' | 'resolved';
export type AlertLevel = 'yellow' | 'orange' | 'red';
export type RescueStatus = 'pending' | 'dispatched' | 'resolved';
export type UserRole = 'CITIZEN' | 'ADMIN' | 'GUEST';
/** How much we trust the report's author: a full account vs. a no-login guest/device session. */
export type ReporterTrust = 'verified' | 'guest';

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
  createdAt: string;
  updatedAt: string;
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
