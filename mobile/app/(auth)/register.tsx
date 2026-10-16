import { Link } from 'expo-router';
import { useRef, useState } from 'react';
import { TextInput, View } from 'react-native';

import { getErrorMessage } from '@/api/client';
import { AuthShell, OrDivider } from '@/components/AuthShell';
import { GoogleSignInButton } from '@/components/GoogleSignInButton';
import { Button } from '@/components/ui/Button';
import { Banner } from '@/components/ui/Layout';
import { SelectField, SelectSheet } from '@/components/ui/SelectSheet';
import { Text } from '@/components/ui/Text';
import { PhoneField, TextField, toApiPhone, validatePhone } from '@/components/ui/TextField';
import { CROP_OPTIONS, REGION_OPTIONS } from '@/constants/options';
import { colors, spacing } from '@/constants/theme';
import { GoogleSignInError, isGoogleSignInAvailable } from '@/services/googleAuth';
import { useAuthStore } from '@/store/authStore';

type Errors = Partial<Record<'name' | 'phone' | 'password' | 'form', string | null>>;

export default function RegisterScreen() {
  const register = useAuthStore((s) => s.register);
  const loginWithGoogle = useAuthStore((s) => s.loginWithGoogle);

  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [region, setRegion] = useState<string | null>(null);
  const [crop, setCrop] = useState<string | null>(null);
  const [sheet, setSheet] = useState<'region' | 'crop' | null>(null);
  const [errors, setErrors] = useState<Errors>({});
  const [busy, setBusy] = useState<'phone' | 'google' | null>(null);

  const phoneRef = useRef<TextInput>(null);
  const passwordRef = useRef<TextInput>(null);

  const submit = async () => {
    const next: Errors = {
      name: name.trim() ? null : 'Tell us your name.',
      phone: validatePhone(phone),
      password: password.length >= 8 ? null : 'Use at least 8 characters.',
    };
    setErrors(next);
    if (next.name || next.phone || next.password) return;
    setBusy('phone');
    try {
      await register({
        full_name: name.trim(),
        phone_number: toApiPhone(phone),
        password,
        region: region ?? undefined,
        primary_crop: crop ?? undefined,
      });
    } catch (err) {
      setErrors({ form: getErrorMessage(err, 'Couldn’t create your account. Please try again.') });
    } finally {
      setBusy(null);
    }
  };

  const google = async () => {
    setBusy('google');
    setErrors({});
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
      title="Create your account"
      subtitle="Free for farmers. It takes less than a minute."
      footer={
        <View style={{ flexDirection: 'row', justifyContent: 'center', gap: 6, marginTop: spacing.xxl }}>
          <Text variant="body" color={colors.inkSoft}>
            Already have an account?
          </Text>
          <Link href="/(auth)/login" replace accessibilityRole="link">
            <Text variant="bodyStrong" color={colors.brand}>
              Sign in
            </Text>
          </Link>
        </View>
      }
    >
      {isGoogleSignInAvailable() ? (
        <>
          <GoogleSignInButton label="Sign up with Google" onPress={google} loading={busy === 'google'} disabled={!!busy} />
          <OrDivider />
        </>
      ) : null}

      <View style={{ gap: spacing.lg }}>
        {errors.form ? <Banner tone="danger" message={errors.form} /> : null}
        <TextField
          label="Full name"
          value={name}
          onChangeText={setName}
          error={errors.name}
          placeholder="e.g. Ama Mensah"
          autoCapitalize="words"
          autoComplete="name"
          textContentType="name"
          returnKeyType="next"
          onSubmitEditing={() => phoneRef.current?.focus()}
        />
        <PhoneField
          ref={phoneRef}
          label="Phone number"
          value={phone}
          onChangeText={setPhone}
          error={errors.phone}
          hint="You’ll sign in with this number. It also works for SMS."
          returnKeyType="next"
          onSubmitEditing={() => passwordRef.current?.focus()}
        />
        <TextField
          ref={passwordRef}
          label="Password"
          value={password}
          onChangeText={setPassword}
          error={errors.password}
          placeholder="At least 8 characters"
          secureToggle
          autoCapitalize="none"
          autoComplete="new-password"
          textContentType="newPassword"
        />
        <SelectField label="Region (optional)" value={region} onPress={() => setSheet('region')} placeholder="Choose your region" />
        <SelectField label="Main crop (optional)" value={crop} onPress={() => setSheet('crop')} placeholder="What do you grow most?" />
        <Button label="Create account" onPress={submit} loading={busy === 'phone'} disabled={!!busy} style={{ marginTop: spacing.sm }} />
      </View>

      <SelectSheet
        visible={sheet === 'region'}
        title="Your region"
        options={REGION_OPTIONS}
        value={region}
        onSelect={setRegion}
        onClose={() => setSheet(null)}
      />
      <SelectSheet
        visible={sheet === 'crop'}
        title="Main crop"
        options={CROP_OPTIONS}
        value={crop}
        onSelect={setCrop}
        onClose={() => setSheet(null)}
        searchable
      />
    </AuthShell>
  );
}
