import { Feather } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { useRef, useState } from 'react';
import {
  Dimensions,
  FlatList,
  ImageBackground,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  ViewToken,
} from 'react-native';

import { colors, fonts, radius, shadows, spacing } from '@/constants/theme';
import { useAuthStore } from '@/store/authStore';

const { width: SCREEN_W } = Dimensions.get('window');

interface Slide {
  image: any;
  title: string;
  body: string;
}

const slides: Slide[] = [
  {
    image: require('@/assets/onboarding/slide-1-diagnose.jpg'),
    title: 'Diagnose in 4 seconds',
    body: 'Photograph any sick crop. Our AI identifies 38 disease classes across 14 crops with treatment advice in seconds.',
  },
  {
    image: require('@/assets/onboarding/slide-2-plant.jpg'),
    title: 'Plant when it pays',
    body: 'Get 7-day weather forecasts and AI-powered planting advisories tailored to your crop and region.',
  },
  {
    image: require('@/assets/onboarding/slide-3-sell.jpg'),
    title: 'Sell at the right price',
    body: 'Live market prices from Kumasi, Techiman, Makola, Tamale, Kaneshie. Know before you sell.',
  },
];

export default function OnboardingScreen() {
  const router = useRouter();
  const { markOnboardingSeen } = useAuthStore();
  const [activeIndex, setActiveIndex] = useState(0);
  const flatListRef = useRef<FlatList<Slide>>(null);

  const onViewableItemsChanged = useRef(
    ({ viewableItems }: { viewableItems: ViewToken[] }) => {
      const idx = viewableItems[0]?.index;
      if (typeof idx === 'number') setActiveIndex(idx);
    },
  ).current;

  const goNext = async () => {
    if (activeIndex < slides.length - 1) {
      flatListRef.current?.scrollToIndex({ index: activeIndex + 1 });
    } else {
      await markOnboardingSeen();
      router.replace('/(auth)/register');
    }
  };

  const skip = async () => {
    await markOnboardingSeen();
    router.replace('/(auth)/login');
  };

  const isLast = activeIndex === slides.length - 1;

  return (
    <View style={styles.container}>
      {/* Top bar floats over the photo */}
      <View style={styles.topBar}>
        <Text style={styles.brand}>🌱 AgroSense</Text>
        {!isLast && (
          <TouchableOpacity onPress={skip} hitSlop={12}>
            <Text style={styles.skip}>Skip</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Carousel */}
      <FlatList
        ref={flatListRef}
        data={slides}
        keyExtractor={(item) => item.title}
        renderItem={({ item }) => <SlideView slide={item} />}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onViewableItemsChanged={onViewableItemsChanged}
        viewabilityConfig={{ itemVisiblePercentThreshold: 50 }}
      />

      {/* Dots */}
      <View style={styles.dots}>
        {slides.map((_, i) => (
          <View
            key={i}
            style={[styles.dot, i === activeIndex && styles.dotActive]}
          />
        ))}
      </View>

      {/* CTA */}
      <View style={styles.ctaWrap}>
        <TouchableOpacity
          style={styles.cta}
          onPress={goNext}
          activeOpacity={0.85}
        >
          <Text style={styles.ctaText}>
            {isLast ? 'Get started' : 'Next'}
          </Text>
          <Feather name="arrow-right" size={18} color={colors.primaryDark} />
        </TouchableOpacity>

        {isLast && (
          <TouchableOpacity onPress={skip} style={styles.signInLink}>
            <Text style={styles.signInText}>
              Already have an account?{' '}
              <Text style={styles.signInBold}>Sign in</Text>
            </Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}

function SlideView({ slide }: { slide: Slide }) {
  return (
    <ImageBackground
      source={slide.image}
      style={[styles.slide, { width: SCREEN_W }]}
      imageStyle={styles.slideImage}
    >
      {/* Gradient overlay — transparent at top, dark green at bottom */}
      <LinearGradient
        colors={[
          'rgba(15, 84, 39, 0.15)',
          'rgba(15, 84, 39, 0.55)',
          'rgba(15, 84, 39, 0.92)',
        ]}
        locations={[0, 0.55, 1]}
        style={StyleSheet.absoluteFill}
      />
      {/* Text content sits at the bottom */}
      <View style={styles.slideContent}>
        <Text style={styles.title}>{slide.title}</Text>
        <Text style={styles.body}>{slide.body}</Text>
      </View>
    </ImageBackground>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0f5427',
  },
  topBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.xl,
    paddingTop: 60,
    paddingBottom: spacing.md,
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 10,
  },
  brand: {
    fontSize: 16,
    fontFamily: fonts.bold,
    color: 'white',
    letterSpacing: -0.3,
    textShadowColor: 'rgba(0, 0, 0, 0.4)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
  },
  skip: {
    fontSize: 14,
    fontFamily: fonts.semibold,
    color: 'white',
    textShadowColor: 'rgba(0, 0, 0, 0.4)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
  },
  slide: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  slideImage: {
    resizeMode: 'cover',
  },
  slideContent: {
    paddingHorizontal: spacing.xxl,
    paddingBottom: spacing.xxxl,
  },
  title: {
    fontSize: 32,
    fontFamily: fonts.display,
    color: 'white',
    letterSpacing: -0.6,
    marginBottom: spacing.md,
    lineHeight: 38,
  },
  body: {
    fontSize: 15,
    fontFamily: fonts.regular,
    color: 'rgba(255, 255, 255, 0.92)',
    lineHeight: 22,
  },
  dots: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.lg,
    backgroundColor: '#0f5427',
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: 'rgba(255, 255, 255, 0.4)',
  },
  dotActive: {
    backgroundColor: 'white',
    width: 24,
  },
  ctaWrap: {
    paddingHorizontal: spacing.xl,
    paddingBottom: 40,
    backgroundColor: '#0f5427',
  },
  cta: {
    backgroundColor: 'white',
    borderRadius: radius.lg,
    paddingVertical: spacing.lg,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    ...shadows.hero,
  },
  ctaText: {
    color: colors.primaryDark,
    fontFamily: fonts.bold,
    fontSize: 16,
    letterSpacing: -0.2,
  },
  signInLink: {
    paddingVertical: spacing.md,
    alignItems: 'center',
  },
  signInText: {
    fontSize: 14,
    fontFamily: fonts.regular,
    color: 'rgba(255, 255, 255, 0.85)',
  },
  signInBold: {
    fontFamily: fonts.bold,
    color: 'white',
  },
});