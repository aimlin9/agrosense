import { useRouter, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

import { apiClient } from '@/api/client';

export default function ConfirmScreen() {
  const router = useRouter();
  const { uri, cropId } = useLocalSearchParams<{ uri: string; cropId: string }>();
  const [uploading, setUploading] = useState(false);

  if (!uri || !cropId) {
    return (
      <View style={styles.container}>
        <Text>Missing photo. Go back and try again.</Text>
      </View>
    );
  }

  const handleAnalyze = async () => {
    setUploading(true);

    const formData = new FormData();
    formData.append('crop_id', cropId);
    // React Native's FormData accepts this object shape for files
    formData.append('file', {
      uri,
      name: 'photo.jpg',
      type: 'image/jpeg',
    } as any);

    try {
      const res = await apiClient.post('/api/diagnose', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
        timeout: 60000, // diagnoses can take ~10s w/ Gemini
      });
      router.replace({
        pathname: '/diagnosis/result',
        params: { data: JSON.stringify(res.data) },
      });
    } catch (err: any) {
      const detail = err.response?.data?.detail ?? 'Upload failed.';
      Alert.alert('Diagnosis failed', detail);
    } finally {
      setUploading(false);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Ready to analyze?</Text>

      <Image source={{ uri }} style={styles.preview} resizeMode="cover" />

      <Text style={styles.help}>
        Make sure the diseased part is clearly visible.
      </Text>

      <View style={styles.buttonRow}>
        <TouchableOpacity
          style={[styles.btn, styles.secondaryBtn]}
          onPress={() => router.back()}
          disabled={uploading}
        >
          <Text style={styles.secondaryText}>Retake</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.btn, styles.primaryBtn, uploading && { opacity: 0.6 }]}
          onPress={handleAnalyze}
          disabled={uploading}
        >
          {uploading ? (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <ActivityIndicator color="white" />
              <Text style={styles.primaryText}>Analyzing…</Text>
            </View>
          ) : (
            <Text style={styles.primaryText}>Analyze</Text>
          )}
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 24, paddingTop: 60, backgroundColor: '#f8fafc' },
  title: { fontSize: 22, fontWeight: '800', color: '#0f172a', marginBottom: 16 },
  preview: { width: '100%', height: 320, borderRadius: 12, backgroundColor: '#e2e8f0' },
  help: { color: '#64748b', marginTop: 12, fontSize: 13 },
  buttonRow: { flexDirection: 'row', gap: 12, marginTop: 24 },
  btn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 8,
    alignItems: 'center',
  },
  primaryBtn: { backgroundColor: '#16a34a' },
  secondaryBtn: {
    backgroundColor: 'white',
    borderWidth: 1,
    borderColor: '#cbd5e1',
  },
  primaryText: { color: 'white', fontWeight: '700', fontSize: 16 },
  secondaryText: { color: '#334155', fontWeight: '700', fontSize: 16 },
});