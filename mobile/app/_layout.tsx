import {
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
  Inter_800ExtraBold,
  useFonts,
} from '@expo-google-fonts/inter';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Stack, useRouter, useSegments } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect, useState } from 'react';
import { ActivityIndicator, View } from 'react-native';

import { colors } from '@/constants/theme';
import { useAuthStore } from '@/store/authStore';
import { configureGoogleSignIn } from '@/services/googleAuth';

SplashScreen.preventAutoHideAsync().catch(() => {});

export default function RootLayout() {
  const router = useRouter();
  const segments = useSegments();
  const { token, isInitialized, initialize, hasSeenOnboarding, farmer } = useAuthStore();
  const [queryClient] = useState(() => new QueryClient({
    defaultOptions: { queries: { retry: 1, refetchOnWindowFocus: false } },
  }));

  const [fontsLoaded] = useFonts({
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
    Inter_800ExtraBold,
  });

  useEffect(() => {
    configureGoogleSignIn();
    initialize();
  }, []);

  useEffect(() => {
    if (fontsLoaded && isInitialized) {
      SplashScreen.hideAsync().catch(() => {});
    }
  }, [fontsLoaded, isInitialized]);

  useEffect(() => {
    if (!isInitialized || !fontsLoaded) return;

    const inAuthGroup = segments[0] === '(auth)';
    const inOnboardingGroup = segments[0] === 'onboarding';
    const onCompleteProfile =
      inOnboardingGroup && segments[1] === 'complete-profile';

    // Logged in but profile incomplete → force complete-profile
    if (token && farmer && farmer.profile_complete === false) {
      if (!onCompleteProfile) {
        router.replace('/onboarding/complete-profile');
      }
      return;
    }

    // Logged in & profile complete → tabs (skip auth/onboarding screens)
    if (token && (inAuthGroup || (inOnboardingGroup && !onCompleteProfile))) {
      router.replace('/(tabs)');
      return;
    }

    // Not logged in
    if (!token) {
      // First-time user who hasn't seen onboarding → onboarding
      if (!hasSeenOnboarding && !inOnboardingGroup) {
        router.replace('/onboarding');
        return;
      }
      // Returning user who has seen onboarding → login
      if (hasSeenOnboarding && !inAuthGroup && !inOnboardingGroup) {
        router.replace('/(auth)/login');
      }
    }
  }, [token, farmer, isInitialized, fontsLoaded, hasSeenOnboarding, segments]);

  if (!isInitialized || !fontsLoaded) {
    return (
      <View style={{
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: colors.background,
      }}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
    <QueryClientProvider client={queryClient}>
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="(auth)" />
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="onboarding" />
      </Stack>
    </QueryClientProvider>
  );
}