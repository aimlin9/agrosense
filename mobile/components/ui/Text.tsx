import { Text as RNText, TextProps, TextStyle } from 'react-native';

import { colors, type } from '@/constants/theme';

export type TextVariant = keyof typeof type;

interface Props extends TextProps {
  variant?: TextVariant;
  color?: string;
  align?: TextStyle['textAlign'];
  tabular?: boolean;
}

/** All text in the app goes through this so type stays on-scale. */
export function Text({ variant = 'body', color = colors.ink, align, tabular, style, ...rest }: Props) {
  return (
    <RNText
      maxFontSizeMultiplier={1.4}
      {...rest}
      style={[
        type[variant],
        { color },
        align ? { textAlign: align } : null,
        tabular ? { fontVariant: ['tabular-nums'] } : null,
        style,
      ]}
    />
  );
}
