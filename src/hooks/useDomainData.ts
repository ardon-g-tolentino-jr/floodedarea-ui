import { rawApi } from '../api/queries';
import type { AppSettings, EvacuationCenter, Feedback, FloodAlert, FloodProneArea, FloodReport, Hotline, RescueRequest, RoadSegment, Severity } from '../types';
import { useFetch, type FetchResult } from './useFetch';

export function useReports(severity?: Severity): FetchResult<FloodReport[]> {
  return useFetch(() => rawApi.reports(severity), [severity]);
}

/** Reports created on the given local day (`YYYY-MM-DD`), any status — for the water-level chart. */
export function useReportHistory(ymd: string): FetchResult<FloodReport[]> {
  const from = new Date(`${ymd}T00:00:00`).toISOString();
  const to = new Date(new Date(`${ymd}T00:00:00`).getTime() + 86_400_000).toISOString();
  return useFetch(() => rawApi.reportHistory(from, to), [ymd]);
}

export function useCenters(): FetchResult<EvacuationCenter[]> {
  return useFetch(() => rawApi.centers(), []);
}

export function useHotlines(): FetchResult<Hotline[]> {
  return useFetch(() => rawApi.hotlines(), []);
}

export function useAlerts(): FetchResult<FloodAlert[]> {
  return useFetch(() => rawApi.alerts(), []);
}

export function useRoadStatus(): FetchResult<RoadSegment[]> {
  return useFetch(() => rawApi.roadStatus(), []);
}

export function useRescues(): FetchResult<RescueRequest[]> {
  return useFetch(() => rawApi.rescues(), []);
}

/** Accepted feedback (bugs + features) — the public Community feedback board feed. */
export function useAcceptedFeedback(): FetchResult<Feedback[]> {
  return useFetch(() => rawApi.acceptedFeedback(), []);
}

/** Admin: the full feedback moderation queue. `enabled` (admin present) gates the fetch so a normal
 *  visitor never hits the admin-only endpoint (which 403s). */
export function useAllFeedback(enabled: boolean): FetchResult<Feedback[]> {
  return useFetch(() => rawApi.allFeedback(), [], { enabled });
}

/** Global, admin-controlled app settings (e.g. community chat visibility). Public read. */
export function useSettings(): FetchResult<AppSettings> {
  return useFetch(() => rawApi.settings(), []);
}

/** Admin-pinned flood-prone areas (pin + radius, drawn for everyone). Public read, no `enabled`
 *  flag — the zones are shown to every visitor, not just admins. */
export function useFloodProneAreas(): FetchResult<FloodProneArea[]> {
  return useFetch(() => rawApi.floodProneAreas(), []);
}
