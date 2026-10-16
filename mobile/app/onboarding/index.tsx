import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useRef, useState } from 'react';
import {
  FlatList,
  ImageBackground,
  NativeScrollEvent,
  NativeSyntheticEvent,
  Pressable,
  StyleSheet,
  useWindowDimensions,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Wordmark } from '@/components/Brand';
import { Button } from '@/components/ui/Button';
import { Text } from '@/components/ui/Text';
import { colors, fonts, radius, spacing } from '@/constants/theme';
import { useAuthStore } from '@/store/authStore';

const slides = [
  {
    image: require('@/assets/onboarding/slide-1-diagnose.jpg'),
    eyebrow: 'Diagnose',
    title: 'Know what’s wrong with your crop in seconds.',
    body: 'Photograph a sick leaf. AgroSense identifies the disease and tells you what to do, organic options first.',
  },
  {
    image: require('@/assets/onboarding/slide-2-plant.jpg'),
    eyebrow: 'Plan',
    title: 'Plant, spray and harvest with the weather.',
    body: 'A 7-day forecast for your farm with advice written for the crop you grow.',
  },
  {
    image: require('@/assets/onboarding/slide-3-sell.jpg'),
    eyebrow: 'Sell',
    title: 'Know the market before you travel to it.',
    body: 'Compare prices across Kumasi, Techiman, Makola, Tamale and Kaneshie.',
  },
];

export default function OnboardingScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const markOnboardingSeen = useAuthStore((s) => s.markOnboardingSeen);
  const [index, setIndex] = useState(0);
  const listRef = useRef<FlatList>(null);
  const isLast = index === slides.length - 1;

  const onScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const i = Math.round(e.nativeEvent.contentOffset.x / width);
    if (i !== index) setIndex(i);
  };

  const goTo = (i: number) => {
    listRef.current?.scrollToIndex({ index: i, animated: true });
    setIndex(i); // momentum events don't fire for programmatic scrolls everywhere
  };

  const finish = async (to: '/(auth)/register' | '/(auth)/login') => {
    await markOnboardingSeen();
    router.replace(to);
  };

  return (
    <View style={styles.container}>
      <StatusBar style="light" />
      <FlatList
        ref={listRef}
        data={slides}
        keyExtractor={(s) => s.eyebrow}
        horizontal
        pagingEnabled
        bounces={false}
        showsHorizontalScrollIndicator={false}
        onMomentumScrollEnd={onScroll}
        getItemLayout={(_, i) => ({ length: width, offset: width * i, index: i })}
        renderItem={({ item }) => (
          <ImageBackground source={item.image} style={{ width, height }} resizeMode="cover">
            <LinearGradient
              colors={['rgba(8,24,14,0.55)', 'rgba(8,24,14,0.05)', 'rgba(8,24,14,0.55)', 'rgba(8,24,14,0.96)']}
              locations={[0, 0.25, 0.55, 1]}
              style={StyleSheet.absoluteFill}
            />
            <View style={[styles.copy, { paddingBottom: 190 + insets.bottom }]}>
              <Text variant="overline" color="rgba(255,255,255,0.75)">
                {item.eyebrow}
              </Text>
              <Text style={styles.title} color={colors.white}>
                {item.title}
              </Text>
              <Text variant="body" color="rgba(255,255,255,0.86)" style={{ fontSize: 16, lineHeight: 24 }}>
                {item.body}
              </Text>
            </View>
          </ImageBackground>
        )}
      />

      <View style={[styles.top, { paddingTop: insets.top + spacing.md }]} pointerEvents="box-none">
        <Wordmark inverse size={18} />
        {!isLast ? (
          <Pressable onPress={() => finish('/(auth)/login')} hitSlop={12} accessibilityRole="button">
            <Text variant="bodyStrong" color={colors.white}>
              Skip
            </Text>
          </Pressable>
        ) : null}
      </View>

      <View style={[styles.bottom, { paddingBottom: insets.bottom + spacing.lg }]}>
        <View style={styles.dots}>
          {slides.map((_, i) => (
            <View key={i} style={[styles.dot, i === index && styles.dotActive]} />
          ))}
        </View>
        <Button
          variant="inverse"
          label={isLast ? 'Create a free account' : 'Continue'}
          iconRight="arrow-right"
          onPress={() =>
            isLast ? finish('/(auth)/register') : goTo(index + 1)
          }
        />
        <Pressable onPress={() => finish('/(auth)/login')} style={styles.signIn} accessibilityRole="button">
          <Text variant="body" color="rgba(255,255,255,0.8)">
            Already have an account? <Text variant="bodyStrong" color={colors.white}>Sign in</Text>
          </Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.brandDeep },
  top: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.gutter + 4,
  },
  copy: { flex: 1, justifyContent: 'flex-end', paddingHorizontal: spacing.gutter + 4, gap: spacing.md },
  title: { fontFamily: fonts.display, fontSize: 34, lineHeight: 40, letterSpacing: -0.8 },
  bottom: { position: 'absolute', left: 0, right: 0, bottom: 0, paddingHorizontal: spacing.gutter + 4, gap: spacing.lg },
  dots: { flexDirection: 'row', gap: 6 },
  dot: { width: 6, height: 6, borderRadius: radius.pill, backgroundColor: 'rgba(255,255,255,0.35)' },
  dotActive: { width: 22, backgroundColor: colors.white },
  signIn: { alignItems: 'center', paddingVertical: spacing.xs },
});
