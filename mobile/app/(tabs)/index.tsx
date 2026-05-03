import { useRouter } from 'expo-router';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import { useAuthStore } from '@/store/authStore';

export default function HomeScreen() {
  const router = useRouter();
  const { farmer, logout } = useAuthStore();

  return (
    <View style={styles.container}>
      <Text style={styles.greeting}>
        Hello, {farmer?.full_name || farmer?.phone_number?.slice(-4) || 'farmer'} 👋
      </Text>
      <Text style={styles.subtitle}>Ready to check your crops?</Text>

      <TouchableOpacity
        style={styles.bigCta}
        onPress={() => router.push('/(tabs)/diagnose')}
      >
        <Text style={styles.bigCtaEmoji}>📷</Text>
        <Text style={styles.bigCtaTitle}>Diagnose a sick plant</Text>
        <Text style={styles.bigCtaSubtitle}>Tap to take or upload a photo</Text>
      </TouchableOpacity>

      <View style={styles.shortcutsRow}>
        <TouchableOpacity
          style={styles.shortcut}
          onPress={() => router.push('/(tabs)/prices')}
        >
          <Text style={styles.shortcutEmoji}>💰</Text>
          <Text style={styles.shortcutLabel}>Prices</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.shortcut}
          onPress={() => router.push('/(tabs)/weather')}
        >
          <Text style={styles.shortcutEmoji}>☀️</Text>
          <Text style={styles.shortcutLabel}>Weather</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.shortcut}
          onPress={() => router.push('/(tabs)/history')}
        >
          <Text style={styles.shortcutEmoji}>📋</Text>
          <Text style={styles.shortcutLabel}>History</Text>
        </TouchableOpacity>
      </View>

      <View style={{ flex: 1 }} />

      <TouchableOpacity style={styles.logoutBtn} onPress={logout}>
        <Text style={styles.logoutText}>Log out</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 24, paddingTop: 60, backgroundColor: '#f8fafc' },
  greeting: { fontSize: 26, fontWeight: '800', color: '#15803d' },
  subtitle: { fontSize: 14, color: '#64748b', marginTop: 4, marginBottom: 24 },
  bigCta: {
    backgroundColor: '#16a34a',
    borderRadius: 16,
    padding: 24,
    alignItems: 'center',
    shadowColor: '#16a34a',
    shadowOpacity: 0.25,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
  },
  bigCtaEmoji: { fontSize: 48 },
  bigCtaTitle: { fontSize: 20, fontWeight: '800', color: 'white', marginTop: 8 },
  bigCtaSubtitle: { fontSize: 13, color: '#dcfce7', marginTop: 4 },
  shortcutsRow: { flexDirection: 'row', gap: 12, marginTop: 20 },
  shortcut: {
    flex: 1,
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  shortcutEmoji: { fontSize: 28 },
  shortcutLabel: { fontSize: 13, fontWeight: '600', color: '#334155', marginTop: 4 },
  logoutBtn: {
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 20,
  },
  logoutText: { color: '#94a3b8', fontWeight: '600' },
});