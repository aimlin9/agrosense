import { Feather } from '@expo/vector-icons';
import { ReactNode, useEffect, useRef } from 'react';
import { Animated, Pressable, StyleProp, StyleSheet, View, ViewStyle } from 'react-native';

import { Button } from '@/components/ui/Button';
import { Text } from '@/components/ui/Text';
import { colors, radius, shadows, spacing } from '@/constants/theme';

export function Card({
  children,
  style,
  onPress,
  padded = true,
  accessibilityLabel,
}: {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
  onPress?: () => void;
  padded?: boolean;
  accessibilityLabel?: string;
}) {
  const base = [styles.card, padded && { padding: spacing.lg }, style];
  if (!onPress) return <View style={base}>{children}</View>;
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      style={({ pressed }) => [base, pressed && { opacity: 0.85 }]}
    >
      {children}
    </Pressable>
  );
}

export function SectionHeader({
  title,
  action,
  onAction,
  style,
}: {
  title: string;
  action?: string;
  onAction?: () => void;
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <View style={[styles.sectionHeader, style]}>
      <Text variant="overline" color={colors.inkMuted}>
        {title}
      </Text>
      {action && onAction ? (
        <Pressable onPress={onAction} hitSlop={10} accessibilityRole="button">
          <Text variant="smallStrong" color={colors.brand}>
            {action}
          </Text>
        </Pressable>
      ) : null}
    </View>
  );
}

export function ListRow({
  icon,
  label,
  detail,
  onPress,
  destructive,
  trailing,
  showChevron = true,
}: {
  icon?: keyof typeof Feather.glyphMap;
  label: string;
  detail?: string | null;
  onPress?: () => void;
  destructive?: boolean;
  trailing?: ReactNode;
  showChevron?: boolean;
}) {
  const color = destructive ? colors.danger : colors.ink;
  return (
    <Pressable
      onPress={onPress}
      disabled={!onPress}
      accessibilityRole={onPress ? 'button' : undefined}
      style={({ pressed }) => [styles.row, pressed && { backgroundColor: colors.canvas }]}
    >
      {icon ? (
        <View style={[styles.rowIcon, destructive && { backgroundColor: colors.dangerTint }]}>
          <Feather name={icon} size={17} color={destructive ? colors.danger : colors.brand} />
        </View>
      ) : null}
      <View style={{ flex: 1 }}>
        <Text variant="bodyStrong" color={color}>
          {label}
        </Text>
        {detail ? (
          <Text variant="small" color={colors.inkMuted} numberOfLines={1}>
            {detail}
          </Text>
        ) : null}
      </View>
      {trailing}
      {onPress && showChevron ? <Feather name="chevron-right" size={18} color={colors.inkFaint} /> : null}
    </Pressable>
  );
}

export function Divider({ inset = 0 }: { inset?: number }) {
  return <View style={{ height: StyleSheet.hairlineWidth, backgroundColor: colors.hairline, marginLeft: inset }} />;
}

export function Chip({
  label,
  selected,
  onPress,
  muted,
}: {
  label: string;
  selected?: boolean;
  onPress?: () => void;
  muted?: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected: !!selected }}
      style={({ pressed }) => [
        styles.chip,
        selected && styles.chipSelected,
        pressed && !selected && { backgroundColor: colors.surfaceSunken },
      ]}
    >
      <Text
        variant="smallStrong"
        color={selected ? colors.white : muted ? colors.inkMuted : colors.ink}
        numberOfLines={1}
      >
        {label}
      </Text>
    </Pressable>
  );
}

export function Tag({ label, fg, bg, icon }: { label: string; fg: string; bg: string; icon?: keyof typeof Feather.glyphMap }) {
  return (
    <View style={[styles.tag, { backgroundColor: bg }]}>
      {icon ? <Feather name={icon} size={12} color={fg} /> : null}
      <Text variant="caption" color={fg} style={{ fontFamily: 'Inter_600SemiBold' }}>
        {label}
      </Text>
    </View>
  );
}

export function Banner({
  tone = 'info',
  title,
  message,
  icon,
}: {
  tone?: 'info' | 'warning' | 'danger' | 'success';
  title?: string;
  message: string;
  icon?: keyof typeof Feather.glyphMap;
}) {
  const map = {
    info: { fg: colors.info, bg: colors.infoTint, icon: 'info' as const },
    warning: { fg: colors.warning, bg: colors.warningTint, icon: 'alert-triangle' as const },
    danger: { fg: colors.danger, bg: colors.dangerTint, icon: 'alert-octagon' as const },
    success: { fg: colors.success, bg: colors.successTint, icon: 'check-circle' as const },
  }[tone];
  return (
    <View style={[styles.banner, { backgroundColor: map.bg }]} accessibilityRole="alert">
      <Feather name={icon ?? map.icon} size={18} color={map.fg} style={{ marginTop: 1 }} />
      <View style={{ flex: 1, gap: 2 }}>
        {title ? (
          <Text variant="smallStrong" color={map.fg}>
            {title}
          </Text>
        ) : null}
        <Text variant="small" color={colors.ink}>
          {message}
        </Text>
      </View>
    </View>
  );
}

export function Skeleton({ width, height, style, rounded = radius.sm }: { width?: number | `${number}%`; height: number; style?: StyleProp<ViewStyle>; rounded?: number }) {
  const opacity = useRef(new Animated.Value(0.5)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, { toValue: 1, duration: 700, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 0.5, duration: 700, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [opacity]);
  return (
    <Animated.View
      style={[{ width: width ?? '100%', height, borderRadius: rounded, backgroundColor: colors.surfaceSunken, opacity }, style]}
    />
  );
}

export function EmptyState({
  icon,
  title,
  message,
  actionLabel,
  onAction,
}: {
  icon: keyof typeof Feather.glyphMap;
  title: string;
  message: string;
  actionLabel?: string;
  onAction?: () => void;
}) {
  return (
    <View style={styles.state}>
      <View style={styles.stateIcon}>
        <Feather name={icon} size={26} color={colors.brand} />
      </View>
      <Text variant="heading" align="center">
        {title}
      </Text>
      <Text variant="body" color={colors.inkSoft} align="center" style={{ maxWidth: 300 }}>
        {message}
      </Text>
      {actionLabel && onAction ? (
        <Button label={actionLabel} onPress={onAction} size="md" style={{ marginTop: spacing.md, alignSelf: 'center' }} />
      ) : null}
    </View>
  );
}

export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <View style={styles.state}>
      <View style={[styles.stateIcon, { backgroundColor: colors.dangerTint }]}>
        <Feather name="wifi-off" size={24} color={colors.danger} />
      </View>
      <Text variant="subheading" align="center">
        Couldn’t load this
      </Text>
      <Text variant="small" color={colors.inkSoft} align="center" style={{ maxWidth: 300 }}>
        {message}
      </Text>
      {onRetry ? (
        <Button label="Try again" icon="refresh-cw" variant="secondary" size="md" onPress={onRetry} style={{ marginTop: spacing.sm, alignSelf: 'center' }} />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.hairline,
    ...shadows.soft,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.sm + 2,
    marginTop: spacing.xxl,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.md + 2,
    paddingHorizontal: spacing.lg,
    minHeight: 56,
  },
  rowIcon: {
    width: 34,
    height: 34,
    borderRadius: radius.sm,
    backgroundColor: colors.brandTint,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chip: {
    paddingHorizontal: spacing.lg,
    height: 38,
    borderRadius: radius.pill,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.hairline,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chipSelected: { backgroundColor: colors.ink, borderColor: colors.ink },
  tag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
    borderRadius: radius.pill,
    alignSelf: 'flex-start',
  },
  banner: {
    flexDirection: 'row',
    gap: spacing.md,
    padding: spacing.md + 2,
    borderRadius: radius.md,
  },
  state: { alignItems: 'center', justifyContent: 'center', gap: spacing.sm, padding: spacing.xxl, paddingVertical: spacing.xxxl },
  stateIcon: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: colors.brandTint,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.sm,
  },
});
