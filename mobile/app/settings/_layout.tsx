import { Stack } from 'expo-router';

import { colors, fonts } from '@/constants/theme';

export default function SettingsLayout() {
  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: colors.background },
        headerTitleStyle: {
          fontFamily: fonts.bold,
          fontSize: 17,
          color: colors.textPrimary,
        },
        headerTintColor: colors.primary,
        headerShadowVisible: false,
      }}
    />
  );
}