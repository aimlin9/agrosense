import { Feather } from '@expo/vector-icons';
import { useQueryClient } from '@tanstack/react-query';
import * as Haptics from 'expo-haptics';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { apiClient, getErrorMessage } from '@/api/client';
import { queryKeys } from '@/api/hooks';
import type { DiagnosisDetail } from '@/api/types';
import { Button } from '@/components/ui/Button';
import { StackHeader } from '@/components/ui/Header';
import { Banner } from '@/components/ui/Layout';
import { Text } from '@/components/ui/Text';
import { colors, radius, spacing } from '@/constants/theme';

const STAGES = ['Uploading photo', 'Examining the leaf', 'Writing your treatment plan'];

export default function ConfirmScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const queryClient = useQueryClient();
  const { uri, cropId, cropName } = useLocalSearchParams<{ uri: string; cropId: string; cropName?: string }>();
  const [stage, setStage] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);

  useEffect(() => () => timers.current.forEach(clearTimeout), []);

  if (!uri || !cropId) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.canvas }}>
        <StackHeader title="Scan" />
        <View style={{ padding: spacing.gutter }}>
          <Banner tone="warning" message="The photo didn’t come through. Go back and try again." />
        </View>
      </View>
    );
  }

  const analyse = async () => {
    setError(null);
    setStage(0);
    timers.current.forEach(clearTimeout);
    timers.current = [setTimeout(() => setStage(1), 1500), setTimeout(() => setStage(2), 4500)];

    const form = new FormData();
    form.append('crop_id', cropId);
    form.append('file', { uri, name: 'leaf.jpg', type: 'image/jpeg' } as unknown as Blob);

    try {
      const { data } = await apiClient.post<DiagnosisDetail>('/api/diagnose', form, {
        headers: { 'Content-Type': 'multipart/form-data' },
        timeout: 90000,
        transformRequest: (d) => d, // let RN set the multipart boundary
      });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      queryClient.setQueryData(queryKeys.diagnosis(data.id), { ...data, local_image_uri: uri });
      queryClient.invalidateQueries({ queryKey: queryKeys.diagnoses });
      router.replace({ pathname: '/diagnosis/[id]', params: { id: data.id, fresh: '1' } });
    } catch (err) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {});
      setError(getErrorMessage(err, 'We couldn’t analyse this photo. Please try again.'));
      setStage(null);
    } finally {
      timers.current.forEach(clearTimeout);
    }
  };

  const working = stage !== null;

  return (
    <View style={{ flex: 1, backgroundColor: colors.black }}>
      <StatusBar style="light" />
      <Image source={{ uri }} style={StyleSheet.absoluteFill} contentFit="cover" />
      <LinearGradient
        colors={['rgba(0,0,0,0.45)', 'transparent', 'rgba(0,0,0,0.2)', 'rgba(8,24,14,0.95)']}
        locations={[0, 0.2, 0.5, 1]}
        style={StyleSheet.absoluteFill}
      />
      <StackHeader transparent title={cropName ? `${cropName} leaf` : 'Your photo'} onBack={working ? () => {} : undefined} />

      {/* Framing guide */}
      <View pointerEvents="none" style={styles.frameWrap}>
        <View style={styles.frame}>
          {(['tl', 'tr', 'bl', 'br'] as const).map((c) => (
            <View key={c} style={[styles.corner, styles[c]]} />
          ))}
        </View>
      </View>

      <View style={[styles.panel, { paddingBottom: insets.bottom + spacing.lg }]}>
        {error ? <Banner tone="danger" message={error} /> : null}
        {working ? (
          <View style={styles.progress} accessibilityLiveRegion="polite">
            {STAGES.map((label, i) => {
              const done = stage! > i;
              const active = stage === i;
              return (
                <View key={label} style={styles.stageRow}>
                  <View style={[styles.stageDot, done && styles.stageDone]}>
                    {done ? (
                      <Feather name="check" size={12} color={colors.brandDeep} />
                    ) : active ? (
                      <ActivityIndicator size="small" color={colors.white} />
                    ) : null}
                  </View>
                  <Text variant={active ? 'bodyStrong' : 'body'} color={done || active ? colors.white : 'rgba(255,255,255,0.5)'}>
                    {label}
                  </Text>
                </View>
              );
            })}
            <Text variant="caption" color="rgba(255,255,255,0.6)" style={{ marginTop: spacing.sm }}>
              This usually takes 5–15 seconds.
            </Text>
          </View>
        ) : (
          <>
            <Text variant="heading" color={colors.white}>
              Is the problem clearly visible?
            </Text>
            <Text variant="small" color="rgba(255,255,255,0.75)" style={{ marginBottom: spacing.sm }}>
              A sharp, close photo of one leaf gives the best result.
            </Text>
            <Button label={error ? 'Try again' : 'Analyse photo'} variant="inverse" icon="zap" onPress={analyse} />
            <Button label="Retake" variant="ghost" onPress={() => router.back()} style={{ marginTop: -spacing.xs }} />
          </>
        )}
      </View>
    </View>
  );
}

const C = 26;
const styles = StyleSheet.create({
  frameWrap: { ...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'center', paddingBottom: 140 },
  frame: { width: '72%', aspectRatio: 1 },
  corner: { position: 'absolute', width: C, height: C, borderColor: 'rgba(255,255,255,0.85)' },
  tl: { top: 0, left: 0, borderTopWidth: 2, borderLeftWidth: 2, borderTopLeftRadius: radius.sm },
  tr: { top: 0, right: 0, borderTopWidth: 2, borderRightWidth: 2, borderTopRightRadius: radius.sm },
  bl: { bottom: 0, left: 0, borderBottomWidth: 2, borderLeftWidth: 2, borderBottomLeftRadius: radius.sm },
  br: { bottom: 0, right: 0, borderBottomWidth: 2, borderRightWidth: 2, borderBottomRightRadius: radius.sm },
  panel: { position: 'absolute', left: 0, right: 0, bottom: 0, paddingHorizontal: spacing.gutter, gap: spacing.sm },
  progress: { gap: spacing.md, paddingVertical: spacing.md },
  stageRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  stageDot: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.5)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  stageDone: { backgroundColor: colors.white, borderColor: colors.white },
});
