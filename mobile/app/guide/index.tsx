import { Feather } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { FlatList, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { getErrorMessage } from '@/api/client';
import { useGuide } from '@/api/hooks';
import type { GuideSummary } from '@/api/types';
import { Enter } from '@/components/motion';
import { StackHeader } from '@/components/ui/Header';
import { Chip, EmptyState, ErrorState, Skeleton, Tag } from '@/components/ui/Layout';
import { Text } from '@/components/ui/Text';
import { colors, fonts, radius, severityStyle, spacing } from '@/constants/theme';

const CROP_ORDER = ['Tomato', 'Maize', 'Bell pepper', 'Potato', 'Orange'];

export default function GuideScreen() {
  const insets = useSafeAreaInsets();
  const q = useGuide();
  const [crop, setCrop] = useState<string>('All');
  const [query, setQuery] = useState('');

  const crops = useMemo(() => {
    const names = Array.from(new Set((q.data ?? []).map((e) => e.crop)));
    return ['All', ...names.sort((a, b) => {
      const ia = CROP_ORDER.indexOf(a);
      const ib = CROP_ORDER.indexOf(b);
      return (ia < 0 ? 99 : ia) - (ib < 0 ? 99 : ib) || a.localeCompare(b);
    })];
  }, [q.data]);

  const items = useMemo(() => {
    const s = query.trim().toLowerCase();
    return (q.data ?? []).filter(
      (e) =>
        (crop === 'All' || e.crop === crop) &&
        (!s || `${e.name} ${e.crop} ${e.pathogen} ${e.summary}`.toLowerCase().includes(s)),
    );
  }, [q.data, crop, query]);

  return (
    <View style={{ flex: 1, backgroundColor: colors.canvas }}>
      <StackHeader title="Crop guide" />
      <FlatList
        data={items}
        keyExtractor={(e) => e.slug}
        contentContainerStyle={{ paddingHorizontal: spacing.gutter, paddingBottom: insets.bottom + spacing.xxxl, gap: spacing.md }}
        keyboardShouldPersistTaps="handled"
        ListHeaderComponent={
          <View style={{ gap: spacing.lg, marginBottom: spacing.sm }}>
            <Enter>
              <Text variant="title">Know the enemy.</Text>
              <Text variant="body" color={colors.inkSoft} style={{ marginTop: spacing.xs }}>
                Symptoms, causes and treatment for every disease AgroSense can recognise.
              </Text>
            </Enter>
            <Enter index={1}>
              <View style={styles.search}>
                <Feather name="search" size={17} color={colors.inkMuted} />
                <TextInput
                  value={query}
                  onChangeText={setQuery}
                  placeholder="Search diseases, symptoms…"
                  placeholderTextColor={colors.inkFaint}
                  style={styles.searchInput}
                  autoCorrect={false}
                  returnKeyType="search"
                />
                {query ? (
                  <Pressable onPress={() => setQuery('')} hitSlop={10} accessibilityLabel="Clear search">
                    <Feather name="x-circle" size={17} color={colors.inkMuted} />
                  </Pressable>
                ) : null}
              </View>
            </Enter>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: spacing.sm }} style={{ marginHorizontal: -spacing.gutter }}>
              <View style={{ width: spacing.gutter - spacing.sm }} />
              {crops.map((c) => (
                <Chip key={c} label={c} selected={c === crop} onPress={() => setCrop(c)} />
              ))}
              <View style={{ width: spacing.gutter - spacing.sm }} />
            </ScrollView>
          </View>
        }
        renderItem={({ item, index }) => (
          <Enter index={index}>
            <GuideCard item={item} />
          </Enter>
        )}
        ListEmptyComponent={
          q.isLoading ? (
            <View style={{ gap: spacing.md }}>
              {Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} height={112} rounded={radius.lg} />
              ))}
            </View>
          ) : q.isError ? (
            <ErrorState message={getErrorMessage(q.error)} onRetry={() => q.refetch()} />
          ) : (
            <EmptyState icon="search" title="No matches" message="Try another word, or choose a different crop." />
          )
        }
      />
    </View>
  );
}

function GuideCard({ item }: { item: GuideSummary }) {
  const router = useRouter();
  const sev = severityStyle(item.severity);
  return (
    <Pressable
      onPress={() => router.push({ pathname: '/guide/[slug]', params: { slug: item.slug } })}
      accessibilityRole="button"
      accessibilityLabel={`${item.crop} ${item.name}`}
      style={({ pressed }) => [styles.card, pressed && { transform: [{ scale: 0.985 }], opacity: 0.92 }]}
    >
      <View style={[styles.mark, { backgroundColor: sev.bg }]}>
        <Text style={{ fontFamily: fonts.display, fontSize: 20 }} color={sev.fg}>
          {item.name.charAt(0)}
        </Text>
      </View>
      <View style={{ flex: 1, gap: 4 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
          <Text variant="caption" color={colors.inkMuted}>
            {item.crop} · {item.type}
          </Text>
        </View>
        <Text variant="subheading">{item.name}</Text>
        <Text variant="small" color={colors.inkSoft} numberOfLines={2}>
          {item.summary}
        </Text>
        <View style={{ marginTop: 4 }}>
          <Tag label={sev.label} fg={sev.fg} bg={sev.bg} />
        </View>
      </View>
      <Feather name="chevron-right" size={18} color={colors.inkFaint} style={{ alignSelf: 'center' }} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  search: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.hairline,
    paddingHorizontal: spacing.lg,
    minHeight: 50,
  },
  searchInput: { flex: 1, fontFamily: fonts.regular, fontSize: 15, color: colors.ink, paddingVertical: 12 },
  card: {
    flexDirection: 'row',
    gap: spacing.md,
    padding: spacing.lg,
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.hairline,
  },
  mark: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
});
