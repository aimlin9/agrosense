import { Feather } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';

import { apiClient } from '@/api/client';
import { colors, fonts, radius, spacing } from '@/constants/theme';
import { useAuthStore } from '@/store/authStore';

export default function CompleteProfileScreen() {
  const router = useRouter();
  const { farmer } = useAuthStore();

  const [phone, setPhone] = useState('');
  const [region, setRegion] = useState('');
  const [primaryCrop, setPrimaryCrop] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const firstName = farmer?.full_name?.split(' ')[0] ?? 'there';

  const handleSubmit = async () => {
    if (!phone.trim()) {
      Alert.alert('Phone required', 'We need your phone number for SMS support and account security.');
      return;
    }
    setSubmitting(true);
    try {
      await apiClient.patch('/api/auth/me/complete-profile', {
        phone_number: phone.trim(),
        region: region.trim() || undefined,
        primary_crop: primaryCrop.trim() || undefined,
      });
      // Refresh farmer data
      const meRes = await apiClient.get('/api/auth/me');
      useAuthStore.setState({ farmer: meRes.data });
      router.replace('/(tabs)');
    } catch (err: any) {
      const msg = err.response?.data?.detail ?? 'Could not save profile.';
      Alert.alert('Could not save', msg);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <View style={styles.iconCircle}>
          <Feather name="user" size={32} color={colors.primaryDark} />
        </View>

        <Text style={styles.title}>One more step, {firstName}</Text>
        <Text style={styles.subtitle}>
          We need a few details so AgroSense can give you personalized advice and SMS support.
        </Text>

        <View style={styles.form}>
          <Text style={styles.label}>Phone number *</Text>
          <TextInput
            style={styles.input}
            placeholder="+233244123456"
            keyboardType="phone-pad"
            autoCapitalize="none"
            value={phone}
            onChangeText={setPhone}
          />
          <Text style={styles.helper}>
            Used for SMS diagnosis when you don't have internet.
          </Text>

          <Text style={styles.label}>Region</Text>
          <TextInput
            style={styles.input}
            placeholder="Ashanti, Greater Accra, Northern…"
            value={region}
            onChangeText={setRegion}
          />

          <Text style={styles.label}>Primary crop</Text>
          <TextInput
            style={styles.input}
            placeholder="Maize, Tomato, Cassava…"
            value={primaryCrop}
            onChangeText={setPrimaryCrop}
          />

          <TouchableOpacity
            style={[styles.button, submitting && styles.buttonDisabled]}
            onPress={handleSubmit}
            disabled={submitting}
            activeOpacity={0.85}
          >
            <Text style={styles.buttonText}>
              {submitting ? 'Saving…' : 'Continue to AgroSense'}
            </Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.xl, paddingTop: 80 },
  iconCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.lg,
  },
  title: {
    fontSize: 26,
    fontFamily: fonts.display,
    color: colors.textPrimary,
    letterSpacing: -0.5,
  },
  subtitle: {
    fontSize: 14,
    fontFamily: fonts.regular,
    color: colors.textSecondary,
    marginTop: spacing.sm,
    marginBottom: spacing.xl,
    lineHeight: 20,
  },
  form: {},
  label: {
    fontSize: 13,
    fontFamily: fonts.semibold,
    color: colors.textSecondary,
    marginTop: spacing.lg,
    marginBottom: spacing.xs,
  },
  input: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    fontSize: 16,
    fontFamily: fonts.regular,
    color: colors.textPrimary,
  },
  helper: {
    fontSize: 12,
    fontFamily: fonts.regular,
    color: colors.textTertiary,
    marginTop: spacing.xs,
  },
  button: {
    backgroundColor: colors.primary,
    borderRadius: radius.md,
    paddingVertical: spacing.lg,
    alignItems: 'center',
    marginTop: spacing.xxl,
  },
  buttonDisabled: { opacity: 0.6 },
  buttonText: {
    color: 'white',
    fontFamily: fonts.bold,
    fontSize: 16,
    letterSpacing: -0.2,
  },
});