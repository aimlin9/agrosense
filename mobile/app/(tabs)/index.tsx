import { Feather } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useRef, useState } from 'react';
import {
  Alert,
  Dimensions,
  Image,
  Linking,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

import { MenuSheet } from '@/components/MenuSheet';
import { colors, fonts, radius, shadows, spacing } from '@/constants/theme';
import { useHomeData } from '@/hooks/useHomeData';
import { useAuthStore } from '@/store/authStore';


export default function HomeScreen() {
  const router = useRouter();
  const { farmer } = useAuthStore();
  const { recent, diagnosesToday, totalDiagnoses, currentWeather } = useHomeData();
  const [menuOpen, setMenuOpen] = useState(false);
  const [anchor, setAnchor] = useState({ top: 0, right: 0 });
  const menuBtnRef = useRef<View>(null);

  const openMenu = () => {
    menuBtnRef.current?.measureInWindow((x, y, width, height) => {
      // Anchor below the button, aligned to its right edge.
      // `right` from screen edge: window width minus button right edge.
      const screenW = Dimensions.get('window').width;
      const rightOffset = screenW - (x + width);
      setAnchor({ top: y + height + 8, right: rightOffset });
      setMenuOpen(true);
    });
  };

  const openFeedback = async () => {
    const SUPPORT_EMAIL = 'oramsey609@gmail.com';
    const subject = encodeURIComponent('AgroSense feedback');
    const body = encodeURIComponent(
      `\n\n---\nSent from AgroSense\nPlatform: ${Platform.OS}`,
    );
    const url = `mailto:${SUPPORT_EMAIL}?subject=${subject}&body=${body}`;
    const can = await Linking.canOpenURL(url);
    if (!can) {
      Alert.alert('No email app', `Please send your feedback to ${SUPPORT_EMAIL}`);
      return;
    }
    Linking.openURL(url);
  };

  const firstName =
    farmer?.full_name?.split(' ')[0] || farmer?.phone_number?.slice(-4) || 'farmer';
  const mostRecent = recent[0];

  return (
    <>
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
    >
      {/* Header */}
      <View style={styles.headerRow}>
        <View style={{ flex: 1 }}>
          <Text style={styles.greeting}>Hello, {firstName} 👋</Text>
          <Text style={styles.subtitle}>Ready to check your crops?</Text>
        </View>
        <TouchableOpacity
          ref={menuBtnRef}
          style={styles.menuBtn}
          onPress={openMenu}
          activeOpacity={0.7}
          hitSlop={12}
        >
          <Feather name="more-vertical" color={colors.textSecondary} size={22} />
        </TouchableOpacity>
      </View>

      {/* Stats strip */}
      <View style={styles.statsRow}>
        <StatCard
          label="Today"
          value={String(diagnosesToday)}
          accent={colors.primary}
        />
        <StatCard
          label="All time"
          value={String(totalDiagnoses)}
          accent={colors.textSecondary}
        />
        {currentWeather?.temperature_c != null && (
          <StatCard
            label="Weather"
            value={`${currentWeather.temperature_c.toFixed(0)}°`}
            accent={colors.severityModerate}
          />
        )}
      </View>

      {/* Hero CTA */}
      <TouchableOpacity
        style={styles.bigCta}
        onPress={() => router.push('/(tabs)/diagnose')}
        activeOpacity={0.85}
      >
        <Text style={styles.bigCtaEmoji}>📷</Text>
        <Text style={styles.bigCtaTitle}>Diagnose a sick plant</Text>
        <Text style={styles.bigCtaSubtitle}>Tap to take or upload a photo</Text>
      </TouchableOpacity>

      {/* Most recent diagnosis */}
      {mostRecent && (
        <>
          <Text style={styles.sectionLabel}>Most recent</Text>
          <TouchableOpacity
            style={styles.recentCard}
            onPress={() => router.push(`/diagnosis/${mostRecent.id}`)}
            activeOpacity={0.7}
          >
            <Image source={{ uri: mostRecent.image_url }} style={styles.recentThumb} />
            <View style={styles.recentBody}>
              <Text style={styles.recentCrop}>{mostRecent.crop_name}</Text>
              <Text
                style={[
                  styles.recentDisease,
                  { color: mostRecent.is_healthy ? colors.primary : colors.textPrimary },
                ]}
                numberOfLines={1}
              >
                {mostRecent.predicted_disease ?? 'Unknown'}
              </Text>
              <Text style={styles.recentMeta}>
                {Math.round(mostRecent.confidence * 100)}% ·{' '}
                {new Date(mostRecent.created_at).toLocaleDateString(undefined, {
                  month: 'short',
                  day: 'numeric',
                })}
              </Text>
            </View>
            <Text style={styles.recentChevron}>›</Text>
          </TouchableOpacity>
        </>
      )}

      {/* Shortcut grid */}
      <Text style={styles.sectionLabel}>Quick access</Text>
      <View style={styles.shortcutsRow}>
        {[
          { emoji: '💰', label: 'Prices', path: '/(tabs)/prices' as const },
          { emoji: '☀️', label: 'Weather', path: '/(tabs)/weather' as const },
          { emoji: '📋', label: 'History', path: '/(tabs)/history' as const },
        ].map((s) => (
          <TouchableOpacity
            key={s.label}
            style={styles.shortcut}
            onPress={() => router.push(s.path)}
            activeOpacity={0.7}
          >
            <Text style={styles.shortcutEmoji}>{s.emoji}</Text>
            <Text style={styles.shortcutLabel}>{s.label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Tip card */}
      <View style={styles.tipCard}>
        <Text style={styles.tipEmoji}>💡</Text>
        <Text style={styles.tipText}>
          For best results, photograph one leaf in good light, focused, and close.
        </Text>
      </View>
    </ScrollView>
    <MenuSheet
      visible={menuOpen}
      onClose={() => setMenuOpen(false)}
      anchor={anchor}
      items={[
        {
          icon: 'message-square',
          label: 'Feedback',
          onPress: openFeedback,
        },
        {
          icon: 'settings',
          label: 'Settings',
          onPress: () => router.push('/settings'),
        },
      ]}
    />
    </>
  );
}

function StatCard({
  label,
  value,
  accent,
}: {
  label: string;
  value: string;
  accent: string;
}) {
  return (
    <View style={styles.statCard}>
      <Text style={[styles.statValue, { color: accent }]}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: {
    padding: spacing.xl,
    paddingTop: 60,
    paddingBottom: spacing.xxxl,
  },
  greeting: {
    fontSize: 28,
    fontFamily: fonts.display,
    color: colors.primaryDark,
    letterSpacing: -0.5,
  },
  subtitle: {
    fontSize: 14,
    fontFamily: fonts.regular,
    color: colors.textTertiary,
    marginTop: spacing.xs,
  },
  statsRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginBottom: spacing.lg,
  },
  statCard: {
    flex: 1,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'flex-start',
  },
  statValue: {
    fontSize: 24,
    fontFamily: fonts.display,
    letterSpacing: -0.5,
  },
  statLabel: {
    fontSize: 11,
    fontFamily: fonts.semibold,
    color: colors.textTertiary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginTop: 2,
  },
  bigCta: {
    backgroundColor: colors.primary,
    borderRadius: radius.xl,
    padding: spacing.xl,
    alignItems: 'center',
    ...shadows.hero,
  },
  bigCtaEmoji: { fontSize: 48 },
  bigCtaTitle: {
    fontSize: 20,
    fontFamily: fonts.bold,
    color: 'white',
    marginTop: spacing.sm,
    letterSpacing: -0.3,
  },
  bigCtaSubtitle: {
    fontSize: 13,
    fontFamily: fonts.medium,
    color: colors.primaryLight,
    marginTop: spacing.xs,
  },
  sectionLabel: {
    fontSize: 12,
    fontFamily: fonts.bold,
    color: colors.textTertiary,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginTop: spacing.xl,
    marginBottom: spacing.sm,
  },
  recentCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: colors.border,
    ...shadows.card,
  },
  recentThumb: {
    width: 72,
    height: 72,
    backgroundColor: colors.surfaceMuted,
  },
  recentBody: {
    flex: 1,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
  },
  recentCrop: {
    fontSize: 11,
    fontFamily: fonts.semibold,
    color: colors.textTertiary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  recentDisease: {
    fontSize: 15,
    fontFamily: fonts.bold,
    marginTop: 2,
    letterSpacing: -0.2,
  },
  recentMeta: {
    fontSize: 12,
    fontFamily: fonts.medium,
    color: colors.textTertiary,
    marginTop: 4,
  },
  recentChevron: {
    fontSize: 28,
    color: colors.textMuted,
    fontFamily: fonts.regular,
    paddingRight: spacing.lg,
  },
  shortcutsRow: { flexDirection: 'row', gap: spacing.md },
  shortcut: {
    flex: 1,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.lg,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
    ...shadows.card,
  },
  shortcutEmoji: { fontSize: 28 },
  shortcutLabel: {
    fontSize: 13,
    fontFamily: fonts.semibold,
    color: colors.textPrimary,
    marginTop: spacing.xs,
  },
  tipCard: {
    flexDirection: 'row',
    backgroundColor: colors.primaryLight,
    borderRadius: radius.lg,
    padding: spacing.md,
    marginTop: spacing.xl,
    gap: spacing.sm,
    alignItems: 'flex-start',
  },
  tipEmoji: { fontSize: 18 },
  tipText: {
    flex: 1,
    fontSize: 13,
    fontFamily: fonts.medium,
    color: colors.primaryDark,
    lineHeight: 19,
  },
  headerRow: {
  flexDirection: 'row',
  alignItems: 'flex-start',
  marginBottom: spacing.lg,
},
menuBtn: {
  width: 40,
  height: 40,
  borderRadius: 20,
  alignItems: 'center',
  justifyContent: 'center',
  backgroundColor: colors.surface,
  borderWidth: 1,
  borderColor: colors.border,
  marginTop: spacing.xs,
},
});