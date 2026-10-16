import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Alert, KeyboardAvoidingView, Platform, ScrollView, View } from 'react-native';

import { apiClient, getErrorMessage } from '@/api/client';
import { Button } from '@/components/ui/Button';
import { StackHeader } from '@/components/ui/Header';
import { Banner } from '@/components/ui/Layout';
import { Text } from '@/components/ui/Text';
import { TextField } from '@/components/ui/TextField';
import { colors, spacing } from '@/constants/theme';
import { useAuthStore } from '@/store/authStore';

export default function PasswordScreen() {
  const router = useRouter();
  const farmer = useAuthStore((s) => s.farmer);
  const setToken = useAuthStore((s) => s.setToken);
  const hasPassword = farmer?.auth_provider !== 'google';

  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');
  const [errors, setErrors] = useState<{ current?: string | null; next?: string | null; confirm?: string | null; form?: string | null }>({});
  const [saving, setSaving] = useState(false);

  const save = async () => {
    const e = {
      current: hasPassword && !current ? 'Enter your current password.' : null,
      next: next.length >= 8 ? null : 'Use at least 8 characters.',
      confirm: confirm === next ? null : 'Passwords don’t match.',
    };
    setErrors(e);
    if (e.current || e.next || e.confirm) return;
    setSaving(true);
    try {
      const { data } = await apiClient.post<{ access_token: string }>('/api/auth/me/password', {
        current_password: hasPassword ? current : null,
        new_password: next,
      });
      await setToken(data.access_token); // other devices are signed out
      Alert.alert('Password updated', 'Use your new password next time you sign in.');
      router.back();
    } catch (err) {
      setErrors({ form: getErrorMessage(err, 'Couldn’t update your password.') });
    } finally {
      setSaving(false);
    }
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: colors.canvas }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <StackHeader title={hasPassword ? 'Change password' : 'Set a password'} />
      <ScrollView contentContainerStyle={{ padding: spacing.gutter, gap: spacing.lg }} keyboardShouldPersistTaps="handled">
        <Text variant="body" color={colors.inkSoft}>
          {hasPassword
            ? 'For your security, other phones signed in to your account will be signed out.'
            : 'Add a password so you can also sign in with your phone number.'}
        </Text>
        {errors.form ? <Banner tone="danger" message={errors.form} /> : null}
        <View style={{ gap: spacing.lg }}>
          {hasPassword ? (
            <TextField label="Current password" value={current} onChangeText={setCurrent} error={errors.current} secureToggle autoCapitalize="none" autoComplete="current-password" textContentType="password" />
          ) : null}
          <TextField label="New password" value={next} onChangeText={setNext} error={errors.next} secureToggle autoCapitalize="none" autoComplete="new-password" textContentType="newPassword" placeholder="At least 8 characters" />
          <TextField label="Confirm new password" value={confirm} onChangeText={setConfirm} error={errors.confirm} secureToggle autoCapitalize="none" textContentType="newPassword" />
        </View>
        <Button label="Save password" onPress={save} loading={saving} style={{ marginTop: spacing.sm }} />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
