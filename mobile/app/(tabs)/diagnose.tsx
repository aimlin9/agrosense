import { Feather } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { getErrorMessage } from '@/api/client';
import { useCrops } from '@/api/hooks';
import type { Crop } from '@/api/types';
import { Button } from '@/components/ui/Button';
import { ScreenTitle } from '@/components/ui/Header';
import { Banner, ErrorState, SectionHeader, Skeleton } from '@/components/ui/Layout';
import { Text } from '@/components/ui/Text';
import { colors, radius, shadows, spacing } from '@/constants/theme';
import { pickPhoto, takePhoto } from '@/lib/photo';
import { useAuthStore } from '@/store/authStore';

const TIPS: { icon: keyof typeof Feather.glyphMap; text: string }[] = [
  { icon: 'sun', text: 'Daylight, no flash. Avoid harsh shadows.' },
  { icon: 'maximize', text: 'One leaf filling most of the photo.' },
  { icon: 'eye', text: 'Show the spots or damage clearly, in focus.' },
];

export default function DiagnoseScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const farmer = useAuthStore((s) => s.farmer);
  const crops = useCrops();
  const [cropId, setCropId] = useState<string | null>(null);
  const [busy, setBusy] = useState<'camera' | 'gallery' | null>(null);

  const supported = useMemo(() => (crops.data ?? []).filter((c) => c.supported), [crops.data]);
  const others = useMemo(() => (crops.data ?? []).filter((c) => !c.supported), [crops.data]);
  const selected = crops.data?.find((c) => c.id === cropId) ?? null;

  // Preselect the farmer's main crop.
  useEffect(() => {
    if (cropId || !crops.data) return;
    const wanted = (farmer?.primary_crop ?? '').toLowerCase();
    const match = crops.data.find((c) => c.name.toLowerCase() === wanted || c.raw_name.toLowerCase() === wanted);
    if (match) setCropId(match.id);
  }, [crops.data, farmer?.primary_crop, cropId]);

  const go = async (source: 'camera' | 'gallery') => {
    if (!selected) return;
    setBusy(source);
    try {
      const uri = source === 'camera' ? await takePhoto() : await pickPhoto();
      if (uri) {
        router.push({ pathname: '/diagnosis/confirm', params: { uri, cropId: selected.id, cropName: selected.name } });
      }
    } finally {
      setBusy(null);
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.canvas }}>
      <ScrollView
        contentContainerStyle={{ paddingTop: insets.top + spacing.lg, paddingHorizontal: spacing.gutter, paddingBottom: 180 }}
        showsVerticalScrollIndicator={false}
      >
        <ScreenTitle eyebrow="Crop doctor" title="Scan a plant" subtitle="Choose the crop, then photograph one affected leaf." />

        <SectionHeader title="1 · Which crop?" style={{ marginTop: spacing.sm }} />
        {crops.isLoading ? (
          <View style={styles.grid}>
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} width="48%" height={64} rounded={radius.md} />
            ))}
          </View>
        ) : crops.isError ? (
          <ErrorState message={getErrorMessage(crops.error)} onRetry={() => crops.refetch()} />
        ) : (
          <>
            <View style={styles.grid}>
              {supported.map((c) => (
                <CropTile key={c.id} crop={c} selected={c.id === cropId} onPress={() => setCropId(c.id)} />
              ))}
            </View>
            {others.length > 0 ? (
              <>
                <Text variant="caption" color={colors.inkMuted} style={{ marginTop: spacing.lg, marginBottom: spacing.sm }}>
                  Early access — results are a rough guide for these crops
                </Text>
                <View style={styles.grid}>
                  {others.map((c) => (
                    <CropTile key={c.id} crop={c} selected={c.id === cropId} onPress={() => setCropId(c.id)} />
                  ))}
                </View>
              </>
            ) : null}
          </>
        )}

        {selected && !selected.supported ? (
          <View style={{ marginTop: spacing.lg }}>
            <Banner
              tone="warning"
              title={`${selected.name} is in early access`}
              message="Our model wasn’t trained on this crop yet. You’ll still get guidance, but please confirm with an extension officer."
            />
          </View>
        ) : null}

        <SectionHeader title="2 · Photo tips" />
        <View style={styles.tips}>
          {TIPS.map((t) => (
            <View key={t.text} style={styles.tip}>
              <View style={styles.tipIcon}>
                <Feather name={t.icon} size={16} color={colors.brand} />
              </View>
              <Text variant="small" color={colors.inkSoft} style={{ flex: 1 }}>
                {t.text}
              </Text>
            </View>
          ))}
        </View>
      </ScrollView>

      <View style={styles.actions}>
        {!selected ? (
          <Text variant="small" color={colors.inkMuted} align="center" style={{ marginBottom: spacing.sm }}>
            Choose a crop to continue
          </Text>
        ) : null}
        <Button
          label="Take a photo"
          icon="camera"
          onPress={() => go('camera')}
          loading={busy === 'camera'}
          disabled={!selected || !!busy}
        />
        <Button
          label="Choose from gallery"
          icon="image"
          variant="secondary"
          onPress={() => go('gallery')}
          loading={busy === 'gallery'}
          disabled={!selected || !!busy}
          style={{ marginTop: spacing.sm }}
        />
      </View>
    </View>
  );
}

function CropTile({ crop, selected, onPress }: { crop: Crop; selected: boolean; onPress: () => void }) {
  return (
    <Pressable
      onPress={() => {
        Haptics.selectionAsync().catch(() => {});
        onPress();
      }}
      accessibilityRole="radio"
      accessibilityState={{ checked: selected }}
      accessibilityLabel={crop.name}
      style={({ pressed }) => [styles.tile, selected && styles.tileSelected, pressed && !selected && { backgroundColor: colors.surfaceSunken }]}
    >
      <View style={{ flex: 1 }}>
        <Text variant="bodyStrong" color={selected ? colors.white : colors.ink} numberOfLines={1}>
          {crop.name}
        </Text>
        <Text variant="caption" color={selected ? 'rgba(255,255,255,0.75)' : colors.inkMuted}>
          {crop.supported ? `${crop.condition_count} ${crop.condition_count === 1 ? 'condition' : 'conditions'}` : 'Early access'}
        </Text>
      </View>
      <View style={[styles.radio, selected && styles.radioOn]}>{selected ? <Feather name="check" size={12} color={colors.brand} /> : null}</View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  grid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', rowGap: spacing.sm + 2 },
  tile: {
    width: '48.5%',
    minHeight: 64,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.md + 2,
    paddingVertical: spacing.md,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.hairline,
  },
  tileSelected: { backgroundColor: colors.brand, borderColor: colors.brand },
  radio: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: colors.hairlineStrong,
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioOn: { backgroundColor: colors.white, borderColor: colors.white },
  tips: { gap: spacing.md },
  tip: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  tipIcon: {
    width: 32,
    height: 32,
    borderRadius: radius.sm,
    backgroundColor: colors.brandTint,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actions: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: spacing.gutter,
    paddingTop: spacing.md,
    paddingBottom: spacing.md,
    backgroundColor: colors.canvas,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.hairline,
    ...shadows.soft,
  },
});
