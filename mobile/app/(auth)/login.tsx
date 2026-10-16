import { Link } from 'expo-router';
import { useRef, useState } from 'react';
import { TextInput, View } from 'react-native';

import { getErrorMessage } from '@/api/client';
import { AuthShell, OrDivider } from '@/components/AuthShell';
import { GoogleSignInButton } from '@/components/GoogleSignInButton';
import { Button } from '@/components/ui/Button';
import { Banner } from '@/components/ui/Layout';
import { Text } from '@/components/ui/Text';
import { PhoneField, TextField, toApiPhone, validatePhone } from '@/components/ui/TextField';
import { colors, spacing } from '@/constants/theme';
import { GoogleSignInError, isGoogleSignInAvailable } from '@/services/googleAuth';
import { useAuthStore } from '@/store/authStore';

export default function LoginScreen() {
  const login = useAuthStore((s) => s.login);
  const loginWithGoogle = useAuthStore((s) => s.loginWithGoogle);
  const notice = useAuthStore((s) => s.notice);
  const clearNotice = useAuthStore((s) => s.clearNotice);

  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [errors, setErrors] = useState<{ phone?: string | null; password?: string | null; form?: string | null }>({});
  const [busy, setBusy] = useState<'phone' | 'google' | null>(null);
  const passwordRef = useRef<TextInput>(null);

  const submit = async () => {
    const phoneErr = validatePhone(phone);
    const passErr = password ? null : 'Enter your password.';
    setErrors({ phone: phoneErr, password: passErr });
    if (phoneErr || passErr) return;
    setBusy('phone');
    clearNotice();
    try {
      // Navigation happens in the root layout once the token is set.
      await login(toApiPhone(phone), password);
    } catch (err) {
      setErrors({ form: getErrorMessage(err, 'Couldn’t sign you in. Please try again.') });
    } finally {
      setBusy(null);
    }
  };

  const google = async () => {
    setBusy('google');
    setErrors({});
    clearNotice();
    try {
      await loginWithGoogle();
    } catch (err) {
      if (!(err instanceof GoogleSignInError && err.code === 'CANCELLED')) {
        setErrors({ form: err instanceof Error ? err.message : 'Google sign-in failed.' });
      }
    } finally {
      setBusy(null);
    }
  };

  return (
    <AuthShell
      title="Welcome back"
      subtitle="Sign in to check your crops, the weather and today’s market prices."
      footer={
        <View style={{ flexDirection: 'row', justifyContent: 'center', gap: 6, marginTop: spacing.xxl }}>
          <Text variant="body" color={colors.inkSoft}>
            New to AgroSense?
          </Text>
          <Link href="/(auth)/register" replace accessibilityRole="link">
            <Text variant="bodyStrong" color={colors.brand}>
              Create an account
            </Text>
          </Link>
        </View>
      }
    >
      <View style={{ gap: spacing.lg }}>
        {notice ? <Banner tone="warning" title={notice.title} message={notice.message} /> : null}
        {errors.form ? <Banner tone="danger" message={errors.form} /> : null}

        <PhoneField
          label="Phone number"
          value={phone}
          onChangeText={(t) => {
            setPhone(t);
            if (errors.phone) setErrors((e) => ({ ...e, phone: null }));
          }}
          error={errors.phone}
          returnKeyType="next"
          onSubmitEditing={() => passwordRef.current?.focus()}
        />
        <TextField
          ref={passwordRef}
          label="Password"
          value={password}
          onChangeText={(t) => {
            setPassword(t);
            if (errors.password) setErrors((e) => ({ ...e, password: null }));
          }}
          error={errors.password}
          secureToggle
          autoCapitalize="none"
          autoComplete="current-password"
          textContentType="password"
          returnKeyType="go"
          onSubmitEditing={submit}
          placeholder="Your password"
        />
        <Button label="Sign in" onPress={submit} loading={busy === 'phone'} disabled={!!busy} style={{ marginTop: spacing.sm }} />
      </View>

      {isGoogleSignInAvailable() ? (
        <>
          <OrDivider />
          <GoogleSignInButton onPress={google} loading={busy === 'google'} disabled={!!busy} />
        </>
      ) : null}
    </AuthShell>
  );
}
