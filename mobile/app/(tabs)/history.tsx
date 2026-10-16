import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, FlatList, RefreshControl, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { getErrorMessage } from '@/api/client';
import { useDiagnosisHistory } from '@/api/hooks';
import { DiagnosisRow } from '@/components/DiagnosisRow';
import { ScreenTitle } from '@/components/ui/Header';
import { Chip, EmptyState, ErrorState, Skeleton } from '@/components/ui/Layout';
import { colors, radius, spacing } from '@/constants/theme';

type Filter = 'all' | 'problems' | 'healthy';

export default function HistoryScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const q = useDiagnosisHistory();
  const [filter, setFilter] = useState<Filter>('all');
  const [refreshing, setRefreshing] = useState(false);
  const firstFocus = useRef(true);

  // Refresh when returning to the tab (e.g. after a new scan elsewhere).
  useFocusEffect(
    useCallback(() => {
      if (firstFocus.current) {
        firstFocus.current = false;
        return;
      }
      q.refetch();
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []),
  );

  const all = useMemo(() => q.data?.pages.flat() ?? [], [q.data]);
  const items = useMemo(
    () => (filter === 'all' ? all : all.filter((d) => (filter === 'healthy' ? d.is_healthy : !d.is_healthy))),
    [all, filter],
  );

  const onRefresh = async () => {
    setRefreshing(true);
    await q.refetch();
    setRefreshing(false);
  };

  const header = (
    <View style={{ paddingTop: insets.top + spacing.lg }}>
      <ScreenTitle eyebrow="History" title="Your scans" subtitle={all.length ? `${all.length}${q.hasNextPage ? '+' : ''} saved diagnoses` : null} />
      {all.length > 0 ? (
        <View style={styles.filters}>
          <Chip label="All" selected={filter === 'all'} onPress={() => setFilter('all')} />
          <Chip label="Problems" selected={filter === 'problems'} onPress={() => setFilter('problems')} />
          <Chip label="Healthy" selected={filter === 'healthy'} onPress={() => setFilter('healthy')} />
        </View>
      ) : null}
    </View>
  );

  if (q.isLoading) {
    return (
      <View style={styles.screen}>
        <View style={{ paddingHorizontal: spacing.gutter }}>{header}</View>
        <View style={{ paddingHorizontal: spacing.gutter, gap: spacing.md }}>
          {Array.from({ length: 5 }).map((_, i) => (
            <View key={i} style={{ flexDirection: 'row', gap: spacing.md, alignItems: 'center' }}>
              <Skeleton width={52} height={52} rounded={radius.sm} />
              <View style={{ flex: 1, gap: 6 }}>
                <Skeleton width="60%" height={14} />
                <Skeleton width="40%" height={12} />
              </View>
            </View>
          ))}
        </View>
      </View>
    );
  }

  return (
    <FlatList
      style={styles.screen}
      contentContainerStyle={{ paddingHorizontal: spacing.gutter, paddingBottom: spacing.xxxl, flexGrow: 1 }}
      data={items}
      keyExtractor={(d) => d.id}
      ListHeaderComponent={header}
      renderItem={({ item, index }) => (
        <View
          style={[
            styles.item,
            index === 0 && styles.first,
            index === items.length - 1 && styles.last,
          ]}
        >
          {index > 0 ? <View style={styles.sep} /> : null}
          <DiagnosisRow item={item} />
        </View>
      )}
      onEndReachedThreshold={0.4}
      onEndReached={() => q.hasNextPage && !q.isFetchingNextPage && q.fetchNextPage()}
      ListFooterComponent={q.isFetchingNextPage ? <ActivityIndicator color={colors.brand} style={{ marginTop: spacing.lg }} /> : null}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.brand} colors={[colors.brand]} />}
      ListEmptyComponent={
        q.isError ? (
          <ErrorState message={getErrorMessage(q.error)} onRetry={() => q.refetch()} />
        ) : all.length === 0 ? (
          <EmptyState
            icon="camera"
            title="No scans yet"
            message="When you photograph a plant, the diagnosis and treatment plan are saved here so you can come back to them."
            actionLabel="Scan your first plant"
            onAction={() => router.push('/(tabs)/diagnose')}
          />
        ) : (
          <EmptyState icon="filter" title="Nothing here" message="No scans match this filter." />
        )
      }
    />
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.canvas },
  filters: { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.lg },
  item: {
    backgroundColor: colors.surface,
    borderLeftWidth: StyleSheet.hairlineWidth,
    borderRightWidth: StyleSheet.hairlineWidth,
    borderColor: colors.hairline,
  },
  first: { borderTopWidth: StyleSheet.hairlineWidth, borderTopLeftRadius: radius.lg, borderTopRightRadius: radius.lg, overflow: 'hidden' },
  last: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomLeftRadius: radius.lg, borderBottomRightRadius: radius.lg, overflow: 'hidden' },
  sep: { height: StyleSheet.hairlineWidth, backgroundColor: colors.hairline, marginLeft: spacing.lg + 52 + spacing.md },
});
