import {
  Fraunces_400Regular,
  Fraunces_500Medium_Italic,
  Fraunces_600SemiBold,
} from '@expo-google-fonts/fraunces';
import {
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
  useFonts,
} from '@expo-google-fonts/inter';
import { QueryClientProvider } from '@tanstack/react-query';
import { Stack, useRouter, useSegments } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { warmUpServer } from '@/api/client';
import { colors } from '@/constants/theme';
import { queryClient } from '@/lib/queryClient';
import { configureGoogleSignIn } from '@/services/googleAuth';
import { useAuthStore } from '@/store/authStore';

SplashScreen.preventAutoHideAsync().catch(() => {});

function useAuthRedirect(ready: boolean) {
  const router = useRouter();
  const segments = useSegments();
  const token = useAuthStore((s) => s.token);
  const farmer = useAuthStore((s) => s.farmer);
  const hasSeenOnboarding = useAuthStore((s) => s.hasSeenOnboarding);

  useEffect(() => {
    if (!ready) return;
    const [group, child] = segments as string[];
    const inAuth = group === '(auth)';
    const inOnboarding = group === 'onboarding';
    const onCompleteProfile = inOnboarding && child === 'complete-profile';

    if (token) {
      if (farmer && farmer.profile_complete === false) {
        if (!onCompleteProfile) router.replace('/onboarding/complete-profile');
        return;
      }
      if (inAuth || (inOnboarding && !onCompleteProfile) || (onCompleteProfile && farmer?.profile_complete)) {
        router.replace('/(tabs)');
      }
      return;
    }

    if (!hasSeenOnboarding) {
      if (!inOnboarding || onCompleteProfile) router.replace('/onboarding');
      return;
    }
    if (!inAuth) router.replace('/(auth)/login');
  }, [ready, token, farmer, hasSeenOnboarding, segments, router]);
}

export default function RootLayout() {
  const isInitialized = useAuthStore((s) => s.isInitialized);
  const [fontsLoaded, fontError] = useFonts({
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
    Fraunces_400Regular,
    Fraunces_500Medium_Italic,
    Fraunces_600SemiBold,
  });
  // A font failure must never trap the user on the splash screen.
  const ready = isInitialized && (fontsLoaded || !!fontError);

  useEffect(() => {
    warmUpServer();
    configureGoogleSignIn();
    useAuthStore.getState().initialize();
  }, []);

  useEffect(() => {
    if (ready) SplashScreen.hideAsync().catch(() => {});
  }, [ready]);

  useAuthRedirect(ready);

  if (!ready) return null;

  return (
    <GestureHandlerRootView style={{ flex: 1, backgroundColor: colors.canvas }}>
      <SafeAreaProvider>
        <QueryClientProvider client={queryClient}>
          <StatusBar style="dark" />
          <Stack
            screenOptions={{
              headerShown: false,
              contentStyle: { backgroundColor: colors.canvas },
              animation: 'slide_from_right',
            }}
          >
            <Stack.Screen name="(tabs)" />
            <Stack.Screen name="(auth)" options={{ animation: 'fade' }} />
            <Stack.Screen name="onboarding" options={{ animation: 'fade' }} />
            <Stack.Screen name="diagnosis/confirm" options={{ animation: 'slide_from_bottom' }} />
            <Stack.Screen name="diagnosis/[id]" />
            <Stack.Screen name="settings" />
          </Stack>
        </QueryClientProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
