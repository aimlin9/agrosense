import { useState } from 'react';
import { Pressable, View } from 'react-native';

import { apiClient, getErrorMessage } from '@/api/client';
import type { Farmer } from '@/api/types';
import { AuthShell } from '@/components/AuthShell';
import { Button } from '@/components/ui/Button';
import { Banner } from '@/components/ui/Layout';
import { SelectField, SelectSheet } from '@/components/ui/SelectSheet';
import { Text } from '@/components/ui/Text';
import { PhoneField, TextField, toApiPhone, validatePhone } from '@/components/ui/TextField';
import { CROP_OPTIONS, REGION_OPTIONS } from '@/constants/options';
import { colors, spacing } from '@/constants/theme';
import { firstName } from '@/lib/format';
import { useAuthStore } from '@/store/authStore';

export default function CompleteProfileScreen() {
  const farmer = useAuthStore((s) => s.farmer);
  const setFarmer = useAuthStore((s) => s.setFarmer);
  const logout = useAuthStore((s) => s.logout);

  const [name, setName] = useState(farmer?.full_name ?? '');
  const [phone, setPhone] = useState('');
  const [region, setRegion] = useState<string | null>(farmer?.region ?? null);
  const [crop, setCrop] = useState<string | null>(farmer?.primary_crop ?? null);
  const [sheet, setSheet] = useState<'region' | 'crop' | null>(null);
  const [errors, setErrors] = useState<{ name?: string | null; phone?: string | null; form?: string | null }>({});
  const [saving, setSaving] = useState(false);

  const submit = async () => {
    const next = {
      name: name.trim() ? null : 'Tell us your name.',
      phone: validatePhone(phone),
    };
    setErrors(next);
    if (next.name || next.phone) return;
    setSaving(true);
    try {
      const { data } = await apiClient.patch<Farmer>('/api/auth/me/complete-profile', {
        phone_number: toApiPhone(phone),
        full_name: name.trim(),
        region: region ?? undefined,
        primary_crop: crop ?? undefined,
      });
      setFarmer(data); // root layout routes to the app once profile_complete is true
    } catch (err) {
      setErrors({ form: getErrorMessage(err, 'Couldn’t save your details. Please try again.') });
    } finally {
      setSaving(false);
    }
  };

  const hello = firstName(farmer?.full_name);

  return (
    <AuthShell
      title={hello ? `Almost there, ${hello}` : 'Almost there'}
      subtitle="Add your phone number so you can also use AgroSense by SMS, and so we can tailor advice to your farm."
      footer={
        <Pressable onPress={logout} style={{ alignItems: 'center', marginTop: spacing.xxl }} accessibilityRole="button">
          <Text variant="bodyStrong" color={colors.inkSoft}>
            Use a different account
          </Text>
        </Pressable>
      }
    >
      <View style={{ gap: spacing.lg }}>
        {errors.form ? <Banner tone="danger" message={errors.form} /> : null}
        <TextField label="Full name" value={name} onChangeText={setName} error={errors.name} autoCapitalize="words" />
        <PhoneField label="Phone number" value={phone} onChangeText={setPhone} error={errors.phone} />
        <SelectField label="Region" value={region} onPress={() => setSheet('region')} placeholder="Choose your region" />
        <SelectField label="Main crop" value={crop} onPress={() => setSheet('crop')} placeholder="What do you grow most?" />
        <Button label="Continue" onPress={submit} loading={saving} style={{ marginTop: spacing.sm }} />
      </View>

      <SelectSheet visible={sheet === 'region'} title="Your region" options={REGION_OPTIONS} value={region} onSelect={setRegion} onClose={() => setSheet(null)} />
      <SelectSheet visible={sheet === 'crop'} title="Main crop" options={CROP_OPTIONS} value={crop} onSelect={setCrop} onClose={() => setSheet(null)} searchable />
    </AuthShell>
  );
}
