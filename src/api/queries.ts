import { api, buildQuery } from './client';
import type {
  AppSettings,
  EvacuationCenter,
  Feedback,
  FeedbackStatus,
  FloodAlert,
  FloodProneArea,
  FloodReport,
  Hotline,
  NewAlert,
  NewCenter,
  NewFeedback,
  NewFloodProneArea,
  NewHotline,
  NewReport,
  NewRescue,
  ReportStatus,
  RescueRequest,
  RescueStatus,
  RoadSegment,
  Severity,
  SocialPost,
  VisitStats,
  BulkAlertResult,
  BulkWarnAreas,
  WarnArea,
} from '../types';

/** Typed GET functions. baha-api returns domain-shaped JSON, so these are direct. */
export const rawApi = {
  reports: (severity?: Severity) =>
    api.get<FloodReport[]>(`/reports${buildQuery({ severity })}`),
  reportHistory: (from: string, to: string) =>
    api.get<FloodReport[]>(`/reports/history${buildQuery({ from, to })}`),
  centers: () => api.get<EvacuationCenter[]>('/centers'),
  hotlines: () => api.get<Hotline[]>('/hotlines'),
  alerts: () => api.get<FloodAlert[]>('/alerts'),
  roadStatus: () => api.get<RoadSegment[]>('/road-status'),
  rescues: () => api.get<RescueRequest[]>('/rescue'),
  /** Accepted feedback (bugs + features) — the public Community feedback board, ordered by upvotes. */
  acceptedFeedback: () => api.get<Feedback[]>('/feedback/accepted'),
  /** Admin: the full feedback moderation queue. */
  allFeedback: () => api.get<Feedback[]>('/feedback'),
  /** Public all-time visit tally (read-only — does not increment). */
  visitCount: () => api.get<VisitStats>('/stats/visits'),
  /** Global app settings (e.g. community chat visibility). Public read. */
  settings: () => api.get<AppSettings>('/settings'),
  /** Active flood-prone areas (the pin+radius zones drawn on the map). Public read. */
  floodProneAreas: () => api.get<FloodProneArea[]>('/flood-prone'),
  /** Admin: recent auto-post attempts (newest first) — powers the AdminPanel "Social posts" list. */
  socialPosts: () => api.get<SocialPost[]>('/social-posts?limit=50'),
};

/** POST/PATCH/DELETE mutations. */
export const mutations = {
  /** Record one site visit and return the new all-time total. Public (no auth). */
  recordVisit: () => api.post<VisitStats>('/stats/visit', {}),
  createReport: (body: NewReport) => api.post<FloodReport>('/reports', body),
  confirmReport: (id: number) => api.post<FloodReport>(`/reports/${id}/confirm`, {}),
  resolveReport: (id: number) => api.patch<FloodReport>(`/reports/${id}`, { status: 'resolved' }),
  updateReport: (id: number, body: Partial<NewReport & { status: ReportStatus }>) =>
    api.patch<FloodReport>(`/reports/${id}`, body),
  deleteReport: (id: number) => api.delete<void>(`/reports/${id}`),
  createRescue: (body: NewRescue) => api.post<RescueRequest>('/rescue', body),
  /** Responder action: advance a rescue request's status (pending → dispatched → resolved). */
  updateRescue: (id: number, body: { status: RescueStatus }) =>
    api.patch<RescueRequest>(`/rescue/${id}`, body),

  // ── Feedback: anyone (account or guest) submits; admin accepts/declines; anyone upvotes ──
  createFeedback: (body: NewFeedback) => api.post<Feedback>('/feedback', body),
  updateFeedbackStatus: (id: number, status: FeedbackStatus) =>
    api.patch<Feedback>(`/feedback/${id}`, { status }),
  /** Toggle the caller's upvote on a feedback item; returns the updated item (count + upvotedByMe). */
  upvoteFeedback: (id: number) => api.post<Feedback>(`/feedback/${id}/upvote`, {}),

  // ── Admin: evacuation centers ──
  createCenter: (body: NewCenter) => api.post<EvacuationCenter>('/centers', body),
  updateCenter: (id: number, body: Partial<NewCenter>) =>
    api.patch<EvacuationCenter>(`/centers/${id}`, body),
  deleteCenter: (id: number) => api.delete<void>(`/centers/${id}`),

  // ── Admin: emergency hotlines ──
  createHotline: (body: NewHotline) => api.post<Hotline>('/hotlines', body),
  updateHotline: (id: number, body: Partial<NewHotline>) =>
    api.patch<Hotline>(`/hotlines/${id}`, body),
  deleteHotline: (id: number) => api.delete<void>(`/hotlines/${id}`),

  // ── Admin: rainfall alerts ──
  createAlert: (body: NewAlert) => api.post<FloodAlert>('/alerts', body),
  updateAlert: (id: number, body: Partial<NewAlert>) =>
    api.patch<FloodAlert>(`/alerts/${id}`, body),
  deleteAlert: (id: number) => api.delete<void>(`/alerts/${id}`),

  // ── Admin: global app settings ──
  updateSettings: (body: Partial<AppSettings>) => api.patch<AppSettings>('/settings', body),

  // ── Admin: flood-prone areas ──
  createFloodProneArea: (body: NewFloodProneArea) => api.post<FloodProneArea>('/flood-prone', body),
  updateFloodProneArea: (id: number, body: Partial<NewFloodProneArea>) =>
    api.patch<FloodProneArea>(`/flood-prone/${id}`, body),
  deleteFloodProneArea: (id: number) => api.delete<void>(`/flood-prone/${id}`),
  /** Manual trigger: broadcasts a geo-stamped FloodAlert from this zone. Never fired automatically. */
  warnFloodProneArea: (id: number, body: WarnArea) => api.post<FloodAlert>(`/flood-prone/${id}/warn`, body),
  /** Warn many zones in ONE request and one SSE broadcast — the scoped/bulk counterpart to
   *  `warnFloodProneArea`. Looping the single-zone endpoint instead would fan out one broadcast per
   *  zone, and every connected client refetches on each one. */
  warnFloodProneAreasBulk: (body: BulkWarnAreas) => api.post<BulkAlertResult>('/flood-prone/warn-bulk', body),
  /** Deactivate the standing warnings raised from these zones — the undo for the bulk warn.
   *  Global alerts and warnings from zones outside the list are never touched. */
  clearFloodProneWarnings: (areaIds: number[]) =>
    api.post<BulkAlertResult>('/flood-prone/clear-warnings', { areaIds }),

  // ── Admin: social auto-post ──
  /** Reset attempts and republish one failed/pending row. */
  retrySocialPost: (id: number) => api.post<SocialPost>(`/social-posts/${id}/retry`, {}),
};
