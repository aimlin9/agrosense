import { Feather } from '@expo/vector-icons';
import { useEffect, useMemo, useState } from 'react';
import { RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { getErrorMessage } from '@/api/client';
import { useLatestPrices } from '@/api/hooks';
import type { LatestPrice } from '@/api/types';
import { Sparkline } from '@/components/DataViz';
import { Enter } from '@/components/motion';
import { ScreenTitle } from '@/components/ui/Header';
import { Card, Chip, EmptyState, ErrorState, SectionHeader, Skeleton } from '@/components/ui/Layout';
import { Text } from '@/components/ui/Text';
import { colors, fonts, radius, spacing } from '@/constants/theme';
import { formatCedis, timeAgo } from '@/lib/format';
import { useAuthStore } from '@/store/authStore';

const shortMarket = (m: string) => m.replace(/ (Central )?Market$/, '');

export default function PricesScreen() {
  const insets = useSafeAreaInsets();
  const farmer = useAuthStore((s) => s.farmer);
  const q = useLatestPrices(null);
  const [crop, setCrop] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const cropNames = useMemo(() => {
    const names = Array.from(new Set((q.data ?? []).map((p) => p.crop_name)));
    const first = ['Tomato', 'Maize', 'Bell pepper', 'Potato', 'Orange'];
    return names.sort((a, b) => {
      const ia = first.indexOf(a);
      const ib = first.indexOf(b);
      return (ia < 0 ? 99 : ia) - (ib < 0 ? 99 : ib) || a.localeCompare(b);
    });
  }, [q.data]);

  useEffect(() => {
    if (crop || !cropNames.length) return;
    const wanted = (farmer?.primary_crop ?? '').toLowerCase();
    setCrop(cropNames.find((c) => c.toLowerCase() === wanted) ?? cropNames[0]);
  }, [cropNames, crop, farmer?.primary_crop]);

  const rows = useMemo(
    () => (q.data ?? []).filter((p) => p.crop_name === crop).sort((a, b) => +b.price_per_kg - +a.price_per_kg),
    [q.data, crop],
  );
  const avg = rows.length ? rows.reduce((s, p) => s + parseFloat(p.price_per_kg), 0) / rows.length : null;
  const best = rows[0];
  const cheapest = rows[rows.length - 1];
  const indicative = rows.some((p) => p.source === 'indicative' || p.source === 'seeded');
  const updated = rows.reduce<string | null>((m, p) => (!m || p.recorded_at > m ? p.recorded_at : m), null);

  const onRefresh = async () => {
    setRefreshing(true);
    await q.refetch();
    setRefreshing(false);
  };

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.canvas }}
      contentContainerStyle={{ paddingTop: insets.top + spacing.lg, paddingBottom: spacing.xxxl }}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.brand} colors={[colors.brand]} />}
      showsVerticalScrollIndicator={false}
    >
      <View style={{ paddingHorizontal: spacing.gutter }}>
        <ScreenTitle eyebrow="Market" title="Crop prices" subtitle="Price per kilogram across major Ghanaian markets." />
      </View>

      {cropNames.length > 0 ? (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
          {cropNames.map((c) => (
            <Chip key={c} label={c} selected={c === crop} onPress={() => setCrop(c)} />
          ))}
        </ScrollView>
      ) : null}

      <View style={{ paddingHorizontal: spacing.gutter }}>
        {q.isLoading ? (
          <View style={{ gap: spacing.md }}>
            <Skeleton height={150} rounded={radius.lg} />
            <Skeleton height={260} rounded={radius.lg} />
          </View>
        ) : q.isError ? (
          <ErrorState message={getErrorMessage(q.error)} onRetry={() => q.refetch()} />
        ) : rows.length === 0 ? (
          <EmptyState icon="bar-chart-2" title="No prices yet" message="We don’t have recent prices for this crop. Pull down to refresh." />
        ) : (
          <>
            <Enter key={crop ?? 'none'}>
            <View style={styles.summary}>
              <Text variant="overline" color="rgba(255,255,255,0.7)">
                {crop} · average
              </Text>
              <Text style={styles.avg} color={colors.white} tabular>
                {formatCedis(avg)}
                <Text style={styles.avgUnit} color="rgba(255,255,255,0.7)">
                  {' '}/kg
                </Text>
              </Text>
              <View style={styles.summaryRow}>
                <SummaryStat icon="arrow-up-right" label="Best place to sell" value={`${shortMarket(best.market_name)} · ${formatCedis(best.price_per_kg)}`} />
                <SummaryStat icon="arrow-down-left" label="Cheapest to buy" value={`${shortMarket(cheapest.market_name)} · ${formatCedis(cheapest.price_per_kg)}`} />
              </View>
            </View>
            </Enter>

            <SectionHeader title="By market" />
            <Card padded={false}>
              {rows.map((p, i) => (
                <Enter key={`${crop}-${p.market_name}`} index={i} step={50}>
                  {i > 0 ? <View style={styles.rule} /> : null}
                  <MarketRow p={p} />
                </Enter>
              ))}
            </Card>

            <Text variant="caption" color={colors.inkMuted} style={{ marginTop: spacing.lg }}>
              {indicative
                ? 'Indicative wholesale prices, updated daily. Prices at the market gate can differ — confirm before you travel.'
                : 'Wholesale prices reported by market surveyors.'}
              {updated ? ` Updated ${timeAgo(updated).toLowerCase()}.` : ''}
            </Text>
          </>
        )}
      </View>
    </ScrollView>
  );
}

function SummaryStat({ icon, label, value }: { icon: keyof typeof Feather.glyphMap; label: string; value: string }) {
  return (
    <View style={{ flex: 1, gap: 2 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
        <Feather name={icon} size={12} color="rgba(255,255,255,0.7)" />
        <Text variant="caption" color="rgba(255,255,255,0.7)">
          {label}
        </Text>
      </View>
      <Text variant="smallStrong" color={colors.white} numberOfLines={1}>
        {value}
      </Text>
    </View>
  );
}

function MarketRow({ p }: { p: LatestPrice }) {
  const change = p.change_pct_7d;
  const tone = p.trend === 'up' ? colors.success : p.trend === 'down' ? colors.danger : colors.inkMuted;
  const icon = p.trend === 'up' ? 'trending-up' : p.trend === 'down' ? 'trending-down' : 'minus';
  return (
    <View style={styles.row} accessible accessibilityLabel={`${p.market_name}, ${formatCedis(p.price_per_kg)} per kilogram`}>
      <View style={{ flex: 1, gap: 2 }}>
        <Text variant="bodyStrong" numberOfLines={1}>
          {shortMarket(p.market_name)}
        </Text>
        <Text variant="caption" color={colors.inkMuted}>
          {p.region}
        </Text>
      </View>
      <Sparkline values={p.history.map(Number)} color={tone} width={64} height={26} />
      <View style={{ alignItems: 'flex-end', minWidth: 86 }}>
        <Text variant="bodyStrong" tabular>
          {formatCedis(p.price_per_kg)}
        </Text>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3 }}>
          <Feather name={icon} size={12} color={tone} />
          <Text variant="caption" color={tone} tabular>
            {change == null ? 'steady' : `${change > 0 ? '+' : ''}${change.toFixed(1)}% wk`}
          </Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  chips: { gap: spacing.sm, paddingHorizontal: spacing.gutter, paddingBottom: spacing.lg },
  summary: { backgroundColor: colors.brand, borderRadius: radius.lg, padding: spacing.xl, gap: spacing.xs },
  avg: { fontFamily: fonts.display, fontSize: 40, lineHeight: 46, letterSpacing: -1 },
  avgUnit: { fontFamily: fonts.medium, fontSize: 15 },
  summaryRow: { flexDirection: 'row', gap: spacing.lg, marginTop: spacing.md },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingHorizontal: spacing.lg, paddingVertical: spacing.md + 2 },
  rule: { height: StyleSheet.hairlineWidth, backgroundColor: colors.hairline, marginLeft: spacing.lg },
});
