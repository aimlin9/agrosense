import { Feather } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useCrops, useDiagnosisStats, useLatestPrices, useRecentDiagnoses, useWeather } from '@/api/hooks';
import { DiagnosisRow } from '@/components/DiagnosisRow';
import { Button } from '@/components/ui/Button';
import { Card, Divider, SectionHeader, Skeleton } from '@/components/ui/Layout';
import { Text } from '@/components/ui/Text';
import { colors, fonts, radius, spacing } from '@/constants/theme';
import { useLocation } from '@/hooks/useLocation';
import { firstName, formatCedis, greeting, initials, weatherCondition } from '@/lib/format';
import { useAuthStore } from '@/store/authStore';

export default function HomeScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const farmer = useAuthStore((s) => s.farmer);
  const location = useLocation();

  const stats = useDiagnosisStats();
  const recent = useRecentDiagnoses(3);
  const weather = useWeather(location.coords);
  const crops = useCrops();

  // Market snapshot follows the farmer's main crop when we have prices for it.
  const marketCrop = useMemo(() => {
    const list = crops.data ?? [];
    const wanted = (farmer?.primary_crop ?? '').toLowerCase();
    return (
      list.find((c) => c.name.toLowerCase() === wanted || c.raw_name.toLowerCase() === wanted) ??
      list.find((c) => c.name === 'Tomato') ??
      null
    );
  }, [crops.data, farmer?.primary_crop]);
  const prices = useLatestPrices(marketCrop?.id ?? null);

  const [refreshing, setRefreshing] = useState(false);
  const onRefresh = async () => {
    setRefreshing(true);
    await Promise.allSettled([stats.refetch(), recent.refetch(), weather.refetch(), prices.refetch()]);
    setRefreshing(false);
  };

  const name = firstName(farmer?.full_name);
  const today = weather.data?.daily?.[0];
  const cond = weatherCondition(weather.data?.current?.weather_code);
  const topPrices = (prices.data ?? []).filter((p) => p.crop_id === marketCrop?.id).slice(0, 3);

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.canvas }}
      contentContainerStyle={{ paddingTop: insets.top + spacing.lg, paddingHorizontal: spacing.gutter, paddingBottom: spacing.xxxl }}
      showsVerticalScrollIndicator={false}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.brand} colors={[colors.brand]} />}
    >
      {/* Header */}
      <View style={styles.header}>
        <View style={{ flex: 1 }}>
          <Text variant="overline" color={colors.inkMuted}>
            {new Date().toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long' })}
          </Text>
          <Text variant="title" style={{ marginTop: 2 }}>
            {greeting()}
            {name ? `,\n${name}` : ''}
          </Text>
        </View>
        <Pressable
          onPress={() => router.push('/settings')}
          accessibilityRole="button"
          accessibilityLabel="Account and settings"
          style={styles.avatar}
        >
          {farmer?.profile_picture_url ? (
            <Image source={{ uri: farmer.profile_picture_url }} style={StyleSheet.absoluteFill} />
          ) : initials(farmer?.full_name) ? (
            <Text style={{ fontFamily: fonts.semibold, fontSize: 15 }} color={colors.brand}>
              {initials(farmer?.full_name)}
            </Text>
          ) : (
            <Feather name="user" size={18} color={colors.brand} />
          )}
        </Pressable>
      </View>

      {/* Scan hero */}
      <View style={styles.hero}>
        <Image source={require('@/assets/onboarding/slide-1-diagnose.jpg')} style={StyleSheet.absoluteFill} contentFit="cover" />
        <LinearGradient
          colors={['rgba(8,24,14,0.15)', 'rgba(8,24,14,0.85)']}
          locations={[0, 0.85]}
          style={StyleSheet.absoluteFill}
        />
        <View style={styles.heroBody}>
          <Text variant="overline" color="rgba(255,255,255,0.8)">
            Crop doctor
          </Text>
          <Text style={styles.heroTitle} color={colors.white}>
            Is something wrong with your crop?
          </Text>
          <Text variant="small" color="rgba(255,255,255,0.85)" style={{ marginBottom: spacing.lg }}>
            Take a photo of one leaf. Get a diagnosis and a treatment plan.
          </Text>
          <Button label="Scan a plant" icon="camera" variant="inverse" size="md" onPress={() => router.push('/(tabs)/diagnose')} style={{ alignSelf: 'flex-start' }} />
        </View>
      </View>

      {/* Weather */}
      <Card onPress={() => router.push('/(tabs)/weather')} style={{ marginTop: spacing.lg }} accessibilityLabel="Open weather">
        {weather.isLoading || !location.coords ? (
          <View style={{ flexDirection: 'row', gap: spacing.md, alignItems: 'center' }}>
            <Skeleton width={44} height={44} rounded={22} />
            <View style={{ flex: 1, gap: 6 }}>
              <Skeleton width="50%" height={14} />
              <Skeleton width="70%" height={12} />
            </View>
          </View>
        ) : weather.data ? (
          <View style={styles.weatherRow}>
            <View style={styles.weatherIcon}>
              <Feather name={cond.icon} size={22} color={colors.sun} />
            </View>
            <View style={{ flex: 1 }}>
              <Text variant="bodyStrong">
                {weather.data.current?.temperature_c != null ? `${Math.round(weather.data.current.temperature_c)}°` : '—'} · {cond.label}
              </Text>
              <Text variant="small" color={colors.inkMuted} numberOfLines={1}>
                {location.label ?? 'Your area'}
                {today?.precipitation_probability_pct != null ? ` · ${Math.round(today.precipitation_probability_pct)}% chance of rain` : ''}
              </Text>
            </View>
            <Feather name="chevron-right" size={18} color={colors.inkFaint} />
          </View>
        ) : (
          <View style={styles.weatherRow}>
            <Feather name="cloud-off" size={20} color={colors.inkMuted} />
            <Text variant="small" color={colors.inkSoft} style={{ flex: 1 }}>
              Weather is unavailable right now. Tap to retry.
            </Text>
          </View>
        )}
      </Card>

      {/* Activity */}
      <SectionHeader title="Your activity" />
      <Card padded={false}>
        <View style={styles.stats}>
          <Stat value={stats.data?.total} label="Scans" loading={stats.isLoading} />
          <View style={styles.statRule} />
          <Stat value={stats.data?.issues_found} label="Problems found" loading={stats.isLoading} />
          <View style={styles.statRule} />
          <Stat value={stats.data?.healthy} label="Healthy" loading={stats.isLoading} />
        </View>
      </Card>

      {/* Recent */}
      {recent.data && recent.data.length > 0 ? (
        <>
          <SectionHeader title="Recent scans" action="See all" onAction={() => router.push('/(tabs)/history')} />
          <Card padded={false}>
            {recent.data.map((d, i) => (
              <View key={d.id}>
                {i > 0 ? <Divider inset={spacing.lg + 52 + spacing.md} /> : null}
                <DiagnosisRow item={d} />
              </View>
            ))}
          </Card>
        </>
      ) : null}

      {/* Market snapshot */}
      {marketCrop && topPrices.length > 0 ? (
        <>
          <SectionHeader title={`${marketCrop.name} prices`} action="Market" onAction={() => router.push('/(tabs)/prices')} />
          <Card padded={false}>
            {topPrices.map((p, i) => (
              <View key={p.market_name}>
                {i > 0 ? <Divider inset={spacing.lg} /> : null}
                <View style={styles.priceRow}>
                  <View style={{ flex: 1 }}>
                    <Text variant="bodyStrong" numberOfLines={1}>
                      {p.market_name.replace(/ (Central )?Market$/, '')}
                    </Text>
                    <Text variant="caption" color={colors.inkMuted}>
                      {p.region}
                    </Text>
                  </View>
                  <Text variant="bodyStrong" tabular>
                    {formatCedis(p.price_per_kg)}
                    <Text variant="caption" color={colors.inkMuted}>
                      {' '}/kg
                    </Text>
                  </Text>
                </View>
              </View>
            ))}
          </Card>
        </>
      ) : null}

      {/* Tip */}
      <View style={styles.tip}>
        <Feather name="sun" size={16} color={colors.brand} style={{ marginTop: 2 }} />
        <Text variant="small" color={colors.brandDeep} style={{ flex: 1 }}>
          For the most accurate result, photograph a single leaf in daylight, filling most of the frame.
        </Text>
      </View>
    </ScrollView>
  );
}

function Stat({ value, label, loading }: { value?: number; label: string; loading?: boolean }) {
  return (
    <View style={{ flex: 1, alignItems: 'center', gap: 2, paddingVertical: spacing.lg }}>
      {loading ? (
        <Skeleton width={28} height={26} />
      ) : (
        <Text style={{ fontFamily: fonts.display, fontSize: 26, lineHeight: 30 }} tabular>
          {value ?? 0}
        </Text>
      )}
      <Text variant="caption" color={colors.inkMuted} align="center">
        {label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.md, marginBottom: spacing.xl },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.brandTint,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  hero: { height: 300, borderRadius: radius.xl, overflow: 'hidden', backgroundColor: colors.brandDeep },
  heroBody: { flex: 1, justifyContent: 'flex-end', padding: spacing.xl, gap: spacing.xs },
  heroTitle: { fontFamily: fonts.display, fontSize: 26, lineHeight: 31, letterSpacing: -0.5, marginBottom: 2 },
  weatherRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  weatherIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.warningTint,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stats: { flexDirection: 'row', alignItems: 'center' },
  statRule: { width: StyleSheet.hairlineWidth, alignSelf: 'stretch', marginVertical: spacing.lg, backgroundColor: colors.hairline },
  priceRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: spacing.lg, paddingVertical: spacing.md + 2 },
  tip: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.xxl,
    padding: spacing.lg,
    borderRadius: radius.md,
    backgroundColor: colors.brandTint,
  },
});
