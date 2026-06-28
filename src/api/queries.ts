import { api, buildQuery } from './client';
import type {
  EvacuationCenter,
  Feedback,
  FeedbackStatus,
  FloodAlert,
  FloodReport,
  Hotline,
  NewAlert,
  NewCenter,
  NewFeedback,
  NewHotline,
  NewReport,
  NewRescue,
  ReportStatus,
  RescueRequest,
  RescueStatus,
  RoadSegment,
  Severity,
  VisitStats,
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
};
