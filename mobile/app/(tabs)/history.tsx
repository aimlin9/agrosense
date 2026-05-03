import { useQuery } from '@tanstack/react-query';
import { useRouter, useFocusEffect } from 'expo-router';
import { useCallback } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Image,
  RefreshControl,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

import { apiClient } from '@/api/client';

interface DiagnosisListItem {
  id: string;
  crop_name: string;
  predicted_disease: string | null;
  confidence: number;
  is_healthy: boolean;
  image_url: string;
  created_at: string;
}

export default function HistoryScreen() {
  const router = useRouter();
  const { data, isLoading, refetch, isFetching } = useQuery({
    queryKey: ['diagnoses'],
    queryFn: async () => {
      const res = await apiClient.get<DiagnosisListItem[]>('/api/diagnoses');
      return res.data;
    },
  });

  // Refetch whenever this tab regains focus (e.g., after a new diagnosis)
  useFocusEffect(useCallback(() => { refetch(); }, [refetch]));

  if (isLoading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color="#16a34a" />
      </View>
    );
  }

  if (!data || data.length === 0) {
    return (
      <View style={styles.center}>
        <Text style={styles.emptyEmoji}>📭</Text>
        <Text style={styles.emptyTitle}>No diagnoses yet</Text>
        <Text style={styles.emptyBody}>Take a photo of a sick plant to start.</Text>
        <TouchableOpacity style={styles.cta} onPress={() => router.push('/(tabs)/diagnose')}>
          <Text style={styles.ctaText}>Diagnose now</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <FlatList
      style={styles.container}
      contentContainerStyle={{ padding: 16 }}
      ListHeaderComponent={
        <Text style={styles.title}>Your diagnoses</Text>
      }
      data={data}
      keyExtractor={(item) => item.id}
      refreshControl={
        <RefreshControl refreshing={isFetching} onRefresh={refetch} tintColor="#16a34a" />
      }
      renderItem={({ item }) => <DiagnosisCard item={item} />}
      ItemSeparatorComponent={() => <View style={{ height: 12 }} />}
    />
  );
}

function DiagnosisCard({ item }: { item: DiagnosisListItem }) {
  const router = useRouter();
  const date = new Date(item.created_at);
  const dateStr = date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  const timeStr = date.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
  const confPct = Math.round(item.confidence * 100);
  const isHealthy = item.is_healthy;

  return (
    <TouchableOpacity
      style={styles.card}
      onPress={() => router.push(`/diagnosis/${item.id}`)}
      activeOpacity={0.7}
    >
      <Image source={{ uri: item.image_url }} style={styles.thumb} />
      <View style={styles.cardBody}>
        <Text style={styles.cropName}>{item.crop_name}</Text>
        <Text style={[styles.diseaseName, { color: isHealthy ? '#16a34a' : '#0f172a' }]}>
          {item.predicted_disease ?? 'Unknown'}
        </Text>
        <View style={styles.metaRow}>
          <Text style={styles.confBadge}>{confPct}%</Text>
          <Text style={styles.metaTime}>{dateStr} · {timeStr}</Text>
        </View>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8fafc', paddingTop: 40 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24, backgroundColor: '#f8fafc' },
  title: { fontSize: 24, fontWeight: '800', color: '#15803d', marginBottom: 16 },
  card: {
    flexDirection: 'row',
    backgroundColor: 'white',
    borderRadius: 12,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  thumb: { width: 90, height: 90, backgroundColor: '#e2e8f0' },
  cardBody: { flex: 1, padding: 12, justifyContent: 'center' },
  cropName: { fontSize: 12, color: '#64748b', fontWeight: '600' },
  diseaseName: { fontSize: 15, fontWeight: '700', marginTop: 2 },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 6 },
  confBadge: {
    fontSize: 11,
    fontWeight: '700',
    color: '#15803d',
    backgroundColor: '#dcfce7',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 999,
  },
  metaTime: { fontSize: 12, color: '#94a3b8' },
  emptyEmoji: { fontSize: 64, marginBottom: 12 },
  emptyTitle: { fontSize: 18, fontWeight: '700', color: '#0f172a' },
  emptyBody: { fontSize: 14, color: '#64748b', marginTop: 4, textAlign: 'center' },
  cta: { marginTop: 24, backgroundColor: '#16a34a', paddingHorizontal: 24, paddingVertical: 12, borderRadius: 8 },
  ctaText: { color: 'white', fontWeight: '700', fontSize: 15 },
});