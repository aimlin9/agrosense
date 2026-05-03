import * as ImagePicker from 'expo-image-picker';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import {
  Alert,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

import { CropSelector } from '@/components/CropSelector';

export default function DiagnoseScreen() {
  const router = useRouter();
  const [cropId, setCropId] = useState<string | null>(null);

  const handleCamera = async () => {
    if (!cropId) {
      Alert.alert('Pick a crop first', 'Tap a crop chip above.');
      return;
    }
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (!perm.granted) {
      Alert.alert('Camera permission needed', 'Enable camera in your settings.');
      return;
    }
    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.8,
    });
    if (!result.canceled && result.assets[0]) {
      router.push({
        pathname: '/diagnosis/confirm',
        params: { uri: result.assets[0].uri, cropId },
      });
    }
  };

  const handleGallery = async () => {
    if (!cropId) {
      Alert.alert('Pick a crop first', 'Tap a crop chip above.');
      return;
    }
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      Alert.alert('Gallery permission needed', 'Enable photo access in settings.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.8,
    });
    if (!result.canceled && result.assets[0]) {
      router.push({
        pathname: '/diagnosis/confirm',
        params: { uri: result.assets[0].uri, cropId },
      });
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Diagnose a plant</Text>
      <Text style={styles.subtitle}>Step 1: Which crop is it?</Text>

      <View style={styles.cropBox}>
        <CropSelector value={cropId} onChange={setCropId} />
      </View>

      <Text style={styles.subtitle}>Step 2: How would you like to send a photo?</Text>

      <TouchableOpacity style={styles.actionBtn} onPress={handleCamera}>
        <Text style={styles.actionEmoji}>📸</Text>
        <View style={{ flex: 1 }}>
          <Text style={styles.actionTitle}>Take a photo</Text>
          <Text style={styles.actionSubtitle}>Use your camera now</Text>
        </View>
      </TouchableOpacity>

      <TouchableOpacity style={styles.actionBtn} onPress={handleGallery}>
        <Text style={styles.actionEmoji}>🖼️</Text>
        <View style={{ flex: 1 }}>
          <Text style={styles.actionTitle}>Choose from gallery</Text>
          <Text style={styles.actionSubtitle}>Pick an existing photo</Text>
        </View>
      </TouchableOpacity>

      <Text style={styles.tip}>
        💡 Tip: hold the camera close. Good light. One leaf in focus.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 24, paddingTop: 60, backgroundColor: '#f8fafc' },
  title: { fontSize: 24, fontWeight: '800', color: '#15803d' },
  subtitle: { fontSize: 13, fontWeight: '600', color: '#64748b', marginTop: 16, marginBottom: 8 },
  cropBox: { marginHorizontal: -24, paddingHorizontal: 24 },
  actionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'white',
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    marginBottom: 12,
    gap: 12,
  },
  actionEmoji: { fontSize: 32 },
  actionTitle: { fontSize: 16, fontWeight: '700', color: '#0f172a' },
  actionSubtitle: { fontSize: 12, color: '#64748b', marginTop: 2 },
  tip: {
    marginTop: 24,
    color: '#64748b',
    fontSize: 13,
    lineHeight: 18,
    backgroundColor: '#f1f5f9',
    padding: 12,
    borderRadius: 8,
  },
});