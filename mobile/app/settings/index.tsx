import * as Application from 'expo-application';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Alert, Linking, Platform, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { apiClient, getErrorMessage } from '@/api/client';
import { StackHeader } from '@/components/ui/Header';
import { Card, Divider, ListRow, SectionHeader } from '@/components/ui/Layout';
import { Text } from '@/components/ui/Text';
import { LEGAL } from '@/constants/options';
import { colors, fonts, spacing } from '@/constants/theme';
import { formatPhone, initials } from '@/lib/format';
import { useAuthStore } from '@/store/authStore';

export default function SettingsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const farmer = useAuthStore((s) => s.farmer);
  const logout = useAuthStore((s) => s.logout);
  const clearSession = useAuthStore((s) => s.clearSession);
  const [deleting, setDeleting] = useState(false);
  const version = `${Application.nativeApplicationVersion ?? '1.0.0'}${Application.nativeBuildVersion ? ` (${Application.nativeBuildVersion})` : ''}`;

  const feedback = async () => {
    const subject = encodeURIComponent('AgroSense feedback');
    const body = encodeURIComponent(`\n\n—\nAgroSense ${version} · ${Platform.OS} ${Platform.Version}`);
    const url = `mailto:${LEGAL.supportEmail}?subject=${subject}&body=${body}`;
    try {
      await Linking.openURL(url);
    } catch {
      Alert.alert('No email app found', `Send your feedback to ${LEGAL.supportEmail}`);
    }
  };

  const signOut = () =>
    Alert.alert('Sign out?', 'You can sign back in any time with your phone number.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Sign out', style: 'destructive', onPress: () => logout() },
    ]);

  const deleteAccount = () =>
    Alert.alert(
      'Delete your account?',
      'Your account, scan history, farm details and photos will be permanently deleted. This can’t be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete account',
          style: 'destructive',
          onPress: async () => {
            setDeleting(true);
            try {
              await apiClient.delete('/api/auth/me');
              await clearSession({ title: 'Account deleted', message: 'Your account and data have been removed.' });
            } catch (err) {
              setDeleting(false);
              Alert.alert('Couldn’t delete account', getErrorMessage(err));
            }
          },
        },
      ],
    );

  const usesPassword = farmer?.auth_provider !== 'google';

  return (
    <View style={{ flex: 1, backgroundColor: colors.canvas }}>
      <StackHeader title="Account" />
      <ScrollView contentContainerStyle={{ paddingHorizontal: spacing.gutter, paddingBottom: insets.bottom + spacing.xxxl }}>
        <Card onPress={() => router.push('/settings/edit-profile')} accessibilityLabel="Edit profile">
          <View style={styles.profile}>
            <View style={styles.avatar}>
              {farmer?.profile_picture_url ? (
                <Image source={{ uri: farmer.profile_picture_url }} style={StyleSheet.absoluteFill} />
              ) : (
                <Text style={{ fontFamily: fonts.display, fontSize: 22 }} color={colors.brand}>
                  {initials(farmer?.full_name) || 'A'}
                </Text>
              )}
            </View>
            <View style={{ flex: 1, gap: 2 }}>
              <Text variant="subheading" numberOfLines={1}>
                {farmer?.full_name || 'Your profile'}
              </Text>
              <Text variant="small" color={colors.inkMuted} numberOfLines={1}>
                {[formatPhone(farmer?.phone_number), farmer?.region].filter(Boolean).join(' · ') || 'Add your details'}
              </Text>
            </View>
            <Text variant="smallStrong" color={colors.brand}>
              Edit
            </Text>
          </View>
        </Card>

        <SectionHeader title="Account" />
        <Card padded={false}>
          <ListRow icon="map" label="My farms" detail="Fields, crops and seasons" onPress={() => router.push('/farms')} />
          <Divider inset={spacing.lg + 34 + spacing.md} />
          <ListRow icon="book-open" label="Crop guide" detail="Diseases, symptoms and treatment" onPress={() => router.push('/guide')} />
          <Divider inset={spacing.lg + 34 + spacing.md} />
          <ListRow icon="user" label="Profile & farm" detail={farmer?.primary_crop ? `Main crop: ${farmer.primary_crop}` : 'Region, crop, farm location'} onPress={() => router.push('/settings/edit-profile')} />
          <Divider inset={spacing.lg + 34 + spacing.md} />
          <ListRow
            icon="lock"
            label={usesPassword ? 'Change password' : 'Set a password'}
            detail={usesPassword ? undefined : 'Also sign in with your phone number'}
            onPress={() => router.push('/settings/password')}
          />
        </Card>

        <SectionHeader title="Support" />
        <Card padded={false}>
          <ListRow icon="message-circle" label="Send feedback" detail="Tell us what works and what doesn’t" onPress={feedback} />
          <Divider inset={spacing.lg + 34 + spacing.md} />
          <ListRow icon="globe" label="AgroSense website" onPress={() => Linking.openURL(LEGAL.website)} />
        </Card>

        <SectionHeader title="Legal" />
        <Card padded={false}>
          <ListRow icon="shield" label="Privacy policy" onPress={() => Linking.openURL(LEGAL.privacy)} />
          <Divider inset={spacing.lg + 34 + spacing.md} />
          <ListRow icon="file-text" label="Terms of service" onPress={() => Linking.openURL(LEGAL.terms)} />
        </Card>

        <SectionHeader title="Session" />
        <Card padded={false}>
          <ListRow icon="log-out" label="Sign out" onPress={signOut} showChevron={false} />
          <Divider inset={spacing.lg + 34 + spacing.md} />
          <ListRow icon="trash-2" label={deleting ? 'Deleting…' : 'Delete account'} destructive onPress={deleting ? undefined : deleteAccount} showChevron={false} />
        </Card>

        <Text variant="caption" color={colors.inkMuted} align="center" style={{ marginTop: spacing.xxl }}>
          AgroSense {version}
          {'\n'}Made in Ghana, for farmers everywhere.
        </Text>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  profile: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  avatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.brandTint,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
});
