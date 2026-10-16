import { Feather } from '@expo/vector-icons';
import { useQueryClient } from '@tanstack/react-query';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useState } from 'react';
import { Alert, ScrollView, Share, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { apiClient, getErrorMessage } from '@/api/client';
import { queryKeys, useDiagnosis } from '@/api/hooks';
import { ConfidenceMeter } from '@/components/DataViz';
import { Button } from '@/components/ui/Button';
import { IconButton, StackHeader } from '@/components/ui/Header';
import { Banner, Card, ErrorState, SectionHeader, Skeleton, Tag } from '@/components/ui/Layout';
import { Text } from '@/components/ui/Text';
import { colors, fonts, radius, severityStyle, spacing } from '@/constants/theme';
import { timeAgo } from '@/lib/format';

export default function DiagnosisScreen() {
  const { id, fresh } = useLocalSearchParams<{ id: string; fresh?: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const queryClient = useQueryClient();
  const { data, isLoading, isError, error, refetch } = useDiagnosis(id);
  const [deleting, setDeleting] = useState(false);

  if (isLoading) return <LoadingView />;
  if (isError || !data) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.canvas }}>
        <StackHeader title="Diagnosis" />
        <ErrorState message={getErrorMessage(error, 'This diagnosis could not be loaded.')} onRetry={() => refetch()} />
      </View>
    );
  }

  const advice = data.treatment_advice;
  const lowConfidence = data.low_confidence ?? data.confidence < 0.6;
  const sev =
    lowConfidence && data.is_healthy
      ? { label: 'Unsure', fg: colors.warning, bg: colors.warningTint }
      : data.is_healthy
        ? severityStyle('none')
        : severityStyle(advice?.severity);
  const title = data.is_healthy
    ? lowConfidence
      ? 'No clear disease found'
      : `Your ${data.crop_name.toLowerCase()} looks healthy`
    : data.predicted_disease;
  const image = data.image_url || data.local_image_uri;
  const alternatives = (data.top_predictions ?? []).slice(1).filter((p) => p.confidence >= 0.03);

  const share = () => {
    const lines = [
      `AgroSense diagnosis — ${data.crop_name}: ${data.is_healthy ? 'Healthy' : data.predicted_disease} (${Math.round(data.confidence * 100)}% confidence)`,
      advice?.summary,
      ...(advice?.immediate_actions ?? []).map((a, i) => `${i + 1}. ${a}`),
    ].filter(Boolean);
    Share.share({ message: lines.join('\n\n') }).catch(() => {});
  };

  const remove = () => {
    Alert.alert('Delete this scan?', 'The photo and result will be removed from your history.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          setDeleting(true);
          try {
            await apiClient.delete(`/api/diagnoses/${data.id}`);
            queryClient.removeQueries({ queryKey: queryKeys.diagnosis(data.id) });
            queryClient.invalidateQueries({ queryKey: queryKeys.diagnoses });
            router.back();
          } catch (err) {
            Alert.alert('Couldn’t delete', getErrorMessage(err));
            setDeleting(false);
          }
        },
      },
    ]);
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.canvas }}>
      <StatusBar style={image ? 'light' : 'dark'} />
      <ScrollView contentContainerStyle={{ paddingBottom: insets.bottom + spacing.xxxl }} showsVerticalScrollIndicator={false}>
        {/* Hero */}
        <View style={[styles.hero, !image && { height: insets.top + 120, backgroundColor: colors.brandTint }]}>
          {image ? (
            <>
              <Image source={{ uri: image }} style={StyleSheet.absoluteFill} contentFit="cover" transition={200} />
              <LinearGradient colors={['rgba(0,0,0,0.45)', 'transparent', 'rgba(0,0,0,0.0)']} locations={[0, 0.35, 1]} style={StyleSheet.absoluteFill} />
            </>
          ) : null}
        </View>

        <View style={styles.sheet}>
          <View style={styles.metaRow}>
            <Tag label={sev.label} fg={sev.fg} bg={sev.bg} icon={sev.label === 'Unsure' ? 'help-circle' : data.is_healthy ? 'check' : 'activity'} />
            <Text variant="caption" color={colors.inkMuted}>
              {data.crop_name} · {timeAgo(data.created_at)}
              {data.channel === 'sms' ? ' · SMS' : ''}
            </Text>
          </View>

          <Text style={styles.title} accessibilityRole="header">
            {title}
          </Text>
          {advice?.summary || (lowConfidence && data.is_healthy) ? (
            <Text variant="body" color={colors.inkSoft} style={{ marginTop: spacing.sm }}>
              {lowConfidence && data.is_healthy
                ? 'We didn’t find signs of a disease we recognise, but the photo wasn’t clear enough to be sure.'
                : advice?.summary}
            </Text>
          ) : null}

          <View style={{ marginTop: spacing.xl }}>
            <ConfidenceMeter value={data.confidence} />
          </View>

          {lowConfidence ? (
            <View style={{ marginTop: spacing.lg }}>
              <Banner
                tone="warning"
                title={data.crop_supported === false ? 'Early-access crop' : 'The AI isn’t sure about this one'}
                message={
                  data.crop_supported === false
                    ? 'This crop isn’t fully supported yet, so treat this result as a rough guide and confirm with an extension officer before spraying.'
                    : 'Try another photo of a single leaf in daylight, close up and in focus. Show an extension officer before buying any chemicals.'
                }
              />
            </View>
          ) : null}

          {data.expert_review ? (
            <View style={{ marginTop: spacing.lg }}>
              <Banner
                tone={data.expert_review.is_ai_correct === false ? 'info' : 'success'}
                title={data.expert_review.is_ai_correct === false ? 'Reviewed by an expert — corrected' : 'Confirmed by an expert'}
                message={data.expert_review.notes || 'An agricultural extension officer reviewed this result.'}
              />
            </View>
          ) : null}

          {advice && advice.immediate_actions?.length ? (
            <>
              <SectionHeader title={data.is_healthy ? 'Keep it that way' : 'What to do now'} />
              <Card>
                <View style={{ gap: spacing.lg }}>
                  {advice.immediate_actions.map((a, i) => (
                    <View key={i} style={styles.step}>
                      <View style={styles.stepNum}>
                        <Text style={{ fontFamily: fonts.semibold, fontSize: 13 }} color={colors.brand}>
                          {i + 1}
                        </Text>
                      </View>
                      <Text variant="body" style={{ flex: 1 }}>
                        {a}
                      </Text>
                    </View>
                  ))}
                </View>
              </Card>
            </>
          ) : null}

          {advice?.organic_treatment || advice?.chemical_treatment ? (
            <>
              <SectionHeader title="Treatment" />
              <Card padded={false}>
                {advice.organic_treatment ? (
                  <Treatment icon="feather" title="Organic & natural — try first" body={advice.organic_treatment} />
                ) : null}
                {advice.organic_treatment && advice.chemical_treatment ? <View style={styles.rule} /> : null}
                {advice.chemical_treatment ? (
                  <Treatment
                    icon="droplet"
                    title="Chemical — if it keeps spreading"
                    body={advice.chemical_treatment}
                    note="Buy only from a certified agro-input dealer, follow the label, and wear gloves and a mask."
                  />
                ) : null}
              </Card>
            </>
          ) : null}

          {advice?.prevention ? (
            <>
              <SectionHeader title="Prevent it next season" />
              <Card>
                <Text variant="body">{advice.prevention}</Text>
              </Card>
            </>
          ) : null}

          {alternatives.length > 0 && !data.is_healthy ? (
            <>
              <SectionHeader title="Other possibilities" />
              <Card padded={false}>
                {alternatives.map((p, i) => (
                  <View key={p.class_name}>
                    {i > 0 ? <View style={[styles.rule, { marginLeft: spacing.lg }]} /> : null}
                    <View style={styles.alt}>
                      <Text variant="body" style={{ flex: 1 }}>
                        {p.display_name ?? p.class_name}
                      </Text>
                      <Text variant="smallStrong" color={colors.inkMuted} tabular>
                        {Math.round(p.confidence * 100)}%
                      </Text>
                    </View>
                  </View>
                ))}
              </Card>
            </>
          ) : null}

          <Text variant="caption" color={colors.inkMuted} style={{ marginTop: spacing.xl }}>
            {data.advice_source === 'curated'
              ? 'Advice from the AgroSense crop-care guide.'
              : 'Advice generated by AI for Ghanaian growing conditions.'}{' '}
            AgroSense supports — it doesn’t replace — your local extension officer.
          </Text>

          <View style={{ gap: spacing.sm, marginTop: spacing.xl }}>
            {fresh ? (
              <Button label="Scan another plant" icon="camera" onPress={() => router.replace('/(tabs)/diagnose')} />
            ) : null}
            <Button label="Share with someone" icon="share-2" variant="secondary" onPress={share} />
          </View>
        </View>
      </ScrollView>

      <View style={[styles.topBar, { paddingTop: insets.top + spacing.xs }]}>
        <IconButton icon="arrow-left" label="Go back" onImage={!!image} onPress={() => (fresh ? router.replace('/(tabs)') : router.back())} />
        <IconButton icon={deleting ? 'loader' : 'trash-2'} label="Delete scan" onImage={!!image} onPress={remove} />
      </View>
    </View>
  );
}

function Treatment({ icon, title, body, note }: { icon: keyof typeof Feather.glyphMap; title: string; body: string; note?: string }) {
  return (
    <View style={{ padding: spacing.lg, gap: spacing.sm }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
        <Feather name={icon} size={16} color={colors.brand} />
        <Text variant="smallStrong" color={colors.brand}>
          {title}
        </Text>
      </View>
      <Text variant="body">{body}</Text>
      {note ? (
        <Text variant="caption" color={colors.inkMuted}>
          {note}
        </Text>
      ) : null}
    </View>
  );
}

function LoadingView() {
  const insets = useSafeAreaInsets();
  return (
    <View style={{ flex: 1, backgroundColor: colors.canvas }}>
      <Skeleton height={320 + insets.top} rounded={0} />
      <View style={{ padding: spacing.gutter, gap: spacing.md }}>
        <Skeleton width={90} height={22} rounded={radius.pill} />
        <Skeleton width="80%" height={30} />
        <Skeleton height={14} />
        <Skeleton width="90%" height={14} />
        <Skeleton height={120} rounded={radius.lg} style={{ marginTop: spacing.lg }} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  hero: { height: 340, backgroundColor: colors.surfaceSunken },
  sheet: {
    marginTop: -radius.xl,
    backgroundColor: colors.canvas,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    paddingHorizontal: spacing.gutter,
    paddingTop: spacing.xl,
  },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, flexWrap: 'wrap' },
  title: { fontFamily: fonts.display, fontSize: 32, lineHeight: 38, letterSpacing: -0.7, color: colors.ink, marginTop: spacing.md },
  step: { flexDirection: 'row', gap: spacing.md, alignItems: 'flex-start' },
  stepNum: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: colors.brandTint,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: -1,
  },
  rule: { height: StyleSheet.hairlineWidth, backgroundColor: colors.hairline },
  alt: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: spacing.lg, paddingVertical: spacing.md + 2 },
  topBar: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
  },
});
