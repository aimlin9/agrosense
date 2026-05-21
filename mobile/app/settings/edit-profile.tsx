import { useState } from 'react';
import { Stack, useRouter } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import * as Location from 'expo-location';
import {
  ActivityIndicator,
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
import { colors, fonts, radius, shadows, spacing } from '@/constants/theme';
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

const LANGUAGES: Array<{ code: 'en' | 'tw' | 'ha'; label: string }> = [
  { code: 'en', label: 'English' },
  { code: 'tw', label: 'Twi' },
  { code: 'ha', label: 'Hausa' },
];

export default function EditProfileScreen() {
  const router = useRouter();
  const farmer = useAuthStore((s) => s.farmer);

  const [fullName, setFullName] = useState(farmer?.full_name ?? '');
  const [email, setEmail] = useState(farmer?.email ?? '');
  const [region, setRegion] = useState(farmer?.region ?? '');
  const [district, setDistrict] = useState(farmer?.district ?? '');
  const [primaryCrop, setPrimaryCrop] = useState(farmer?.primary_crop ?? '');
  const [language, setLanguage] = useState<'en' | 'tw' | 'ha'>(
    (farmer?.preferred_language as any) ?? 'en',
  );
  const [gpsLat, setGpsLat] = useState<number | null>(farmer?.gps_lat ?? null);
  const [gpsLng, setGpsLng] = useState<number | null>(farmer?.gps_lng ?? null);

  const [saving, setSaving] = useState(false);
  const [fetchingGps, setFetchingGps] = useState(false);

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

  const fetchGps = async () => {
    setFetchingGps(true);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert(
          'Permission needed',
          'Location permission is required to set your farm coordinates. You can also leave this blank.',
        );
        return;
      }
      const loc = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });
      setGpsLat(loc.coords.latitude);
      setGpsLng(loc.coords.longitude);
    } catch (err) {
      Alert.alert('Couldn’t get location', 'Try again outdoors or check device settings.');
    } finally {
      setFetchingGps(false);
    }
  };

  const handleSave = async () => {
    if (!fullName.trim()) {
      Alert.alert('Name required', 'Please enter your full name.');
      return;
    }

    setSaving(true);
    try {
      const payload: Record<string, any> = {
        full_name: fullName.trim(),
        email: email.trim() || null,
        region: region || null,
        district: district.trim() || null,
        primary_crop: primaryCrop || null,
        preferred_language: language,
      };
      if (gpsLat !== null) payload.gps_lat = gpsLat;
      if (gpsLng !== null) payload.gps_lng = gpsLng;

      const { data } = await apiClient.patch('/api/auth/me', payload);

      // Update Zustand store directly with the fresh farmer object
      useAuthStore.setState({ farmer: data });

      Alert.alert('Saved', 'Your profile has been updated.', [
        { text: 'OK', onPress: () => router.back() },
      ]);
    } catch (err: any) {
      const msg =
        err?.response?.data?.detail ??
        'Couldn’t save your changes. Please try again.';
      Alert.alert('Error', msg);
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <Stack.Screen options={{ title: 'Edit profile', headerBackTitle: 'Back' }} />
      <KeyboardAvoidingView
        style={{ flex: 1, backgroundColor: colors.background }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          style={styles.container}
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
        >
          {/* Personal info */}
          <SectionHeader title="Personal info" />
          <View style={styles.group}>
            <FieldText
              label="Full name"
              value={fullName}
              onChangeText={setFullName}
              placeholder="e.g. Kofi Asare"
              autoCapitalize="words"
            />
            <Divider />
            <FieldText
              label="Email"
              value={email}
              onChangeText={setEmail}
              placeholder="optional"
              keyboardType="email-address"
              autoCapitalize="none"
            />
          </View>

          {/* Location */}
          <SectionHeader title="Location" />
          <View style={styles.group}>
            <FieldPicker
              label="Region"
              value={region || 'Choose region…'}
              onPress={() => pickFromList('Choose your region', GHANA_REGIONS, setRegion)}
              isPlaceholder={!region}
            />
            <Divider />
            <FieldText
              label="District"
              value={district}
              onChangeText={setDistrict}
              placeholder="e.g. Ejura-Sekyedumase"
              autoCapitalize="words"
            />
            <Divider />
            <View style={styles.gpsRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.fieldLabel}>Farm coordinates</Text>
                <Text style={styles.gpsValue}>
                  {gpsLat !== null && gpsLng !== null
                    ? `${gpsLat.toFixed(4)}, ${gpsLng.toFixed(4)}`
                    : 'Not set'}
                </Text>
              </View>
              <TouchableOpacity
                style={styles.gpsBtn}
                onPress={fetchGps}
                disabled={fetchingGps}
                activeOpacity={0.7}
              >
                {fetchingGps ? (
                  <ActivityIndicator color={colors.primary} size="small" />
                ) : (
                  <Feather name="map-pin" color={colors.primary} size={16} />
                )}
                <Text style={styles.gpsBtnText}>
                  {fetchingGps ? 'Locating…' : 'Use my location'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Farming */}
          <SectionHeader title="Farming" />
          <View style={styles.group}>
            <FieldPicker
              label="Primary crop"
              value={primaryCrop || 'Choose crop…'}
              onPress={() => pickFromList('Choose your primary crop', CROPS, setPrimaryCrop)}
              isPlaceholder={!primaryCrop}
            />
          </View>

          {/* Preferences */}
          <SectionHeader title="Preferences" />
          <View style={styles.group}>
            <FieldPicker
              label="Language"
              value={LANGUAGES.find((l) => l.code === language)?.label ?? 'English'}
              onPress={() =>
                Alert.alert(
                  'Choose language',
                  undefined,
                  [
                    ...LANGUAGES.map((l) => ({
                      text: l.label,
                      onPress: () => setLanguage(l.code),
                    })),
                    { text: 'Cancel', style: 'cancel' as const },
                  ],
                )
              }
            />
          </View>

          {/* Save button */}
          <TouchableOpacity
            style={[styles.saveBtn, saving && { opacity: 0.6 }]}
            onPress={handleSave}
            disabled={saving}
            activeOpacity={0.8}
          >
            {saving ? (
              <ActivityIndicator color="#fff" size="small" />
            ) : (
              <Feather name="check" color="#fff" size={20} />
            )}
            <Text style={styles.saveBtnText}>{saving ? 'Saving…' : 'Save changes'}</Text>
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    </>
  );
}

// ─── Subcomponents ──────────────────────────────────────────────

function SectionHeader({ title }: { title: string }) {
  return <Text style={styles.sectionHeader}>{title.toUpperCase()}</Text>;
}

function FieldText({
  label,
  value,
  onChangeText,
  placeholder,
  keyboardType,
  autoCapitalize,
}: {
  label: string;
  value: string;
  onChangeText: (v: string) => void;
  placeholder?: string;
  keyboardType?: 'default' | 'email-address' | 'phone-pad';
  autoCapitalize?: 'none' | 'sentences' | 'words';
}) {
  return (
    <View style={styles.field}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <TextInput
        style={styles.fieldInput}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={colors.textMuted}
        keyboardType={keyboardType ?? 'default'}
        autoCapitalize={autoCapitalize ?? 'sentences'}
      />
    </View>
  );
}

function FieldPicker({
  label,
  value,
  onPress,
  isPlaceholder = false,
}: {
  label: string;
  value: string;
  onPress: () => void;
  isPlaceholder?: boolean;
}) {
  return (
    <TouchableOpacity style={styles.field} onPress={onPress} activeOpacity={0.6}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <View style={styles.pickerValueRow}>
        <Text
          style={[
            styles.pickerValue,
            isPlaceholder && { color: colors.textMuted },
          ]}
        >
          {value}
        </Text>
        <Feather name="chevron-down" color={colors.textTertiary} size={18} />
      </View>
    </TouchableOpacity>
  );
}

function Divider() {
  return <View style={styles.divider} />;
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { padding: spacing.xl, paddingBottom: spacing.xxxl },
  sectionHeader: {
    fontSize: 11,
    fontFamily: fonts.bold,
    color: colors.textTertiary,
    letterSpacing: 0.8,
    marginTop: spacing.xl,
    marginBottom: spacing.sm,
    paddingLeft: spacing.xs,
  },
  group: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
    ...shadows.card,
  },
  field: {
    padding: spacing.md,
  },
  fieldLabel: {
    fontSize: 12,
    fontFamily: fonts.semibold,
    color: colors.textTertiary,
    letterSpacing: 0.3,
    marginBottom: 4,
  },
  fieldInput: {
    fontSize: 15,
    fontFamily: fonts.regular,
    color: colors.textPrimary,
    paddingVertical: 4,
  },
  pickerValueRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 4,
  },
  pickerValue: {
    fontSize: 15,
    fontFamily: fonts.regular,
    color: colors.textPrimary,
    flex: 1,
  },
  gpsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.md,
    gap: spacing.sm,
  },
  gpsValue: {
    fontSize: 15,
    fontFamily: fonts.regular,
    color: colors.textPrimary,
    marginTop: 2,
  },
  gpsBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.primaryLight,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.md,
    gap: spacing.xs,
  },
  gpsBtnText: {
    fontSize: 13,
    fontFamily: fonts.semibold,
    color: colors.primary,
  },
  divider: {
    height: 1,
    backgroundColor: colors.border,
    marginLeft: spacing.md,
  },
  saveBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primary,
    borderRadius: radius.lg,
    padding: spacing.md,
    marginTop: spacing.xxl,
    gap: spacing.sm,
    ...shadows.card,
  },
  saveBtnText: {
    fontSize: 16,
    fontFamily: fonts.bold,
    color: '#fff',
  },
});