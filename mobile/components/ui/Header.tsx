import { Feather } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { ReactNode } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Text } from '@/components/ui/Text';
import { colors, spacing } from '@/constants/theme';

/** Large-title header for tab screens. */
export function ScreenTitle({
  eyebrow,
  title,
  subtitle,
  right,
}: {
  eyebrow?: string;
  title: string;
  subtitle?: string | null;
  right?: ReactNode;
}) {
  return (
    <View style={styles.titleRow}>
      <View style={{ flex: 1, gap: 2 }}>
        {eyebrow ? (
          <Text variant="overline" color={colors.inkMuted}>
            {eyebrow}
          </Text>
        ) : null}
        <Text variant="title" accessibilityRole="header">
          {title}
        </Text>
        {subtitle ? (
          <Text variant="small" color={colors.inkSoft}>
            {subtitle}
          </Text>
        ) : null}
      </View>
      {right}
    </View>
  );
}

/** Compact header for pushed screens, with a back button. */
export function StackHeader({
  title,
  right,
  transparent,
  onBack,
}: {
  title?: string;
  right?: ReactNode;
  transparent?: boolean;
  onBack?: () => void;
}) {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const back = onBack ?? (() => (router.canGoBack() ? router.back() : router.replace('/(tabs)')));
  return (
    <View
      style={[
        styles.stack,
        { paddingTop: insets.top + spacing.xs },
        transparent ? styles.stackTransparent : { backgroundColor: colors.canvas },
      ]}
    >
      <Pressable
        onPress={back}
        hitSlop={12}
        accessibilityRole="button"
        accessibilityLabel="Go back"
        style={[styles.iconBtn, transparent && styles.iconBtnOnImage]}
      >
        <Feather name="arrow-left" size={20} color={transparent ? colors.white : colors.ink} />
      </Pressable>
      <Text variant="subheading" numberOfLines={1} style={{ flex: 1, textAlign: 'center' }} color={transparent ? colors.white : colors.ink}>
        {title ?? ''}
      </Text>
      <View style={{ minWidth: 40, alignItems: 'flex-end' }}>{right}</View>
    </View>
  );
}

export function IconButton({
  icon,
  onPress,
  label,
  onImage,
}: {
  icon: keyof typeof Feather.glyphMap;
  onPress: () => void;
  label: string;
  onImage?: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      hitSlop={10}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={({ pressed }) => [styles.iconBtn, onImage && styles.iconBtnOnImage, pressed && { opacity: 0.7 }]}
    >
      <Feather name={icon} size={19} color={onImage ? colors.white : colors.ink} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  titleRow: { flexDirection: 'row', alignItems: 'flex-end', gap: spacing.md, marginBottom: spacing.lg },
  stack: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.sm,
    gap: spacing.sm,
    zIndex: 10,
  },
  stackTransparent: { position: 'absolute', top: 0, left: 0, right: 0 },
  iconBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.hairline,
  },
  iconBtnOnImage: { backgroundColor: 'rgba(10,20,14,0.45)', borderColor: 'transparent' },
});
