import { rawApi } from '../api/queries';
import type { EvacuationCenter, FloodAlert, FloodReport, Hotline, RescueRequest, RoadSegment, Severity } from '../types';
import { useFetch, type FetchResult } from './useFetch';

export function useReports(severity?: Severity): FetchResult<FloodReport[]> {
  return useFetch(() => rawApi.reports(severity), [severity]);
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
