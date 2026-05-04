/**
 * Aggregates the data the Home screen needs in one place.
 * Each query has its own cache so individual screens that already use
 * '/api/diagnoses' or '/api/weather' share the same data.
 */
import { useQuery } from '@tanstack/react-query';
import * as Location from 'expo-location';
import { useEffect, useState } from 'react';

import { apiClient } from '@/api/client';

export interface RecentDiagnosis {
  id: string;
  crop_name: string;
  predicted_disease: string | null;
  confidence: number;
  is_healthy: boolean;
  image_url: string;
  created_at: string;
}

export interface CurrentWeather {
  temperature_c: number | null;
  precipitation_mm: number | null;
  humidity_pct: number | null;
}

export function useHomeData() {
  // Recent diagnoses — first 5
  const diagnosesQ = useQuery({
    queryKey: ['diagnoses'],
    queryFn: async () => {
      const res = await apiClient.get<RecentDiagnosis[]>('/api/diagnoses', {
        params: { limit: 5 },
      });
      return res.data;
    },
  });

  // Lightweight GPS — only used to fetch a one-line weather summary
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null);
  useEffect(() => {
    (async () => {
      try {
        const { status } = await Location.getForegroundPermissionsAsync();
        if (status !== 'granted') {
          setCoords({ lat: 5.6037, lng: -0.1870 }); // Accra default
          return;
        }
        const loc = await Location.getLastKnownPositionAsync();
        if (loc) setCoords({ lat: loc.coords.latitude, lng: loc.coords.longitude });
        else setCoords({ lat: 5.6037, lng: -0.1870 });
      } catch {
        setCoords({ lat: 5.6037, lng: -0.1870 });
      }
    })();
  }, []);

  const weatherQ = useQuery({
    queryKey: ['weather', coords?.lat, coords?.lng],
    enabled: !!coords,
    queryFn: async () => {
      const res = await apiClient.get('/api/weather', {
        params: { lat: coords!.lat, lng: coords!.lng },
      });
      return res.data;
    },
    staleTime: 5 * 60 * 1000, // 5 min
  });

  // Today's diagnosis count (client-side derive from list)
  const today = new Date().toDateString();
  const diagnosesToday = (diagnosesQ.data ?? []).filter(
    (d) => new Date(d.created_at).toDateString() === today,
  ).length;

  return {
    recent: diagnosesQ.data ?? [],
    diagnosesToday,
    totalDiagnoses: diagnosesQ.data?.length ?? 0,
    currentWeather: weatherQ.data?.current as CurrentWeather | undefined,
    weatherLoading: weatherQ.isLoading,
  };
}