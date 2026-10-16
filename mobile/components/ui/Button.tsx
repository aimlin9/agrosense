import { Feather } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { ReactNode, useRef } from 'react';
import { ActivityIndicator, Animated, Pressable, StyleProp, StyleSheet, View, ViewStyle } from 'react-native';

import { Text } from '@/components/ui/Text';
import { colors, fonts, radius, spacing } from '@/constants/theme';

type Variant = 'primary' | 'secondary' | 'ghost' | 'ghostInverse' | 'danger' | 'inverse';

interface Props {
  label: string;
  onPress?: () => void;
  variant?: Variant;
  loading?: boolean;
  disabled?: boolean;
  icon?: keyof typeof Feather.glyphMap;
  iconRight?: keyof typeof Feather.glyphMap;
  leading?: ReactNode;
  size?: 'lg' | 'md' | 'sm';
  style?: StyleProp<ViewStyle>;
  haptic?: boolean;
  accessibilityHint?: string;
}

const palette: Record<Variant, { bg: string; fg: string; border: string }> = {
  primary: { bg: colors.brand, fg: colors.white, border: colors.brand },
  secondary: { bg: colors.surface, fg: colors.ink, border: colors.hairlineStrong },
  ghost: { bg: 'transparent', fg: colors.brand, border: 'transparent' },
  ghostInverse: { bg: 'transparent', fg: colors.white, border: 'transparent' },
  danger: { bg: colors.surface, fg: colors.danger, border: colors.dangerTint },
  inverse: { bg: colors.white, fg: colors.brandDeep, border: colors.white },
};

const heights = { lg: 56, md: 48, sm: 38 };

export function Button({
  label,
  onPress,
  variant = 'primary',
  loading,
  disabled,
  icon,
  iconRight,
  leading,
  size = 'lg',
  style,
  haptic = true,
  accessibilityHint,
}: Props) {
  const scale = useRef(new Animated.Value(1)).current;
  const p = palette[variant];
  const inactive = disabled || loading;

  const animate = (to: number) =>
    Animated.spring(scale, { toValue: to, useNativeDriver: true, speed: 40, bounciness: 0 }).start();

  return (
    <Animated.View style={[{ transform: [{ scale }] }, style]}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={label}
        accessibilityHint={accessibilityHint}
        accessibilityState={{ disabled: !!inactive, busy: !!loading }}
        disabled={inactive}
        onPressIn={() => animate(0.98)}
        onPressOut={() => animate(1)}
        onPress={() => {
          if (haptic) Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
          onPress?.();
        }}
        style={({ pressed }) => [
          styles.base,
          {
            height: heights[size],
            backgroundColor: p.bg,
            borderColor: p.border,
            opacity: disabled && !loading ? 0.45 : pressed ? 0.88 : 1,
            paddingHorizontal: size === 'sm' ? spacing.md : spacing.xl,
          },
        ]}
      >
        {loading ? (
          <ActivityIndicator color={p.fg} />
        ) : (
          <View style={styles.row}>
            {leading}
            {icon ? <Feather name={icon} size={size === 'sm' ? 16 : 18} color={p.fg} /> : null}
            <Text
              style={{ fontFamily: fonts.semibold, fontSize: size === 'sm' ? 14 : 16, letterSpacing: -0.1 }}
              color={p.fg}
              numberOfLines={1}
            >
              {label}
            </Text>
            {iconRight ? <Feather name={iconRight} size={size === 'sm' ? 16 : 18} color={p.fg} /> : null}
          </View>
        )}
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  base: {
    borderRadius: radius.md,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
});
