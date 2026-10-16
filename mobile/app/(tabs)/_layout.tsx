import { Feather } from '@expo/vector-icons';
import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import * as Haptics from 'expo-haptics';
import { Tabs } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Text } from '@/components/ui/Text';
import { colors, fonts, shadows, spacing } from '@/constants/theme';

const TABS: Record<string, { label: string; icon: keyof typeof Feather.glyphMap }> = {
  index: { label: 'Home', icon: 'home' },
  prices: { label: 'Market', icon: 'trending-up' },
  diagnose: { label: 'Scan', icon: 'camera' },
  weather: { label: 'Weather', icon: 'cloud' },
  history: { label: 'History', icon: 'clock' },
};

function TabBar({ state, navigation }: BottomTabBarProps) {
  const insets = useSafeAreaInsets();
  return (
    <View style={[styles.bar, { paddingBottom: Math.max(insets.bottom, spacing.sm) }]}>
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
              <View style={[styles.scan, focused && { backgroundColor: colors.brandDeep }]}>
                <Feather name="camera" size={22} color={colors.white} />
              </View>
              <Text style={[styles.label, { color: focused ? colors.brand : colors.inkMuted }]}>{meta.label}</Text>
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
            <View style={[styles.iconWrap, focused && { backgroundColor: colors.brandTint }]}>
              <Feather name={meta.icon} size={20} color={focused ? colors.brand : colors.inkMuted} />
            </View>
            <Text style={[styles.label, { color: focused ? colors.brand : colors.inkMuted }]}>{meta.label}</Text>
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
      screenOptions={{ headerShown: false, sceneStyle: { backgroundColor: colors.canvas } }}
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
  item: { flex: 1, alignItems: 'center', justifyContent: 'flex-end', gap: 3 },
  iconWrap: { width: 48, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center' },
  label: { fontFamily: fonts.medium, fontSize: 11, lineHeight: 14 },
  scan: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: colors.brand,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: -22,
    borderWidth: 4,
    borderColor: colors.surface,
    ...shadows.raised,
  },
});
