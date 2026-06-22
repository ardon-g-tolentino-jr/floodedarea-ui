// Single source of truth for BahaWatch domain types. Field names mirror the JSON
// the baha-api returns (camelCase).

export type Severity = 'high' | 'medium' | 'low';
export type Trend = 'rising' | 'steady' | 'receding';
export type Road = 'impassable' | 'risky' | 'passable';
export type ReportStatus = 'active' | 'resolved';
export type AlertLevel = 'yellow' | 'orange' | 'red';
export type RescueStatus = 'pending' | 'dispatched' | 'resolved';
export type UserRole = 'CITIZEN' | 'ADMIN';

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
