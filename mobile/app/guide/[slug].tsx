import { Feather } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { getErrorMessage } from '@/api/client';
import { useGuideEntry } from '@/api/hooks';
import { Enter } from '@/components/motion';
import { Button } from '@/components/ui/Button';
import { StackHeader } from '@/components/ui/Header';
import { Card, ErrorState, SectionHeader, Skeleton, Tag } from '@/components/ui/Layout';
import { Text } from '@/components/ui/Text';
import { colors, fonts, radius, severityStyle, spacing } from '@/constants/theme';

export default function GuideEntryScreen() {
  const { slug } = useLocalSearchParams<{ slug: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { data, isLoading, isError, error, refetch } = useGuideEntry(slug);

  if (isLoading) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.canvas }}>
        <StackHeader />
        <View style={{ padding: spacing.gutter, gap: spacing.md }}>
          <Skeleton width={120} height={20} />
          <Skeleton width="70%" height={34} />
          <Skeleton height={80} />
          <Skeleton height={180} rounded={radius.lg} />
        </View>
      </View>
    );
  }
  if (isError || !data) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.canvas }}>
        <StackHeader />
        <ErrorState message={getErrorMessage(error)} onRetry={() => refetch()} />
      </View>
    );
  }

  const sev = severityStyle(data.severity);
  let i = 0;
  const next = () => ++i;

  return (
    <View style={{ flex: 1, backgroundColor: colors.canvas }}>
      <StackHeader title={data.crop} />
      <ScrollView contentContainerStyle={{ paddingHorizontal: spacing.gutter, paddingBottom: insets.bottom + spacing.xxxl }}>
        <Enter>
          <View style={[styles.hero, { backgroundColor: sev.bg }]}>
            <View style={{ flexDirection: 'row', gap: spacing.sm, flexWrap: 'wrap' }}>
              <Tag label={sev.label} fg={sev.fg} bg={colors.surface} icon="activity" />
              <Tag label={data.type} fg={colors.inkSoft} bg={colors.surface} />
            </View>
            <Text style={styles.title}>{data.name}</Text>
            <Text style={styles.pathogen} color={colors.inkSoft}>
              {data.pathogen}
            </Text>
            <Text variant="body" style={{ marginTop: spacing.md }}>
              {data.summary}
            </Text>
          </View>
        </Enter>

        <Enter index={next()}>
          <SectionHeader title="What you’ll see" />
          <Card>
            <View style={{ gap: spacing.md }}>
              {data.symptoms.map((s) => (
                <View key={s} style={styles.bullet}>
                  <Feather name="eye" size={15} color={colors.brand} style={{ marginTop: 4 }} />
                  <Text variant="body" style={{ flex: 1 }}>
                    {s}
                  </Text>
                </View>
              ))}
            </View>
          </Card>
        </Enter>

        <Enter index={next()}>
          <View style={styles.twoUp}>
            <Card style={{ flex: 1 }}>
              <Feather name="cloud-drizzle" size={18} color={colors.info} />
              <Text variant="smallStrong" style={{ marginTop: spacing.sm }}>
                When it strikes
              </Text>
              <Text variant="small" color={colors.inkSoft} style={{ marginTop: 4 }}>
                {data.conditions}
              </Text>
            </Card>
            <Card style={{ flex: 1 }}>
              <Feather name="wind" size={18} color={colors.warning} />
              <Text variant="smallStrong" style={{ marginTop: spacing.sm }}>
                How it spreads
              </Text>
              <Text variant="small" color={colors.inkSoft} style={{ marginTop: 4 }}>
                {data.spread}
              </Text>
            </Card>
          </View>
        </Enter>

        <Enter index={next()}>
          <SectionHeader title="What to do" />
          <Card padded={false}>
            <View style={{ padding: spacing.lg, gap: spacing.md }}>
              <Text variant="smallStrong" color={colors.brand}>
                In the field
              </Text>
              {data.cultural.map((c, n) => (
                <View key={c} style={styles.bullet}>
                  <View style={styles.num}>
                    <Text style={{ fontFamily: fonts.semibold, fontSize: 12 }} color={colors.brand}>
                      {n + 1}
                    </Text>
                  </View>
                  <Text variant="body" style={{ flex: 1 }}>
                    {c}
                  </Text>
                </View>
              ))}
            </View>
            <View style={styles.rule} />
            <View style={{ padding: spacing.lg, gap: 6 }}>
              <View style={styles.row}>
                <Feather name="feather" size={15} color={colors.brand} />
                <Text variant="smallStrong" color={colors.brand}>
                  Organic — try first
                </Text>
              </View>
              <Text variant="body">{data.organic}</Text>
            </View>
            <View style={styles.rule} />
            <View style={{ padding: spacing.lg, gap: 6 }}>
              <View style={styles.row}>
                <Feather name="droplet" size={15} color={colors.warning} />
                <Text variant="smallStrong" color={colors.warning}>
                  Chemical — if it keeps spreading
                </Text>
              </View>
              <Text variant="body">{data.chemical}</Text>
              <Text variant="caption" color={colors.inkMuted}>
                Buy from a certified agro-input dealer, follow the label, and wear gloves and a mask.
              </Text>
            </View>
          </Card>
        </Enter>

        <Enter index={next()}>
          <SectionHeader title="Prevent it next season" />
          <Card>
            <View style={{ gap: spacing.md }}>
              {data.prevention.map((p) => (
                <View key={p} style={styles.bullet}>
                  <Feather name="shield" size={15} color={colors.brand} style={{ marginTop: 4 }} />
                  <Text variant="body" style={{ flex: 1 }}>
                    {p}
                  </Text>
                </View>
              ))}
            </View>
          </Card>
        </Enter>

        <Enter index={next()} style={{ marginTop: spacing.xxl, gap: spacing.sm }}>
          <Button label="Check a plant for this" icon="camera" onPress={() => router.push('/(tabs)/diagnose')} />
          <Text variant="caption" color={colors.inkMuted} align="center">
            General guidance. Your local extension officer knows your conditions best.
          </Text>
        </Enter>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  hero: { borderRadius: radius.xl, padding: spacing.xl, marginTop: spacing.sm },
  title: { fontFamily: fonts.display, fontSize: 34, lineHeight: 40, letterSpacing: -0.7, color: colors.ink, marginTop: spacing.lg },
  pathogen: { fontFamily: fonts.displayItalic, fontSize: 16, marginTop: 2 },
  bullet: { flexDirection: 'row', gap: spacing.md },
  twoUp: { flexDirection: 'row', gap: spacing.md, marginTop: spacing.lg },
  num: { width: 22, height: 22, borderRadius: 11, backgroundColor: colors.brandTint, alignItems: 'center', justifyContent: 'center', marginTop: 1 },
  rule: { height: StyleSheet.hairlineWidth, backgroundColor: colors.hairline },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
});
