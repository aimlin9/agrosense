import DateTimePicker, { DateTimePickerEvent } from '@react-native-community/datetimepicker';
import { useQueryClient } from '@tanstack/react-query';
import * as Location from 'expo-location';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { Alert, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { apiClient, getErrorMessage } from '@/api/client';
import { queryKeys, useCrops, usePlots } from '@/api/hooks';
import type { FarmPlot } from '@/api/types';
import { Button } from '@/components/ui/Button';
import { StackHeader } from '@/components/ui/Header';
import { Banner, Card, SectionHeader } from '@/components/ui/Layout';
import { SelectField, SelectSheet } from '@/components/ui/SelectSheet';
import { Text } from '@/components/ui/Text';
import { TextField } from '@/components/ui/TextField';
import { colors, radius, spacing } from '@/constants/theme';
import { suggestedHarvest, toIsoDate } from '@/lib/agronomy';

const SOILS = ['Sandy', 'Sandy loam', 'Loam', 'Clay loam', 'Clay'].map((s) => ({ value: s, label: s }));
const WATER = ['Rain-fed', 'Watering can', 'Furrow', 'Drip', 'Sprinkler'].map((s) => ({ value: s, label: s }));

function parseIso(d: string | null | undefined) {
  if (!d) return null;
  const [y, m, day] = d.split('-').map(Number);
  return new Date(y, m - 1, day);
}

export default function EditPlotScreen() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const queryClient = useQueryClient();
  const crops = useCrops();
  const plots = usePlots();
  const existing = useMemo(() => plots.data?.find((p) => p.id === id), [plots.data, id]);

  const [name, setName] = useState('');
  const [cropId, setCropId] = useState<string | null>(null);
  const [size, setSize] = useState('');
  const [planted, setPlanted] = useState<Date | null>(null);
  const [harvest, setHarvest] = useState<Date | null>(null);
  const [soil, setSoil] = useState<string | null>(null);
  const [water, setWater] = useState<string | null>(null);
  const [notes, setNotes] = useState('');
  const [gps, setGps] = useState<{ lat: number; lng: number } | null>(null);
  const [sheet, setSheet] = useState<'crop' | 'soil' | 'water' | null>(null);
  const [picker, setPicker] = useState<'planted' | 'harvest' | null>(null);
  const [saving, setSaving] = useState(false);
  const [locating, setLocating] = useState(false);
  const [errors, setErrors] = useState<{ name?: string | null; size?: string | null; form?: string | null }>({});
  const [loaded, setLoaded] = useState(!id);

  useEffect(() => {
    if (!existing || loaded) return;
    setName(existing.name);
    setCropId(existing.crop_id);
    setSize(existing.size_acres != null ? String(existing.size_acres) : '');
    setPlanted(parseIso(existing.planting_date));
    setHarvest(parseIso(existing.expected_harvest_date));
    setSoil(existing.soil_type);
    setWater(existing.irrigation_type);
    setNotes(existing.notes ?? '');
    setGps(existing.gps_lat != null && existing.gps_lng != null ? { lat: existing.gps_lat, lng: existing.gps_lng } : null);
    setLoaded(true);
  }, [existing, loaded]);

  const cropOptions = (crops.data ?? []).filter((c) => c.supported).map((c) => ({ value: c.id, label: c.name }));
  const cropName = crops.data?.find((c) => c.id === cropId)?.name ?? null;
  const suggestion = suggestedHarvest(cropName, planted);

  const onDate = (which: 'planted' | 'harvest') => (event: DateTimePickerEvent, date?: Date) => {
    if (Platform.OS === 'android') setPicker(null);
    if (event.type === 'dismissed' || !date) return;
    if (which === 'planted') {
      setPlanted(date);
      if (!harvest) {
        const s = suggestedHarvest(cropName, date);
        if (s) setHarvest(s);
      }
    } else setHarvest(date);
  };

  const locate = async () => {
    setLocating(true);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Location is off', 'Allow location for AgroSense to map this field.');
        return;
      }
      const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
      setGps({ lat: pos.coords.latitude, lng: pos.coords.longitude });
    } catch {
      Alert.alert('Couldn’t get a GPS fix', 'Try again outdoors.');
    } finally {
      setLocating(false);
    }
  };

  const save = async () => {
    const sizeNum = size.trim() ? Number(size.replace(',', '.')) : null;
    const e = {
      name: name.trim() ? null : 'Give this field a name.',
      size: sizeNum === null || (Number.isFinite(sizeNum) && sizeNum > 0) ? null : 'Enter the size in acres, e.g. 2.5',
    };
    setErrors(e);
    if (e.name || e.size) return;
    setSaving(true);
    const body = {
      name: name.trim(),
      crop_id: cropId,
      size_acres: sizeNum,
      planting_date: planted ? toIsoDate(planted) : null,
      expected_harvest_date: harvest ? toIsoDate(harvest) : null,
      soil_type: soil,
      irrigation_type: water,
      notes: notes.trim() || null,
      gps_lat: gps?.lat ?? null,
      gps_lng: gps?.lng ?? null,
    };
    try {
      if (id) await apiClient.patch<FarmPlot>(`/api/plots/${id}`, body);
      else await apiClient.post<FarmPlot>('/api/plots', body);
      await queryClient.invalidateQueries({ queryKey: queryKeys.plots });
      router.back();
    } catch (err) {
      setErrors({ form: getErrorMessage(err, 'Couldn’t save this field.') });
    } finally {
      setSaving(false);
    }
  };

  const remove = () =>
    Alert.alert('Delete this field?', 'Its season record will be removed.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await apiClient.delete(`/api/plots/${id}`);
            await queryClient.invalidateQueries({ queryKey: queryKeys.plots });
            router.back();
          } catch (err) {
            Alert.alert('Couldn’t delete', getErrorMessage(err));
          }
        },
      },
    ]);

  const fmt = (d: Date | null) => (d ? d.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' }) : null);

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: colors.canvas }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <StackHeader title={id ? 'Edit field' : 'New field'} />
      <ScrollView contentContainerStyle={{ paddingHorizontal: spacing.gutter, paddingBottom: insets.bottom + spacing.xxxl }} keyboardShouldPersistTaps="handled">
        {errors.form ? <Banner tone="danger" message={errors.form} /> : null}

        <SectionHeader title="The field" style={{ marginTop: spacing.md }} />
        <View style={{ gap: spacing.lg }}>
          <TextField label="Name" value={name} onChangeText={setName} error={errors.name} placeholder="e.g. Riverside plot" autoCapitalize="sentences" />
          <SelectField label="Crop" value={cropName} onPress={() => setSheet('crop')} placeholder="What’s growing here?" />
          <TextField label="Size (acres)" value={size} onChangeText={setSize} error={errors.size} keyboardType="decimal-pad" placeholder="e.g. 2.5" />
        </View>

        <SectionHeader title="This season" />
        <View style={{ gap: spacing.lg }}>
          <DateField label="Planted on" value={fmt(planted)} onPress={() => setPicker('planted')} />
          <DateField
            label="Expected harvest"
            value={fmt(harvest)}
            onPress={() => setPicker('harvest')}
            hint={suggestion && !harvest ? `Typical for ${cropName}: around ${fmt(suggestion)}` : undefined}
          />
          {picker && Platform.OS !== 'web' ? (
            <DateTimePicker
              value={(picker === 'planted' ? planted : harvest) ?? new Date()}
              mode="date"
              display={Platform.OS === 'ios' ? 'inline' : 'default'}
              onChange={onDate(picker)}
              accentColor={colors.brand}
              themeVariant="light"
            />
          ) : null}
          {picker && Platform.OS === 'ios' ? <Button label="Done" variant="secondary" size="md" onPress={() => setPicker(null)} /> : null}
        </View>

        <SectionHeader title="Growing conditions" />
        <View style={{ gap: spacing.lg }}>
          <SelectField label="Soil" value={soil} onPress={() => setSheet('soil')} placeholder="Choose soil type" />
          <SelectField label="Water" value={water} onPress={() => setSheet('water')} placeholder="How is it watered?" />
          <Card>
            <Text variant="bodyStrong">Field location</Text>
            <Text variant="small" color={colors.inkMuted} style={{ marginTop: 2, marginBottom: spacing.md }}>
              {gps ? `Saved: ${gps.lat.toFixed(4)}, ${gps.lng.toFixed(4)}` : 'Stand in the field and tap below for local weather.'}
            </Text>
            <Button label={gps ? 'Update location' : 'Use my current location'} icon="map-pin" variant="secondary" size="md" loading={locating} onPress={locate} />
          </Card>
          <TextField label="Notes (optional)" value={notes} onChangeText={setNotes} placeholder="Variety, seed source, anything to remember" multiline style={{ minHeight: 80, textAlignVertical: 'top' }} />
        </View>

        <Button label={id ? 'Save changes' : 'Add field'} onPress={save} loading={saving} style={{ marginTop: spacing.xxl }} />
        {id ? <Button label="Delete field" variant="ghost" onPress={remove} style={{ marginTop: spacing.sm }} /> : null}
      </ScrollView>

      <SelectSheet visible={sheet === 'crop'} title="Crop" options={cropOptions} value={cropId} onSelect={setCropId} onClose={() => setSheet(null)} />
      <SelectSheet visible={sheet === 'soil'} title="Soil type" options={SOILS} value={soil} onSelect={setSoil} onClose={() => setSheet(null)} />
      <SelectSheet visible={sheet === 'water'} title="Watering" options={WATER} value={water} onSelect={setWater} onClose={() => setSheet(null)} />
    </KeyboardAvoidingView>
  );
}

function DateField({ label, value, onPress, hint }: { label: string; value: string | null; onPress: () => void; hint?: string }) {
  return (
    <View style={{ gap: 6 }}>
      <Text variant="smallStrong" color={colors.inkSoft} style={{ marginLeft: 2 }}>
        {label}
      </Text>
      <Pressable onPress={onPress} style={styles.date} accessibilityRole="button" accessibilityLabel={`${label}: ${value ?? 'not set'}`}>
        <Text variant="body" color={value ? colors.ink : colors.inkFaint} style={{ flex: 1 }}>
          {value ?? 'Choose a date'}
        </Text>
      </Pressable>
      {hint ? (
        <Text variant="caption" color={colors.brand} style={{ marginLeft: 2 }}>
          {hint}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  date: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 54,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.hairlineStrong,
    backgroundColor: colors.surface,
  },
});
