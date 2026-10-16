import { Feather } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { FlatList, Pressable, RefreshControl, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useState } from 'react';

import { getErrorMessage } from '@/api/client';
import { usePlots } from '@/api/hooks';
import type { FarmPlot } from '@/api/types';
import { AnimatedBar, Enter } from '@/components/motion';
import { Button } from '@/components/ui/Button';
import { StackHeader } from '@/components/ui/Header';
import { EmptyState, ErrorState, Skeleton, Tag } from '@/components/ui/Layout';
import { Text } from '@/components/ui/Text';
import { colors, fonts, radius, shadows, spacing } from '@/constants/theme';
import { seasonProgress } from '@/lib/agronomy';

export default function FarmsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const q = usePlots();
  const [refreshing, setRefreshing] = useState(false);

  const total = (q.data ?? []).reduce((s, p) => s + (p.size_acres ?? 0), 0);

  return (
    <View style={{ flex: 1, backgroundColor: colors.canvas }}>
      <StackHeader title="My farms" />
      <FlatList
        data={q.data ?? []}
        keyExtractor={(p) => p.id}
        contentContainerStyle={{ paddingHorizontal: spacing.gutter, paddingBottom: insets.bottom + 120, gap: spacing.md, flexGrow: 1 }}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={async () => {
              setRefreshing(true);
              await q.refetch();
              setRefreshing(false);
            }}
            tintColor={colors.brand}
            colors={[colors.brand]}
          />
        }
        ListHeaderComponent={
          q.data && q.data.length ? (
            <Enter style={{ marginBottom: spacing.sm }}>
              <Text variant="title">Your fields</Text>
              <Text variant="body" color={colors.inkSoft} style={{ marginTop: 4 }}>
                {q.data.length} {q.data.length === 1 ? 'field' : 'fields'}
                {total ? ` · ${total % 1 ? total.toFixed(1) : total} acres` : ''}
              </Text>
            </Enter>
          ) : null
        }
        renderItem={({ item, index }) => (
          <Enter index={index}>
            <PlotCard plot={item} onPress={() => router.push({ pathname: '/farms/edit', params: { id: item.id } })} />
          </Enter>
        )}
        ListEmptyComponent={
          q.isLoading ? (
            <View style={{ gap: spacing.md }}>
              <Skeleton height={150} rounded={radius.lg} />
              <Skeleton height={150} rounded={radius.lg} />
            </View>
          ) : q.isError ? (
            <ErrorState message={getErrorMessage(q.error)} onRetry={() => q.refetch()} />
          ) : (
            <EmptyState
              icon="map"
              title="Add your first field"
              message="Record what you planted and when. AgroSense tracks the season and uses the field’s location for weather advice."
              actionLabel="Add a field"
              onAction={() => router.push('/farms/edit')}
            />
          )
        }
      />
      {q.data && q.data.length ? (
        <View style={[styles.fab, { bottom: insets.bottom + spacing.lg }]}>
          <Button label="Add a field" icon="plus" onPress={() => router.push('/farms/edit')} />
        </View>
      ) : null}
    </View>
  );
}

function PlotCard({ plot, onPress }: { plot: FarmPlot; onPress: () => void }) {
  const season = seasonProgress(plot.planting_date, plot.expected_harvest_date);
  const ready = season?.until != null && season.until <= 0;
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${plot.name}, edit`}
      style={({ pressed }) => [styles.card, pressed && { transform: [{ scale: 0.985 }] }]}
    >
      <View style={styles.cardTop}>
        <View style={styles.icon}>
          <Feather name="map" size={18} color={colors.brand} />
        </View>
        <View style={{ flex: 1 }}>
          <Text variant="subheading" numberOfLines={1}>
            {plot.name}
          </Text>
          <Text variant="small" color={colors.inkMuted}>
            {[plot.crop_name ?? 'No crop set', plot.size_acres ? `${plot.size_acres} acres` : null, plot.irrigation_type]
              .filter(Boolean)
              .join(' · ')}
          </Text>
        </View>
        {plot.gps_lat != null ? <Tag label="Mapped" fg={colors.info} bg={colors.infoTint} icon="map-pin" /> : null}
      </View>

      {season ? (
        <View style={{ gap: spacing.sm, marginTop: spacing.lg }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' }}>
            <Text variant="smallStrong">
              {season.since < 0 ? `Planting in ${-season.since} days` : `Day ${season.since} of the season`}
            </Text>
            {season.until != null ? (
              <Text variant="smallStrong" color={ready ? colors.success : colors.inkMuted}>
                {ready ? 'Ready to harvest' : `${season.until} days to harvest`}
              </Text>
            ) : null}
          </View>
          {season.progress != null ? <AnimatedBar value={season.progress} color={ready ? colors.success : colors.sun} /> : null}
        </View>
      ) : (
        <Text variant="small" color={colors.inkMuted} style={{ marginTop: spacing.md }}>
          Add a planting date to track this season.
        </Text>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    padding: spacing.lg,
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.hairline,
    ...shadows.soft,
  },
  cardTop: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  icon: { width: 40, height: 40, borderRadius: radius.sm, backgroundColor: colors.brandTint, alignItems: 'center', justifyContent: 'center' },
  fab: { position: 'absolute', left: spacing.gutter, right: spacing.gutter },
  big: { fontFamily: fonts.display },
});
