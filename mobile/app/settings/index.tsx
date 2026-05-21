import { useState } from 'react';
import * as Application from 'expo-application';
import { Stack, useRouter } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import {
  ActivityIndicator,
  Alert,
  Linking,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

import { apiClient } from '@/api/client';
import { colors, fonts, radius, shadows, spacing } from '@/constants/theme';
import { useAuthStore } from '@/store/authStore';

const SHOW_GITHUB = __DEV__; // dev/portfolio builds only
const SUPPORT_EMAIL = 'oramsey609@gmail.com';
const GITHUB_URL = 'https://github.com/aimlin9/agrosense';
const PRIVACY_URL = 'https://aimlin9.github.io/agrosense/legal/privacy.html';
const TERMS_URL = 'https://aimlin9.github.io/agrosense/legal/terms.html';

export default function SettingsScreen() {
  const router = useRouter();
  const { farmer, logout } = useAuthStore();
  const [deleting, setDeleting] = useState(false);

  const handleFeedback = async () => {
    const subject = encodeURIComponent('AgroSense feedback');
    const body = encodeURIComponent(
      `\n\n---\nSent from AgroSense v${Application.nativeApplicationVersion ?? 'dev'}\nPlatform: ${Platform.OS}`,
    );
    const url = `mailto:${SUPPORT_EMAIL}?subject=${subject}&body=${body}`;
    const can = await Linking.canOpenURL(url);
    if (!can) {
      Alert.alert('No email app', `Please send your feedback to ${SUPPORT_EMAIL}`);
      return;
    }
    Linking.openURL(url);
  };

  const handleGithub = () => Linking.openURL(GITHUB_URL);
  const handlePrivacy = () => Linking.openURL(PRIVACY_URL);
  const handleTerms = () => Linking.openURL(TERMS_URL);

  const handleLogout = () => {
    Alert.alert('Log out', 'Are you sure you want to log out?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Log out', style: 'destructive', onPress: () => logout() },
    ]);
  };

  const handleDeleteAccount = () => {
    Alert.alert(
      'Delete account permanently?',
      'Your account, diagnosis history, farm plots, and all photos will be permanently deleted. This action cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete forever',
          style: 'destructive',
          onPress: async () => {
            setDeleting(true);
            try {
              await apiClient.delete('/api/auth/me');
              // logout() clears local state and redirects to the auth flow
              logout();
            } catch (err: any) {
              const msg =
                err?.response?.data?.detail ??
                'Failed to delete account. Please check your connection and try again.';
              Alert.alert('Error', msg);
              setDeleting(false);
            }
          },
        },
      ],
    );
  };

  return (
    <>
      <Stack.Screen options={{ title: 'Settings' }} />
      <ScrollView style={styles.container} contentContainerStyle={styles.content}>
        {/* Profile */}
        {/* Profile — tap to edit */}
<TouchableOpacity
  style={styles.profileCard}
  onPress={() => router.push('/settings/edit-profile')}
  activeOpacity={0.7}
>
  <View style={styles.avatar}>
    <Feather name="user" color={colors.primaryDark} size={32} />
  </View>
  <View style={{ flex: 1 }}>
    <Text style={styles.profileName} numberOfLines={1}>
      {farmer?.full_name || 'Farmer'}
    </Text>
    <Text style={styles.profilePhone}>{farmer?.phone_number}</Text>
    {farmer?.region && (
      <Text style={styles.profileMeta} numberOfLines={1}>
        📍 {farmer.region}
      </Text>
    )}
  </View>
  <Feather name="chevron-right" color={colors.textMuted} size={20} />
</TouchableOpacity>

        {/* Support */}
        <SectionHeader title="Support" />
        <View style={styles.group}>
          <Row
            icon={<Feather name="mail" color={colors.primary} size={20} />}
            label={SUPPORT_EMAIL}
            sub="Email support directly"
            onPress={handleFeedback}
          />
          {SHOW_GITHUB && (
            <>
              <Divider />
              <Row
                icon={<Feather name="github" color={colors.primary} size={20} />}
                label="GitHub"
                sub="View source code"
                onPress={handleGithub}
              />
            </>
          )}
        </View>

        {/* About */}
        <SectionHeader title="About" />
        <View style={styles.group}>
          <Row
            icon={<Feather name="info" color={colors.primary} size={20} />}
            label="Version"
            sub={Application.nativeApplicationVersion ?? 'Development'}
            chevron={false}
          />
          <Divider />
          <Row
            icon={<Feather name="shield" color={colors.primary} size={20} />}
            label="Privacy Policy"
            sub="How we handle your data"
            onPress={handlePrivacy}
          />
          <Divider />
          <Row
            icon={<Feather name="file-text" color={colors.primary} size={20} />}
            label="Terms of Service"
            sub="Rules for using AgroSense"
            onPress={handleTerms}
          />
        </View>

        {/* Account — Log out */}
        <SectionHeader title="Account" />
        <TouchableOpacity
          style={styles.logoutBtn}
          onPress={handleLogout}
          activeOpacity={0.7}
        >
          <Feather name="log-out" color={colors.severityHigh} size={18} />
          <Text style={styles.logoutText}>Log out</Text>
        </TouchableOpacity>

        {/* Danger Zone — Delete Account */}
        <SectionHeader title="Danger Zone" />
        <TouchableOpacity
          style={styles.deleteBtn}
          onPress={handleDeleteAccount}
          activeOpacity={0.7}
          disabled={deleting}
        >
          {deleting ? (
            <ActivityIndicator color={colors.severityHigh} size="small" />
          ) : (
            <Feather name="trash-2" color={colors.severityHigh} size={18} />
          )}
          <Text style={styles.deleteText}>
            {deleting ? 'Deleting…' : 'Delete account'}
          </Text>
        </TouchableOpacity>
        <Text style={styles.deleteHint}>
          Permanently removes your account, diagnosis history, plots, and photos.
        </Text>

        <Text style={styles.footer}>Made with 🌱 in Ghana</Text>
      </ScrollView>
    </>
  );
}

function SectionHeader({ title }: { title: string }) {
  return <Text style={styles.sectionHeader}>{title.toUpperCase()}</Text>;
}

function Row({
  icon,
  label,
  sub,
  onPress,
  chevron = true,
}: {
  icon: React.ReactNode;
  label: string;
  sub?: string;
  onPress?: () => void;
  chevron?: boolean;
}) {
  return (
    <TouchableOpacity
      style={styles.row}
      onPress={onPress}
      activeOpacity={0.6}
      disabled={!onPress}
    >
      <View style={styles.rowIcon}>{icon}</View>
      <View style={{ flex: 1 }}>
        <Text style={styles.rowLabel}>{label}</Text>
        {sub && <Text style={styles.rowSub}>{sub}</Text>}
      </View>
      {chevron && onPress && (
        <Feather name="chevron-right" color={colors.textMuted} size={18} />
      )}
    </TouchableOpacity>
  );
}

function Divider() {
  return <View style={styles.divider} />;
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.xl, paddingBottom: spacing.xxxl },
  profileCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    padding: spacing.lg,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    gap: spacing.md,
    ...shadows.card,
  },
  avatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  profileName: {
    fontSize: 17,
    fontFamily: fonts.bold,
    color: colors.textPrimary,
    letterSpacing: -0.3,
  },
  profilePhone: {
    fontSize: 13,
    fontFamily: fonts.medium,
    color: colors.textTertiary,
    marginTop: 2,
  },
  profileMeta: {
    fontSize: 12,
    fontFamily: fonts.regular,
    color: colors.textTertiary,
    marginTop: 2,
  },
  sectionHeader: {
    fontSize: 11,
    fontFamily: fonts.bold,
    color: colors.textTertiary,
    letterSpacing: 0.8,
    marginTop: spacing.xl,
    marginBottom: spacing.sm,
    paddingLeft: spacing.xs,
  },
  group: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
    ...shadows.card,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.md,
    gap: spacing.md,
  },
  rowIcon: {
    width: 36,
    height: 36,
    borderRadius: radius.md,
    backgroundColor: colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowLabel: {
    fontSize: 15,
    fontFamily: fonts.semibold,
    color: colors.textPrimary,
  },
  rowSub: {
    fontSize: 12,
    fontFamily: fonts.regular,
    color: colors.textTertiary,
    marginTop: 2,
  },
  divider: {
    height: 1,
    backgroundColor: colors.border,
    marginLeft: spacing.md + 36 + spacing.md,
  },
  logoutBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    gap: spacing.sm,
  },
  logoutText: {
    fontSize: 15,
    fontFamily: fonts.bold,
    color: colors.severityHigh,
  },
  deleteBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: 'rgba(220, 38, 38, 0.25)',
    gap: spacing.sm,
  },
  deleteText: {
    fontSize: 15,
    fontFamily: fonts.bold,
    color: colors.severityHigh,
  },
  deleteHint: {
    fontSize: 11,
    fontFamily: fonts.regular,
    color: colors.textTertiary,
    textAlign: 'center',
    marginTop: spacing.sm,
    paddingHorizontal: spacing.md,
  },
  footer: {
    textAlign: 'center',
    fontSize: 12,
    fontFamily: fonts.medium,
    color: colors.textMuted,
    marginTop: spacing.xxl,
  },
});