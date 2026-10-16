import { Feather } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';

import type { DiagnosisListItem } from '@/api/types';
import { Tag } from '@/components/ui/Layout';
import { Text } from '@/components/ui/Text';
import { colors, radius, spacing } from '@/constants/theme';
import { timeAgo } from '@/lib/format';

export function DiagnosisRow({ item }: { item: DiagnosisListItem }) {
  const router = useRouter();
  const pct = Math.round(item.confidence * 100);
  return (
    <Pressable
      onPress={() => router.push(`/diagnosis/${item.id}`)}
      accessibilityRole="button"
      accessibilityLabel={`${item.crop_name}, ${item.predicted_disease}, ${timeAgo(item.created_at)}`}
      style={({ pressed }) => [styles.row, pressed && { backgroundColor: colors.canvas }]}
    >
      <View style={styles.thumb}>
        {item.image_url ? (
          <Image source={{ uri: item.image_url }} style={StyleSheet.absoluteFill} contentFit="cover" transition={150} cachePolicy="disk" />
        ) : (
          <Feather name={item.channel === 'sms' ? 'message-square' : 'image'} size={20} color={colors.inkFaint} />
        )}
      </View>
      <View style={{ flex: 1, gap: 3 }}>
        <Text variant="bodyStrong" numberOfLines={1}>
          {item.is_healthy ? 'No disease found' : item.predicted_disease}
        </Text>
        <Text variant="small" color={colors.inkMuted} numberOfLines={1}>
          {item.crop_name} · {timeAgo(item.created_at)}
          {item.channel === 'sms' ? ' · via SMS' : ''}
        </Text>
      </View>
      {pct < 60 ? (
        <Tag label="Unsure" fg={colors.warning} bg={colors.warningTint} />
      ) : item.is_healthy ? (
        <Tag label="Healthy" fg={colors.success} bg={colors.successTint} />
      ) : (
        <Tag label={`${pct}%`} fg={colors.inkSoft} bg={colors.surfaceSunken} />
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
  },
  thumb: {
    width: 52,
    height: 52,
    borderRadius: radius.sm,
    backgroundColor: colors.surfaceSunken,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
