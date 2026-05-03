import { useQuery } from '@tanstack/react-query';
import * as Location from 'expo-location';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

import { apiClient } from '@/api/client';

interface CurrentConditions {
  temperature_c: number | null;
  humidity_pct: number | null;
  precipitation_mm: number | null;
  wind_kph: number | null;
}

interface DailyForecast {
  date: string;
  temp_max_c: number | null;
  temp_min_c: number | null;
  precipitation_mm: number | null;
}

interface WeatherResponse {
  latitude: number;
  longitude: number;
  current: CurrentConditions | null;
  daily: DailyForecast[];
}

interface AdvisoryResponse {
  headline: string;
  rainfall_outlook: string;
  temperature_outlook: string;
  recommendations: string[];
  warnings: string[];
}

export default function WeatherScreen() {
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [permErr, setPermErr] = useState<string | null>(null);
  const [placeName, setPlaceName] = useState<string>('');

  useEffect(() => {
  (async () => {
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== 'granted') {
      setCoords({ lat: 5.6037, lng: -0.1870 });
      setPlaceName('Accra, Ghana');
      setPermErr('Using Accra (location permission denied).');
      return;
    }
    try {
      const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      setCoords({ lat: loc.coords.latitude, lng: loc.coords.longitude });

      // Reverse geocode to get a friendly place name
      try {
        const places = await Location.reverseGeocodeAsync({
          latitude: loc.coords.latitude,
          longitude: loc.coords.longitude,
        });
        if (places[0]) {
          const p = places[0];
          const label = [p.city || p.subregion, p.region, p.country]
            .filter(Boolean)
            .slice(0, 2)
            .join(', ');
          setPlaceName(label || 'Your location');
        }
      } catch {
        setPlaceName('Your location');
      }
    } catch {
      setCoords({ lat: 5.6037, lng: -0.1870 });
      setPlaceName('Accra, Ghana');
      setPermErr('Couldn\'t get GPS — using Accra.');
    }
  })();
}, []);

  const { data: weather, isLoading: weatherLoading } = useQuery({
    queryKey: ['weather', coords?.lat, coords?.lng],
    enabled: !!coords,
    queryFn: async () => {
      const res = await apiClient.get<WeatherResponse>('/api/weather', {
        params: { lat: coords!.lat, lng: coords!.lng },
      });
      return res.data;
    },
  });

  const { data: advisory, isLoading: advisoryLoading } = useQuery({
    queryKey: ['advisory', coords?.lat, coords?.lng],
    enabled: !!coords,
    queryFn: async () => {
      const res = await apiClient.get<AdvisoryResponse>('/api/weather/advisory', {
        params: { lat: coords!.lat, lng: coords!.lng, crop_name: 'maize', region: 'Ghana' },
      });
      return res.data;
    },
  });

  if (!coords || weatherLoading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color="#16a34a" />
        <Text style={{ color: '#64748b', marginTop: 12 }}>Getting weather…</Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ padding: 24, paddingTop: 60 }}>
      <Text style={styles.title}>Weather</Text>
      {placeName ? <Text style={styles.locationLabel}>📍 {placeName}</Text> : null}
      {permErr && <Text style={styles.note}>{permErr}</Text>}

      {weather?.current && (
        <View style={styles.currentCard}>
          <Text style={styles.tempBig}>
            {weather.current.temperature_c?.toFixed(0) ?? '—'}°C
          </Text>
          <View style={styles.currentMeta}>
            <Text style={styles.metaItem}>💧 {weather.current.humidity_pct?.toFixed(0) ?? '—'}%</Text>
            <Text style={styles.metaItem}>🌧️ {weather.current.precipitation_mm?.toFixed(1) ?? '0.0'}mm</Text>
            <Text style={styles.metaItem}>🌬️ {weather.current.wind_kph?.toFixed(0) ?? '—'}km/h</Text>
          </View>
        </View>
      )}

      <Text style={styles.sectionTitle}>7-day forecast</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.forecastRow}>
        {weather?.daily.map((day, i) => (
          <View key={i} style={styles.dayCard}>
            <Text style={styles.dayLabel}>
              {new Date(day.date).toLocaleDateString(undefined, { weekday: 'short' })}
            </Text>
            <Text style={styles.dayTemp}>
              {day.temp_max_c?.toFixed(0) ?? '—'}° / {day.temp_min_c?.toFixed(0) ?? '—'}°
            </Text>
            <Text style={styles.dayRain}>
              💧 {day.precipitation_mm?.toFixed(1) ?? '0.0'}mm
            </Text>
          </View>
        ))}
      </ScrollView>

      <Text style={styles.sectionTitle}>Planting advisory</Text>
      {advisoryLoading ? (
        <ActivityIndicator color="#16a34a" style={{ marginTop: 16 }} />
      ) : advisory ? (
        <View style={styles.advisoryCard}>
          <Text style={styles.advisoryHeadline}>{advisory.headline}</Text>
          <Text style={styles.advisoryRow}>🌧️ {advisory.rainfall_outlook}</Text>
          <Text style={styles.advisoryRow}>🌡️ {advisory.temperature_outlook}</Text>

          {advisory.recommendations.length > 0 && (
            <View style={{ marginTop: 12 }}>
              <Text style={styles.advisorySectionTitle}>Recommendations</Text>
              {advisory.recommendations.map((r, i) => (
                <Text key={i} style={styles.advisoryItem}>• {r}</Text>
              ))}
            </View>
          )}

          {advisory.warnings.length > 0 && (
            <View style={{ marginTop: 12 }}>
              <Text style={[styles.advisorySectionTitle, { color: '#dc2626' }]}>Warnings</Text>
              {advisory.warnings.map((w, i) => (
                <Text key={i} style={[styles.advisoryItem, { color: '#dc2626' }]}>⚠️ {w}</Text>
              ))}
            </View>
          )}
        </View>
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8fafc' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#f8fafc' },
  title: { fontSize: 24, fontWeight: '800', color: '#15803d' },
  note: { color: '#64748b', fontSize: 12, marginTop: 4 },
  currentCard: {
    backgroundColor: '#16a34a',
    borderRadius: 16,
    padding: 24,
    marginTop: 16,
    alignItems: 'center',
  },
  tempBig: { fontSize: 56, fontWeight: '800', color: 'white' },
  currentMeta: { flexDirection: 'row', gap: 16, marginTop: 8 },
  metaItem: { color: 'white', fontSize: 13 },
  sectionTitle: { fontSize: 14, fontWeight: '700', color: '#0f172a', marginTop: 24, marginBottom: 8 },
  forecastRow: { marginHorizontal: -24 },
  dayCard: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 12,
    marginLeft: 8,
    minWidth: 80,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  dayLabel: { fontSize: 12, fontWeight: '700', color: '#0f172a' },
  dayTemp: { fontSize: 13, color: '#334155', marginTop: 4, fontWeight: '600' },
  dayRain: { fontSize: 11, color: '#64748b', marginTop: 4 },
  advisoryCard: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  advisoryHeadline: { fontSize: 16, fontWeight: '700', color: '#0f172a', marginBottom: 8 },
  advisoryRow: { fontSize: 13, color: '#334155', marginTop: 4 },
  advisorySectionTitle: { fontSize: 13, fontWeight: '700', color: '#0f172a', marginBottom: 4 },
  advisoryItem: { fontSize: 13, color: '#475569', marginTop: 4, lineHeight: 18 },
  locationLabel: { fontSize: 14, color: '#475569', fontWeight: '600', marginTop: 4 },
});