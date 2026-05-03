import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { apiClient } from '@/api/client';
import { CropSelector } from '@/components/CropSelector';

interface MarketPrice {
  id: string;
  crop_name: string;
  market_name: string;
  region: string | null;
  price_per_kg: string | null;
  price_per_bag: string | null;
  price_trend: string | null;
  recorded_at: string;
}

export default function PricesScreen() {
  const [cropId, setCropId] = useState<string | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ['prices', cropId],
    queryFn: async () => {
      const params = cropId ? { crop_id: cropId, limit: 20 } : { limit: 20 };
      const res = await apiClient.get<MarketPrice[]>('/api/prices', { params });
      return res.data;
    },
  });

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Market prices</Text>
      <Text style={styles.subtitle}>Filter by crop</Text>

      <View style={styles.cropBox}>
        <CropSelector value={cropId} onChange={setCropId} />
      </View>

      {isLoading ? (
        <ActivityIndicator color="#16a34a" style={{ marginTop: 24 }} />
      ) : !data || data.length === 0 ? (
        <Text style={styles.empty}>No price data yet for this crop.</Text>
      ) : (
        <FlatList
          data={data}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ paddingBottom: 100 }}
          renderItem={({ item }) => <PriceCard item={item} />}
          ItemSeparatorComponent={() => <View style={{ height: 10 }} />}
        />
      )}
    </View>
  );
}

function PriceCard({ item }: { item: MarketPrice }) {
  const trend = item.price_trend;
  const trendIcon = trend === 'up' ? '📈' : trend === 'down' ? '📉' : '➡️';
  const trendColor = trend === 'up' ? '#dc2626' : trend === 'down' ? '#16a34a' : '#64748b';

  return (
    <View style={styles.card}>
      <View style={{ flex: 1 }}>
        <Text style={styles.market}>{item.market_name}</Text>
        <Text style={styles.crop}>{item.crop_name}{item.region ? ` · ${item.region}` : ''}</Text>
      </View>
      <View style={styles.priceColumn}>
        <Text style={styles.price}>GH₵ {parseFloat(item.price_per_kg ?? '0').toFixed(2)}</Text>
        <Text style={styles.priceLabel}>per kg</Text>
        {trend && (
          <Text style={[styles.trend, { color: trendColor }]}>{trendIcon} {trend}</Text>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 24, paddingTop: 60, backgroundColor: '#f8fafc' },
  title: { fontSize: 24, fontWeight: '800', color: '#15803d' },
  subtitle: { fontSize: 13, fontWeight: '600', color: '#64748b', marginTop: 16, marginBottom: 8 },
  cropBox: { marginHorizontal: -24, paddingHorizontal: 24, marginBottom: 16 },
  card: {
    flexDirection: 'row',
    backgroundColor: 'white',
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  market: { fontSize: 15, fontWeight: '700', color: '#0f172a' },
  crop: { fontSize: 12, color: '#64748b', marginTop: 2 },
  priceColumn: { alignItems: 'flex-end' },
  price: { fontSize: 18, fontWeight: '800', color: '#15803d' },
  priceLabel: { fontSize: 11, color: '#94a3b8' },
  trend: { fontSize: 11, fontWeight: '600', marginTop: 4 },
  empty: { textAlign: 'center', color: '#64748b', marginTop: 40 },
});