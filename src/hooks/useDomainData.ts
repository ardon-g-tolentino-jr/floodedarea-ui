import { rawApi } from '../api/queries';
import type { EvacuationCenter, Feedback, FloodAlert, FloodReport, Hotline, RescueRequest, RoadSegment, Severity } from '../types';
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

/** Accepted feature requests — the public list shown to registered users. */
export function useAcceptedFeatures(): FetchResult<Feedback[]> {
  return useFetch(() => rawApi.acceptedFeatures(), []);
}

/** Admin: the full feedback moderation queue. */
export function useAllFeedback(): FetchResult<Feedback[]> {
  return useFetch(() => rawApi.allFeedback(), []);
}
