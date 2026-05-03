import { useQuery } from '@tanstack/react-query';
import { useLocalSearchParams, useRouter } from 'expo-router';
import {
  ActivityIndicator,
  Image,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

import { apiClient } from '@/api/client';

interface Prediction {
  class_name: string;
  display_name: string | null;
  confidence: number;
}

interface TreatmentAdvice {
  severity: string;
  summary: string;
  immediate_actions: string[];
  organic_treatment: string | null;
  chemical_treatment: string | null;
  prevention: string | null;
}

interface DiagnosisDetail {
  id: string;
  crop_name: string;
  image_url: string;
  predicted_disease: string;
  confidence: number;
  is_healthy: boolean;
  top_predictions: Prediction[];
  treatment_advice: TreatmentAdvice | null;
  created_at: string;
}

const severityColor = (s: string | null | undefined) => {
  if (!s) return '#64748b';
  return ({
    high: '#dc2626',
    moderate: '#f59e0b',
    low: '#16a34a',
    none: '#16a34a',
  } as Record<string, string>)[s.toLowerCase()] ?? '#64748b';
};

export default function DiagnosisDetailScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();

  const { data, isLoading, error } = useQuery({
    queryKey: ['diagnosis', id],
    queryFn: async () => {
      const res = await apiClient.get<DiagnosisDetail>(`/api/diagnoses/${id}`);
      return res.data;
    },
    enabled: !!id,
  });

  if (isLoading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color="#16a34a" />
      </View>
    );
  }

  if (error || !data) {
    return (
      <View style={styles.center}>
        <Text style={{ color: '#dc2626' }}>Couldn't load this diagnosis.</Text>
        <TouchableOpacity style={styles.doneBtn} onPress={() => router.back()}>
          <Text style={styles.doneText}>Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const confidencePct = Math.round(data.confidence * 100);
  const dateStr = new Date(data.created_at).toLocaleString();

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ paddingBottom: 60 }}>
      <Image source={{ uri: data.image_url }} style={styles.image} resizeMode="cover" />

      <View style={styles.body}>
        <Text style={styles.cropLabel}>{data.crop_name} · {dateStr}</Text>
        <Text style={[styles.disease, { color: data.is_healthy ? '#16a34a' : '#0f172a' }]}>
          {data.predicted_disease}
        </Text>

        <View style={styles.confidenceRow}>
          <View style={[
            styles.severityBadge,
            { backgroundColor:
                data.treatment_advice
                  ? severityColor(data.treatment_advice.severity)
                  : '#16a34a' },
          ]}>
            <Text style={styles.severityText}>
              {data.treatment_advice?.severity?.toUpperCase() ?? (data.is_healthy ? 'HEALTHY' : 'UNKNOWN')}
            </Text>
          </View>
          <Text style={styles.confidence}>{confidencePct}% confident</Text>
        </View>

        {data.treatment_advice && (
          <>
            <Section title="Summary" body={data.treatment_advice.summary} />

            {(data.treatment_advice.immediate_actions?.length ?? 0) > 0 && (
  <View style={styles.section}>
    <Text style={styles.sectionTitle}>Immediate actions</Text>
    {data.treatment_advice.immediate_actions!.map((action, i) => (
                  <View key={i} style={styles.actionRow}>
                    <Text style={styles.actionNumber}>{i + 1}</Text>
                    <Text style={styles.actionText}>{action}</Text>
                  </View>
                ))}
              </View>
            )}

            {data.treatment_advice.organic_treatment && (
              <Section title="Organic treatment" body={data.treatment_advice.organic_treatment} />
            )}

            {data.treatment_advice.chemical_treatment && (
              <Section title="Chemical treatment" body={data.treatment_advice.chemical_treatment} />
            )}

            {data.treatment_advice.prevention && (
              <Section title="Prevention" body={data.treatment_advice.prevention} />
            )}
          </>
        )}

        {(data.top_predictions?.length ?? 0) > 1 && (
  <View style={styles.section}>
    <Text style={styles.sectionTitle}>Other possibilities</Text>
    {data.top_predictions!.slice(1).map((p, i) => (
              <View key={i} style={styles.altRow}>
                <Text style={styles.altName}>{p.display_name ?? p.class_name}</Text>
                <Text style={styles.altConf}>{Math.round(p.confidence * 100)}%</Text>
              </View>
            ))}
          </View>
        )}

        <TouchableOpacity style={styles.doneBtn} onPress={() => router.back()}>
          <Text style={styles.doneText}>Back to history</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

function Section({ title, body }: { title: string; body: string }) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      <Text style={styles.sectionBody}>{body}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8fafc' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#f8fafc' },
  image: { width: '100%', height: 280, backgroundColor: '#e2e8f0' },
  body: { padding: 20 },
  cropLabel: { fontSize: 12, color: '#64748b', fontWeight: '600' },
  disease: { fontSize: 22, fontWeight: '800', marginTop: 4 },
  confidenceRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 12, marginBottom: 8 },
  severityBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999 },
  severityText: { color: 'white', fontWeight: '700', fontSize: 11, letterSpacing: 0.5 },
  confidence: { color: '#64748b', fontSize: 13, fontWeight: '600' },
  section: {
    backgroundColor: 'white',
    padding: 16,
    borderRadius: 12,
    marginTop: 16,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  sectionTitle: { fontSize: 14, fontWeight: '700', color: '#0f172a', marginBottom: 8 },
  sectionBody: { fontSize: 14, color: '#334155', lineHeight: 20 },
  actionRow: { flexDirection: 'row', gap: 12, marginTop: 8 },
  actionNumber: {
    width: 24, height: 24, borderRadius: 12,
    backgroundColor: '#16a34a', color: 'white', fontWeight: '700',
    textAlign: 'center', lineHeight: 24, fontSize: 12,
  },
  actionText: { flex: 1, color: '#334155', lineHeight: 20, fontSize: 14 },
  altRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 6 },
  altName: { color: '#475569', fontSize: 14, flex: 1 },
  altConf: { color: '#94a3b8', fontWeight: '600', fontSize: 13 },
  doneBtn: {
    backgroundColor: '#16a34a',
    paddingVertical: 14,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 24,
  },
  doneText: { color: 'white', fontWeight: '700', fontSize: 16 },
});