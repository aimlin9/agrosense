import { Feather } from '@expo/vector-icons';
import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import * as Haptics from 'expo-haptics';
import { Tabs } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSpring, withTiming } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Pulse } from '@/components/motion';
import { Text } from '@/components/ui/Text';
import { colors, fonts, shadows, spacing } from '@/constants/theme';

const TABS: Record<string, { label: string; icon: keyof typeof Feather.glyphMap }> = {
  index: { label: 'Home', icon: 'home' },
  prices: { label: 'Market', icon: 'trending-up' },
  diagnose: { label: 'Scan', icon: 'camera' },
  weather: { label: 'Weather', icon: 'cloud' },
  history: { label: 'History', icon: 'clock' },
};

const PILL_W = 52;
const SPRING = { damping: 18, stiffness: 220, mass: 0.7 };

function TabBar({ state, navigation }: BottomTabBarProps) {
  const insets = useSafeAreaInsets();
  const [itemW, setItemW] = useState(0);
  const x = useSharedValue(0);
  const visible = useSharedValue(1);
  const activeName = state.routes[state.index]?.name;

  useEffect(() => {
    if (!itemW) return;
    x.value = withSpring(state.index * itemW + (itemW - PILL_W) / 2, SPRING);
    visible.value = withTiming(activeName === 'diagnose' ? 0 : 1, { duration: 160 });
  }, [state.index, itemW, activeName, x, visible]);

  const pill = useAnimatedStyle(() => ({ transform: [{ translateX: x.value }], opacity: visible.value }));

  return (
    <View
      style={[styles.bar, { paddingBottom: Math.max(insets.bottom, spacing.sm) }]}
      onLayout={(e) => setItemW(e.nativeEvent.layout.width / state.routes.length)}
    >
      {itemW ? <Animated.View pointerEvents="none" style={[styles.pill, pill]} /> : null}
      {state.routes.map((route, index) => {
        const meta = TABS[route.name];
        if (!meta) return null;
        const focused = state.index === index;
        const onPress = () => {
          const event = navigation.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
          if (!focused && !event.defaultPrevented) {
            Haptics.selectionAsync().catch(() => {});
            navigation.navigate(route.name);
          }
        };
        const tint = focused ? colors.brand : colors.inkMuted;

        if (route.name === 'diagnose') {
          return (
            <Pressable
              key={route.key}
              onPress={onPress}
              accessibilityRole="button"
              accessibilityLabel="Scan a plant"
              accessibilityState={{ selected: focused }}
              style={styles.item}
            >
              <View style={styles.scanWrap}>
                {!focused ? <Pulse size={52} /> : null}
                <View style={[styles.scan, focused && { backgroundColor: colors.brandDeep }]}>
                  <Feather name="camera" size={22} color={colors.white} />
                </View>
              </View>
              <Text style={[styles.label, { color: tint }]}>{meta.label}</Text>
            </Pressable>
          );
        }

        return (
          <Pressable
            key={route.key}
            onPress={onPress}
            accessibilityRole="button"
            accessibilityLabel={meta.label}
            accessibilityState={{ selected: focused }}
            style={styles.item}
          >
            <View style={styles.iconWrap}>
              <Feather name={meta.icon} size={20} color={tint} />
            </View>
            <Text style={[styles.label, { color: tint }]}>{meta.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

export default function TabsLayout() {
  return (
    <Tabs
      tabBar={(props) => <TabBar {...props} />}
      screenOptions={{ headerShown: false, sceneStyle: { backgroundColor: colors.canvas }, animation: 'shift' }}
    >
      <Tabs.Screen name="index" />
      <Tabs.Screen name="prices" />
      <Tabs.Screen name="diagnose" />
      <Tabs.Screen name="weather" />
      <Tabs.Screen name="history" />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    backgroundColor: colors.surface,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.hairline,
    paddingTop: spacing.sm,
    ...shadows.soft,
  },
  pill: {
    position: 'absolute',
    top: spacing.sm,
    left: 0,
    width: PILL_W,
    height: 30,
    borderRadius: 15,
    backgroundColor: colors.brandTint,
  },
  item: { flex: 1, alignItems: 'center', justifyContent: 'flex-end', gap: 3 },
  iconWrap: { width: 48, height: 30, alignItems: 'center', justifyContent: 'center' },
  label: { fontFamily: fonts.medium, fontSize: 11, lineHeight: 14 },
  scanWrap: { width: 52, height: 52, alignItems: 'center', justifyContent: 'center', marginTop: -22 },
  scan: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: colors.brand,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 4,
    borderColor: colors.surface,
    ...shadows.raised,
  },
});
