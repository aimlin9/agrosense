import { ReactNode } from 'react';
import { KeyboardAvoidingView, Linking, Platform, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { LogoMark } from '@/components/Brand';
import { Text } from '@/components/ui/Text';
import { LEGAL } from '@/constants/options';
import { colors, spacing } from '@/constants/theme';

export function AuthShell({
  title,
  subtitle,
  children,
  footer,
}: {
  title: string;
  subtitle?: string;
  children: ReactNode;
  footer?: ReactNode;
}) {
  const insets = useSafeAreaInsets();
  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: colors.canvas }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView
        contentContainerStyle={[styles.content, { paddingTop: insets.top + spacing.xxl, paddingBottom: insets.bottom + spacing.xl }]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <LogoMark size={44} />
        <View style={{ gap: spacing.sm, marginTop: spacing.xl, marginBottom: spacing.xxl }}>
          <Text variant="title" accessibilityRole="header">
            {title}
          </Text>
          {subtitle ? (
            <Text variant="body" color={colors.inkSoft}>
              {subtitle}
            </Text>
          ) : null}
        </View>
        {children}
        <View style={{ flex: 1 }} />
        {footer}
        <LegalNote />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

export function LegalNote() {
  return (
    <Text variant="caption" color={colors.inkMuted} align="center" style={{ marginTop: spacing.xl, lineHeight: 18 }}>
      By continuing you agree to our{' '}
      <Text variant="caption" color={colors.inkSoft} style={styles.link} onPress={() => Linking.openURL(LEGAL.terms)}>
        Terms
      </Text>{' '}
      and{' '}
      <Text variant="caption" color={colors.inkSoft} style={styles.link} onPress={() => Linking.openURL(LEGAL.privacy)}>
        Privacy Policy
      </Text>
      .
    </Text>
  );
}

export function OrDivider() {
  return (
    <View style={styles.divider}>
      <View style={styles.rule} />
      <Text variant="caption" color={colors.inkMuted}>
        or
      </Text>
      <View style={styles.rule} />
    </View>
  );
}

const styles = StyleSheet.create({
  content: { flexGrow: 1, paddingHorizontal: spacing.gutter + 4 },
  link: { textDecorationLine: 'underline' },
  divider: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, marginVertical: spacing.xl },
  rule: { flex: 1, height: StyleSheet.hairlineWidth, backgroundColor: colors.hairlineStrong },
});
