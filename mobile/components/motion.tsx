/**
 * Motion primitives (Reanimated). One vocabulary for the whole app:
 *   Enter       — staggered fade-and-rise for content as a screen appears
 *   CountUp     — numbers that count up to their value
 *   AnimatedBar — progress / confidence bars that fill in
 *   Pulse       — a soft breathing ring behind a call to action
 *   ScanLine    — the sweeping line shown while a photo is analysed
 * Every animation honours the system "reduce motion" setting.
 */
import { ReactNode, useEffect, useState } from 'react';
import { StyleProp, StyleSheet, TextStyle, View, ViewStyle } from 'react-native';
import Animated, {
  Easing,
  runOnJS,
  useAnimatedReaction,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';

import { Text, TextVariant } from '@/components/ui/Text';
import { colors } from '@/constants/theme';

export const EASE_OUT = Easing.bezier(0.2, 0.7, 0.2, 1);

export function Enter({
  children,
  index = 0,
  style,
  step = 60,
}: {
  children: ReactNode;
  index?: number;
  style?: StyleProp<ViewStyle>;
  step?: number;
}) {
  // Plain animated styles (not layout animations) so layout is never affected:
  // the element occupies its final position from the first frame.
  const reduced = useReducedMotion();
  const t = useSharedValue(reduced ? 1 : 0);
  useEffect(() => {
    if (reduced) return;
    t.value = withDelay(Math.min(index, 10) * step, withTiming(1, { duration: 520, easing: EASE_OUT }));
  }, [index, step, reduced, t]);
  const anim = useAnimatedStyle(() => ({
    opacity: t.value,
    transform: [{ translateY: (1 - t.value) * 14 }],
  }));
  return <Animated.View style={[style, anim]}>{children}</Animated.View>;
}

export function CountUp({
  value,
  variant = 'title',
  style,
  duration = 900,
  format = (n: number) => String(Math.round(n)),
  color,
}: {
  value: number;
  variant?: TextVariant;
  style?: StyleProp<TextStyle>;
  duration?: number;
  format?: (n: number) => string;
  color?: string;
}) {
  const reduced = useReducedMotion();
  const progress = useSharedValue(reduced ? value : 0);
  const [shown, setShown] = useState(reduced ? value : 0);

  useEffect(() => {
    progress.value = reduced ? value : withTiming(value, { duration, easing: EASE_OUT });
  }, [value, duration, reduced, progress]);

  useAnimatedReaction(
    () => progress.value,
    (v, prev) => {
      if (prev === null || Math.round(v * 10) !== Math.round(prev * 10)) runOnJS(setShown)(v);
    },
  );

  return (
    <Text variant={variant} style={style} color={color} tabular>
      {format(shown)}
    </Text>
  );
}

export function AnimatedBar({
  value,
  color = colors.brand,
  track = colors.surfaceSunken,
  height = 6,
  delay = 150,
}: {
  value: number; // 0..1
  color?: string;
  track?: string;
  height?: number;
  delay?: number;
}) {
  const reduced = useReducedMotion();
  const w = useSharedValue(reduced ? value : 0);
  useEffect(() => {
    const target = Math.max(0, Math.min(1, value));
    w.value = reduced ? target : withDelay(delay, withTiming(target, { duration: 900, easing: EASE_OUT }));
  }, [value, delay, reduced, w]);
  const fill = useAnimatedStyle(() => ({ width: `${w.value * 100}%` }));
  return (
    <View style={{ height, borderRadius: height, backgroundColor: track, overflow: 'hidden' }}>
      <Animated.View style={[{ height: '100%', borderRadius: height, backgroundColor: color }, fill]} />
    </View>
  );
}

export function Pulse({ size, color = colors.brand }: { size: number; color?: string }) {
  const reduced = useReducedMotion();
  const t = useSharedValue(0);
  useEffect(() => {
    if (reduced) return;
    t.value = withRepeat(withTiming(1, { duration: 2200, easing: Easing.out(Easing.quad) }), -1, false);
  }, [reduced, t]);
  const ring = useAnimatedStyle(() => ({
    opacity: 0.35 * (1 - t.value),
    transform: [{ scale: 1 + t.value * 0.55 }],
  }));
  if (reduced) return null;
  return (
    <Animated.View
      pointerEvents="none"
      style={[{ position: 'absolute', width: size, height: size, borderRadius: size / 2, backgroundColor: color }, ring]}
    />
  );
}

/** Line sweeping top-to-bottom inside its parent (parent sets the size). */
export function ScanLine({ active }: { active: boolean }) {
  const reduced = useReducedMotion();
  const y = useSharedValue(0);
  const [h, setH] = useState(0);
  useEffect(() => {
    if (!active || reduced || !h) return;
    y.value = 0;
    y.value = withRepeat(
      withSequence(
        withTiming(h, { duration: 1500, easing: Easing.inOut(Easing.quad) }),
        withTiming(0, { duration: 1500, easing: Easing.inOut(Easing.quad) }),
      ),
      -1,
    );
  }, [active, reduced, h, y]);
  const line = useAnimatedStyle(() => ({ transform: [{ translateY: y.value }] }));
  if (!active) return null;
  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none" onLayout={(e) => setH(e.nativeEvent.layout.height)}>
      <Animated.View style={[styles.scan, line]}>
        <View style={styles.scanGlow} />
        <View style={styles.scanCore} />
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  scan: { position: 'absolute', left: 0, right: 0, top: -14, height: 28, justifyContent: 'center' },
  scanGlow: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(160,230,170,0.18)' },
  scanCore: { height: 2, backgroundColor: 'rgba(200,255,205,0.95)', shadowColor: '#9fe8a8', shadowOpacity: 1, shadowRadius: 8 },
});
