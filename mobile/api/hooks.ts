/**
 * React Query hooks — one place for every server read, with consistent
 * cache keys so screens share data instead of refetching it.
 */
import { useInfiniteQuery, useQuery } from '@tanstack/react-query';

import { apiClient } from '@/api/client';
import type {
  AdvisoryResponse,
  Crop,
  DiagnosisDetail,
  DiagnosisListItem,
  DiagnosisStats,
  FarmPlot,
  GuideEntry,
  GuideSummary,
  LatestPrice,
  WeatherResponse,
} from '@/api/types';
import type { Coords } from '@/hooks/useLocation';

export const queryKeys = {
  crops: ['crops'] as const,
  diagnoses: ['diagnoses'] as const,
  diagnosisList: (filter: string) => ['diagnoses', 'list', filter] as const,
  diagnosisStats: ['diagnoses', 'stats'] as const,
  diagnosis: (id: string) => ['diagnosis', id] as const,
  prices: (cropId: string | null) => ['prices', 'latest', cropId ?? 'all'] as const,
  weather: (c: Coords | null) => ['weather', c?.lat?.toFixed(2), c?.lng?.toFixed(2)] as const,
  guide: ['guide'] as const,
  guideEntry: (slug: string) => ['guide', slug] as const,
  plots: ['plots'] as const,
  advisory: (c: Coords | null, crop?: string | null) =>
    ['advisory', c?.lat?.toFixed(2), c?.lng?.toFixed(2), crop ?? ''] as const,
};

export function useCrops() {
  return useQuery({
    queryKey: queryKeys.crops,
    queryFn: async () => (await apiClient.get<Crop[]>('/api/crops')).data,
    staleTime: 24 * 60 * 60 * 1000,
  });
}

export function useDiagnosisStats(enabled = true) {
  return useQuery({
    queryKey: queryKeys.diagnosisStats,
    queryFn: async () => (await apiClient.get<DiagnosisStats>('/api/diagnoses/stats')).data,
    enabled,
  });
}

export function useRecentDiagnoses(limit = 3) {
  return useQuery({
    queryKey: ['diagnoses', 'recent', limit],
    queryFn: async () =>
      (await apiClient.get<DiagnosisListItem[]>('/api/diagnoses', { params: { limit } })).data,
  });
}

const PAGE = 20;

export function useDiagnosisHistory() {
  return useInfiniteQuery({
    queryKey: queryKeys.diagnosisList('all'),
    initialPageParam: 0,
    queryFn: async ({ pageParam }) =>
      (
        await apiClient.get<DiagnosisListItem[]>('/api/diagnoses', {
          params: { limit: PAGE, offset: pageParam },
        })
      ).data,
    getNextPageParam: (last, all) => (last.length === PAGE ? all.length * PAGE : undefined),
  });
}

export function useDiagnosis(id: string | undefined) {
  return useQuery({
    queryKey: queryKeys.diagnosis(id ?? ''),
    queryFn: async () => (await apiClient.get<DiagnosisDetail>(`/api/diagnoses/${id}`)).data,
    enabled: !!id,
    staleTime: 5 * 60 * 1000,
  });
}

export function useLatestPrices(cropId: string | null) {
  return useQuery({
    queryKey: queryKeys.prices(cropId),
    queryFn: async () =>
      (
        await apiClient.get<LatestPrice[]>('/api/prices/latest', {
          params: cropId ? { crop_id: cropId } : {},
        })
      ).data,
    staleTime: 30 * 60 * 1000,
  });
}

export function useWeather(coords: Coords | null) {
  return useQuery({
    queryKey: queryKeys.weather(coords),
    enabled: !!coords,
    queryFn: async () =>
      (
        await apiClient.get<WeatherResponse>('/api/weather', {
          params: { lat: coords!.lat, lng: coords!.lng },
        })
      ).data,
    staleTime: 30 * 60 * 1000,
  });
}

export function useAdvisory(coords: Coords | null, cropName?: string | null) {
  return useQuery({
    queryKey: queryKeys.advisory(coords, cropName),
    enabled: !!coords,
    queryFn: async () =>
      (
        await apiClient.get<AdvisoryResponse>('/api/weather/advisory', {
          params: {
            lat: coords!.lat,
            lng: coords!.lng,
            ...(cropName ? { crop_name: cropName } : {}),
          },
          timeout: 60000,
        })
      ).data,
    staleTime: 3 * 60 * 60 * 1000,
    retry: 1,
  });
}

export function useGuide() {
  return useQuery({
    queryKey: queryKeys.guide,
    queryFn: async () => (await apiClient.get<GuideSummary[]>('/api/library')).data,
    staleTime: 24 * 60 * 60 * 1000,
  });
}

export function useGuideEntry(slug: string | undefined) {
  return useQuery({
    queryKey: queryKeys.guideEntry(slug ?? ''),
    queryFn: async () => (await apiClient.get<GuideEntry>(`/api/library/${slug}`)).data,
    enabled: !!slug,
    staleTime: 24 * 60 * 60 * 1000,
  });
}

export function usePlots() {
  return useQuery({
    queryKey: queryKeys.plots,
    queryFn: async () => (await apiClient.get<FarmPlot[]>('/api/plots')).data,
  });
}
