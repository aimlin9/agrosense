import { Link, useRouter } from 'expo-router';
import { useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';

import { useAuthStore } from '@/store/authStore';
import { GoogleSignInButton } from '@/components/GoogleSignInButton';

export default function LoginScreen() {
  const router = useRouter();
  const { login, isLoading } = useAuthStore();
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');

  const handleLogin = async () => {
    if (!phone || !password) {
      Alert.alert('Missing info', 'Please enter your phone and password.');
      return;
    }
    try {
      await login(phone, password);
      router.replace('/(tabs)');
    } catch (err: any) {
      const msg = err.response?.data?.detail ?? 'Login failed. Check your credentials.';
      Alert.alert('Login failed', msg);
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
      <View style={styles.inner}>
        <Text style={styles.logo}>🌱 AgroSense</Text>
        <Text style={styles.subtitle}>AI crop advisor for your farm</Text>

        <View style={styles.form}>
          <GoogleSignInButton
            onPress={handleGoogleSignIn}
            loading={isLoading}
          />

          <View style={styles.dividerRow}>
            <View style={styles.dividerLine} />
            <Text style={styles.dividerText}>OR</Text>
            <View style={styles.dividerLine} />
          </View>

          <Text style={styles.label}>Phone number</Text>
          <TextInput
            style={styles.input}
            placeholder="+233244123456"
            keyboardType="phone-pad"
            autoCapitalize="none"
            value={phone}
            onChangeText={setPhone}
          />

          <Text style={styles.label}>Password</Text>
          <TextInput
            style={styles.input}
            placeholder="At least 8 characters"
            secureTextEntry
            value={password}
            onChangeText={setPassword}
          />

          <TouchableOpacity
            style={[styles.button, isLoading && styles.buttonDisabled]}
            onPress={handleLogin}
            disabled={isLoading}
          >
            <Text style={styles.buttonText}>
              {isLoading ? 'Signing in…' : 'Sign in'}
            </Text>
          </TouchableOpacity>

          <View style={styles.footer}>
            <Text style={styles.footerText}>New to AgroSense?</Text>
            <Link href="/(auth)/register" style={styles.link}>
              Create an account
            </Link>
          </View>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8fafc' },
  inner: { flex: 1, justifyContent: 'center', padding: 24 },
  logo: { fontSize: 40, fontWeight: '800', textAlign: 'center', color: '#15803d' },
  subtitle: { fontSize: 14, textAlign: 'center', color: '#64748b', marginTop: 4, marginBottom: 32 },
  form: { gap: 8 },
  label: { fontSize: 13, fontWeight: '600', color: '#334155', marginTop: 12 },
  input: {
    backgroundColor: 'white',
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
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
});