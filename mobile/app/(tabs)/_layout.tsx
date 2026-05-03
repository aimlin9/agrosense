import { Tabs } from 'expo-router';
import { Text } from 'react-native';

// Simple icon helper using emojis. Future: swap to lucide-react-native.
const TabIcon = ({ emoji, focused }: { emoji: string; focused: boolean }) => (
  <Text style={{ fontSize: focused ? 24 : 20, opacity: focused ? 1 : 0.55 }}>
    {emoji}
  </Text>
);

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: '#16a34a',
        tabBarInactiveTintColor: '#94a3b8',
        tabBarStyle: { borderTopColor: '#e2e8f0' },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Home',
          tabBarIcon: ({ focused }) => <TabIcon emoji="🏠" focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="diagnose"
        options={{
          title: 'Diagnose',
          tabBarIcon: ({ focused }) => <TabIcon emoji="🔬" focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="prices"
        options={{
          title: 'Prices',
          tabBarIcon: ({ focused }) => <TabIcon emoji="💰" focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="weather"
        options={{
          title: 'Weather',
          tabBarIcon: ({ focused }) => <TabIcon emoji="☀️" focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="history"
        options={{
          title: 'History',
          tabBarIcon: ({ focused }) => <TabIcon emoji="📋" focused={focused} />,
        }}
      />
    </Tabs>
  );
}