import { useQuery } from '@tanstack/react-query';
import { ActivityIndicator, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import { apiClient } from '@/api/client';

interface Crop {
  id: string;
  name: string;
}

interface Props {
  value: string | null;
  onChange: (cropId: string) => void;
}

export function CropSelector({ value, onChange }: Props) {
  const { data, isLoading, error } = useQuery({
    queryKey: ['crops'],
    queryFn: async () => {
      const res = await apiClient.get<Crop[]>('/api/crops');
      return res.data;
    },
  });

  if (isLoading) {
    return (
      <View style={styles.loadingBox}>
        <ActivityIndicator color="#16a34a" />
      </View>
    );
  }

  if (error || !data) {
    return <Text style={styles.error}>Couldn't load crops.</Text>;
  }

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.row}
    >
      {data.map((crop) => {
        const isSelected = crop.id === value;
        return (
          <TouchableOpacity
            key={crop.id}
            onPress={() => onChange(crop.id)}
            style={[styles.chip, isSelected && styles.chipSelected]}
          >
            <Text style={[styles.chipText, isSelected && styles.chipTextSelected]}>
              {crop.name}
            </Text>
          </TouchableOpacity>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  row: { gap: 8, paddingHorizontal: 4, paddingVertical: 4 },
  chip: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: 'white',
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#cbd5e1',
  },
  chipSelected: {
    backgroundColor: '#16a34a',
    borderColor: '#16a34a',
  },
  chipText: { fontSize: 14, fontWeight: '600', color: '#334155' },
  chipTextSelected: { color: 'white' },
  loadingBox: { paddingVertical: 16, alignItems: 'center' },
  error: { color: '#dc2626', textAlign: 'center', padding: 16 },
});