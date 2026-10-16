import { useQueryClient } from '@tanstack/react-query';
import * as Location from 'expo-location';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { apiClient, getErrorMessage } from '@/api/client';
import type { Farmer } from '@/api/types';
import { Button } from '@/components/ui/Button';
import { StackHeader } from '@/components/ui/Header';
import { Banner, Card, SectionHeader } from '@/components/ui/Layout';
import { SelectField, SelectSheet } from '@/components/ui/SelectSheet';
import { Text } from '@/components/ui/Text';
import { TextField } from '@/components/ui/TextField';
import { CROP_OPTIONS, LANGUAGE_OPTIONS, REGION_OPTIONS } from '@/constants/options';
import { colors, spacing } from '@/constants/theme';
import { formatPhone } from '@/lib/format';
import { useAuthStore } from '@/store/authStore';

type Sheet = 'region' | 'crop' | 'language' | null;

export default function EditProfileScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const queryClient = useQueryClient();
  const farmer = useAuthStore((s) => s.farmer);
  const setFarmer = useAuthStore((s) => s.setFarmer);

  const [name, setName] = useState(farmer?.full_name ?? '');
  const [email, setEmail] = useState(farmer?.email ?? '');
  const [region, setRegion] = useState<string | null>(farmer?.region ?? null);
  const [district, setDistrict] = useState(farmer?.district ?? '');
  const [crop, setCrop] = useState<string | null>(farmer?.primary_crop ?? null);
  const [language, setLanguage] = useState(farmer?.preferred_language ?? 'en');
  const [gps, setGps] = useState<{ lat: number; lng: number } | null>(
    farmer?.gps_lat != null && farmer?.gps_lng != null ? { lat: farmer.gps_lat, lng: farmer.gps_lng } : null,
  );
  const [sheet, setSheet] = useState<Sheet>(null);
  const [locating, setLocating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<{ name?: string | null; email?: string | null; form?: string | null; gps?: string | null }>({});

  const locate = async () => {
    setLocating(true);
    setErrors((e) => ({ ...e, gps: null }));
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        setErrors((e) => ({ ...e, gps: 'Location permission is off. Enable it in settings to save your farm location.' }));
        return;
      }
      const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
      setGps({ lat: pos.coords.latitude, lng: pos.coords.longitude });
    } catch {
      setErrors((e) => ({ ...e, gps: 'Couldn’t get a GPS fix. Try again outdoors.' }));
    } finally {
      setLocating(false);
    }
  };

  const save = async () => {
    const next = {
      name: name.trim() ? null : 'Your name can’t be empty.',
      email: !email.trim() || /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email.trim()) ? null : 'Enter a valid email address.',
    };
    setErrors(next);
    if (next.name || next.email) return;
    setSaving(true);
    try {
      const { data } = await apiClient.patch<Farmer>('/api/auth/me', {
        full_name: name.trim(),
        email: email.trim() || null,
        region,
        district: district.trim() || null,
        primary_crop: crop,
        preferred_language: language,
        ...(gps ? { gps_lat: gps.lat, gps_lng: gps.lng } : {}),
      });
      setFarmer(data);
      // Crop and location drive advice and prices; refresh them.
      queryClient.invalidateQueries({ queryKey: ['advisory'] });
      router.back();
    } catch (err) {
      setErrors({ form: getErrorMessage(err, 'Couldn’t save your changes.') });
    } finally {
      setSaving(false);
    }
  };

  const regionLabel = region;
  const cropLabel = CROP_OPTIONS.find((o) => o.value === crop)?.label ?? crop;
  const langLabel = LANGUAGE_OPTIONS.find((o) => o.value === language)?.label ?? 'English';

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: colors.canvas }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <StackHeader title="Profile & farm" />
      <ScrollView
        contentContainerStyle={{ paddingHorizontal: spacing.gutter, paddingBottom: insets.bottom + spacing.xxxl }}
        keyboardShouldPersistTaps="handled"
      >
        {errors.form ? <Banner tone="danger" message={errors.form} /> : null}

        <SectionHeader title="About you" style={{ marginTop: spacing.md }} />
        <View style={{ gap: spacing.lg }}>
          <TextField label="Full name" value={name} onChangeText={setName} error={errors.name} autoCapitalize="words" />
          <TextField
            label="Email (optional)"
            value={email}
            onChangeText={setEmail}
            error={errors.email}
            keyboardType="email-address"
            autoCapitalize="none"
            autoComplete="email"
            placeholder="you@example.com"
          />
          {farmer?.phone_number ? (
            <View style={{ gap: 4 }}>
              <Text variant="smallStrong" color={colors.inkSoft}>
                Phone number
              </Text>
              <Text variant="body">{formatPhone(farmer.phone_number)}</Text>
              <Text variant="caption" color={colors.inkMuted}>
                Your phone number is how you sign in, so it can’t be changed here.
              </Text>
            </View>
          ) : null}
        </View>

        <SectionHeader title="Your farm" />
        <View style={{ gap: spacing.lg }}>
          <SelectField label="Region" value={regionLabel} onPress={() => setSheet('region')} placeholder="Choose your region" />
          <TextField label="District or town" value={district} onChangeText={setDistrict} placeholder="e.g. Ejura-Sekyedumase" autoCapitalize="words" />
          <SelectField label="Main crop" value={cropLabel} onPress={() => setSheet('crop')} placeholder="What do you grow most?" />
          <Card>
            <Text variant="bodyStrong">Farm location</Text>
            <Text variant="small" color={colors.inkMuted} style={{ marginTop: 2, marginBottom: spacing.md }}>
              {gps
                ? `Saved: ${gps.lat.toFixed(4)}, ${gps.lng.toFixed(4)}`
                : 'Stand on your farm and tap below. Weather advice will use this spot.'}
            </Text>
            {errors.gps ? (
              <Text variant="caption" color={colors.danger} style={{ marginBottom: spacing.sm }}>
                {errors.gps}
              </Text>
            ) : null}
            <Button
              label={gps ? 'Update to my current location' : 'Use my current location'}
              icon="map-pin"
              variant="secondary"
              size="md"
              loading={locating}
              onPress={locate}
            />
          </Card>
        </View>

        <SectionHeader title="Preferences" />
        <SelectField label="Language" value={langLabel} onPress={() => setSheet('language')} />

        <Button label="Save changes" onPress={save} loading={saving} style={{ marginTop: spacing.xxl }} />
      </ScrollView>

      <SelectSheet visible={sheet === 'region'} title="Your region" options={REGION_OPTIONS} value={region} onSelect={setRegion} onClose={() => setSheet(null)} />
      <SelectSheet visible={sheet === 'crop'} title="Main crop" options={CROP_OPTIONS} value={crop} onSelect={setCrop} onClose={() => setSheet(null)} searchable />
      <SelectSheet visible={sheet === 'language'} title="Language" options={LANGUAGE_OPTIONS} value={language} onSelect={setLanguage} onClose={() => setSheet(null)} />
    </KeyboardAvoidingView>
  );
}
