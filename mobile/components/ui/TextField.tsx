import { Feather } from '@expo/vector-icons';
import { forwardRef, ReactNode, useState } from 'react';
import { Pressable, StyleSheet, TextInput, TextInputProps, View } from 'react-native';

import { Text } from '@/components/ui/Text';
import { colors, fonts, radius, spacing } from '@/constants/theme';

interface Props extends TextInputProps {
  label: string;
  error?: string | null;
  hint?: string;
  prefix?: ReactNode;
  secureToggle?: boolean;
}

export const TextField = forwardRef<TextInput, Props>(function TextField(
  { label, error, hint, prefix, secureToggle, secureTextEntry, style, onFocus, onBlur, ...rest },
  ref,
) {
  const [focused, setFocused] = useState(false);
  const [hidden, setHidden] = useState(true);
  const borderColor = error ? colors.danger : focused ? colors.brand : colors.hairlineStrong;

  return (
    <View style={styles.wrap}>
      <Text variant="smallStrong" color={colors.inkSoft} style={styles.label}>
        {label}
      </Text>
      <View style={[styles.field, { borderColor, borderWidth: focused || error ? 1.5 : 1 }]}>
        {prefix}
        <TextInput
          ref={ref}
          placeholderTextColor={colors.inkFaint}
          selectionColor={colors.brand}
          cursorColor={colors.brand}
          secureTextEntry={secureToggle ? hidden : secureTextEntry}
          onFocus={(e) => {
            setFocused(true);
            onFocus?.(e);
          }}
          onBlur={(e) => {
            setFocused(false);
            onBlur?.(e);
          }}
          accessibilityLabel={label}
          style={[styles.input, style]}
          {...rest}
        />
        {secureToggle ? (
          <Pressable
            onPress={() => setHidden((h) => !h)}
            hitSlop={12}
            accessibilityRole="button"
            accessibilityLabel={hidden ? 'Show password' : 'Hide password'}
            style={styles.eye}
          >
            <Feather name={hidden ? 'eye' : 'eye-off'} size={18} color={colors.inkMuted} />
          </Pressable>
        ) : null}
      </View>
      {error ? (
        <Text variant="caption" color={colors.danger} style={styles.below}>
          {error}
        </Text>
      ) : hint ? (
        <Text variant="caption" color={colors.inkMuted} style={styles.below}>
          {hint}
        </Text>
      ) : null}
    </View>
  );
});

/** Phone input with a fixed Ghana prefix; accepts 024… or 24… */
export const PhoneField = forwardRef<TextInput, Omit<Props, 'prefix'>>(function PhoneField(props, ref) {
  return (
    <TextField
      ref={ref}
      keyboardType="phone-pad"
      textContentType="telephoneNumber"
      autoComplete="tel"
      placeholder="024 412 3456"
      maxLength={16}
      prefix={
        <View style={styles.prefix}>
          <Text variant="bodyStrong" color={colors.inkSoft}>
            +233
          </Text>
          <View style={styles.prefixRule} />
        </View>
      }
      {...props}
    />
  );
});

/** What we send to the API: digits as typed, with +233 if they omitted a code. */
export function toApiPhone(input: string) {
  const s = input.replace(/[\s\-()]/g, '');
  if (!s) return s;
  if (s.startsWith('+') || s.startsWith('00') || s.startsWith('233') || s.startsWith('0')) return s;
  return `+233${s}`;
}

/** Mirrors the server's rules so most mistakes are caught before a request. */
export function validatePhone(input: string): string | null {
  const s = input.replace(/[\s\-()]/g, '');
  if (!s) return 'Enter your phone number.';
  const international = s.startsWith('+') || s.startsWith('00');
  const isGhana = !international || /^(\+|00)233/.test(s);
  if (!isGhana) {
    return /^(\+|00)\d{8,15}$/.test(s) ? null : 'Enter a valid phone number.';
  }
  const local = s.replace(/^(\+|00)?233/, '').replace(/^0/, '');
  if (!/^[235]\d{8}$/.test(local)) return 'Enter a valid Ghana number, e.g. 024 412 3456.';
  return null;
}

const styles = StyleSheet.create({
  wrap: { gap: spacing.xs + 2 },
  label: { marginLeft: 2 },
  field: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    minHeight: 54,
    paddingHorizontal: spacing.lg,
  },
  input: {
    flex: 1,
    fontFamily: fonts.regular,
    fontSize: 16,
    color: colors.ink,
    paddingVertical: 14,
  },
  eye: { paddingLeft: spacing.sm },
  prefix: { flexDirection: 'row', alignItems: 'center', marginRight: spacing.md },
  prefixRule: { width: 1, height: 22, backgroundColor: colors.hairlineStrong, marginLeft: spacing.md },
  below: { marginLeft: 2 },
});
