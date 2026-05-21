import { Link, useRouter } from 'expo-router';
import { useState } from 'react';
import { Feather } from '@expo/vector-icons';
import {
  Alert,
  KeyboardAvoidingView,
  Linking,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { GoogleSignInButton } from '@/components/GoogleSignInButton';
import { useAuthStore } from '@/store/authStore';

const GHANA_REGIONS = [
  'Ahafo', 'Ashanti', 'Bono', 'Bono East', 'Central', 'Eastern',
  'Greater Accra', 'North East', 'Northern', 'Oti', 'Savannah',
  'Upper East', 'Upper West', 'Volta', 'Western', 'Western North',
];

const CROPS = [
  'Apple', 'Blueberry', 'Cherry (including sour)', 'Corn (maize)',
  'Grape', 'Orange', 'Peach', 'Pepper, bell', 'Potato', 'Raspberry',
  'Soybean', 'Squash', 'Strawberry', 'Tomato',
];

const PRIVACY_URL = 'https://aimlin9.github.io/agrosense/legal/privacy.html';
const TERMS_URL = 'https://aimlin9.github.io/agrosense/legal/terms.html';

export default function RegisterScreen() {
  const router = useRouter();
  const { register, isLoading } = useAuthStore();

  const [phone, setPhone] = useState('');
  const [fullName, setFullName] = useState('');
  const [password, setPassword] = useState('');
  const [region, setRegion] = useState('');
  const [primaryCrop, setPrimaryCrop] = useState('');

  const pickFromList = (
    title: string,
    options: string[],
    onSelect: (value: string) => void,
  ) => {
    Alert.alert(
      title,
      undefined,
      [
        ...options.map((opt) => ({ text: opt, onPress: () => onSelect(opt) })),
        { text: 'Cancel', style: 'cancel' as const },
      ],
      { cancelable: true },
    );
  };

  const handleRegister = async () => {
    if (!phone || !password) {
      Alert.alert('Missing info', 'Phone and password are required.');
      return;
    }
    if (password.length < 8) {
      Alert.alert('Password too short', 'Use at least 8 characters.');
      return;
    }
    try {
      await register({
        phone_number: phone,
        password,
        full_name: fullName || undefined,
        region: region || undefined,
        primary_crop: primaryCrop || undefined,
      });
      router.replace('/(tabs)');
    } catch (err: any) {
      const msg = err.response?.data?.detail ?? 'Registration failed.';
      Alert.alert('Registration failed', msg);
    }
  };

  const handleGoogleSignIn = async () => {
    try {
      const { profileComplete } = await useAuthStore.getState().loginWithGoogle();
      if (!profileComplete) {
        router.replace('/onboarding/complete-profile');
      } else {
        router.replace('/(tabs)');
      }
    } catch (err: any) {
      const msg = err?.code === 'CANCELLED' ? null : err?.message ?? 'Sign-in failed.';
      if (msg) Alert.alert('Sign-in failed', msg);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView contentContainerStyle={styles.inner}>
        <Text style={styles.logo}>Create account</Text>

        <GoogleSignInButton
          onPress={handleGoogleSignIn}
          loading={isLoading}
          label="Sign up with Google"
        />

        <View style={styles.dividerRow}>
          <View style={styles.dividerLine} />
          <Text style={styles.dividerText}>OR</Text>
          <View style={styles.dividerLine} />
        </View>

        <Text style={styles.label}>Phone number *</Text>
        <TextInput
          style={styles.input}
          placeholder="+233244123456"
          keyboardType="phone-pad"
          autoCapitalize="none"
          value={phone}
          onChangeText={setPhone}
        />

        <Text style={styles.label}>Full name</Text>
        <TextInput
          style={styles.input}
          placeholder="Kofi Mensah"
          value={fullName}
          onChangeText={setFullName}
        />

        <Text style={styles.label}>Password *</Text>
        <TextInput
          style={styles.input}
          placeholder="At least 8 characters"
          secureTextEntry
          value={password}
          onChangeText={setPassword}
        />

        <Text style={styles.label}>Region</Text>
        <TouchableOpacity
          style={styles.input}
          onPress={() => pickFromList('Choose your region', GHANA_REGIONS, setRegion)}
          activeOpacity={0.6}
        >
          <View style={styles.pickerRow}>
            <Text style={[styles.pickerText, !region && styles.pickerPlaceholder]}>
              {region || 'Tap to choose'}
            </Text>
            <Feather name="chevron-down" color="#94a3b8" size={18} />
          </View>
        </TouchableOpacity>

        <Text style={styles.label}>Primary crop</Text>
        <TouchableOpacity
          style={styles.input}
          onPress={() => pickFromList('Choose your primary crop', CROPS, setPrimaryCrop)}
          activeOpacity={0.6}
        >
          <View style={styles.pickerRow}>
            <Text style={[styles.pickerText, !primaryCrop && styles.pickerPlaceholder]}>
              {primaryCrop || 'Tap to choose'}
            </Text>
            <Feather name="chevron-down" color="#94a3b8" size={18} />
          </View>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.button, isLoading && styles.buttonDisabled]}
          onPress={handleRegister}
          disabled={isLoading}
        >
          <Text style={styles.buttonText}>
            {isLoading ? 'Creating…' : 'Create account'}
          </Text>
        </TouchableOpacity>

        <View style={styles.footer}>
          <Text style={styles.footerText}>Already have an account?</Text>
          <Link href="/(auth)/login" style={styles.link}>
            Sign in
          </Link>
        </View>

        <Text style={styles.disclaimer}>
          By continuing, you agree to our{' '}
          <Text
            style={styles.disclaimerLink}
            onPress={() => Linking.openURL(PRIVACY_URL)}
          >
            Privacy Policy
          </Text>
          {' '}and{' '}
          <Text
            style={styles.disclaimerLink}
            onPress={() => Linking.openURL(TERMS_URL)}
          >
            Terms of Service
          </Text>
          .
        </Text>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8fafc' },
  inner: { padding: 24, paddingTop: 60 },
  logo: { fontSize: 28, fontWeight: '800', color: '#15803d', marginBottom: 24 },
  label: { fontSize: 13, fontWeight: '600', color: '#334155', marginTop: 12 },
  input: {
    backgroundColor: 'white',
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
    marginTop: 4,
    minHeight: 46,
    justifyContent: 'center',
  },
  pickerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  pickerText: {
    fontSize: 16,
    color: '#0f172a',
    flex: 1,
  },
  pickerPlaceholder: {
    color: '#94a3b8',
  },
  button: {
    backgroundColor: '#16a34a',
    borderRadius: 8,
    paddingVertical: 14,
    marginTop: 24,
    alignItems: 'center',
  },
  buttonDisabled: { opacity: 0.6 },
  buttonText: { color: 'white', fontSize: 16, fontWeight: '700' },
  footer: { flexDirection: 'row', justifyContent: 'center', marginTop: 20, gap: 6 },
  footerText: { color: '#64748b' },
  link: { color: '#15803d', fontWeight: '700' },
  dividerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 20,
    gap: 12,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: '#e2e8f0',
  },
  dividerText: {
    fontSize: 12,
    color: '#94a3b8',
    fontWeight: '600',
  },
  disclaimer: {
    fontSize: 12,
    color: '#64748b',
    textAlign: 'center',
    marginTop: 20,
    marginBottom: 8,
    lineHeight: 18,
    paddingHorizontal: 16,
  },
  disclaimerLink: {
    color: '#15803d',
    fontWeight: '600',
    textDecorationLine: 'underline',
  },
});