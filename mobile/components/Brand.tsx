import { View } from 'react-native';
import Svg, { Circle, Path } from 'react-native-svg';

import { Text } from '@/components/ui/Text';
import { colors, fonts } from '@/constants/theme';

/** The AgroSense leaf mark, drawn as vector so it's crisp at any size. */
export function LogoMark({ size = 36, inverse = false }: { size?: number; inverse?: boolean }) {
  const bg = inverse ? colors.white : colors.brand;
  const fg = inverse ? colors.brand : colors.white;
  return (
    <Svg width={size} height={size} viewBox="0 0 48 48" accessibilityLabel="AgroSense">
      <Circle cx={24} cy={24} r={24} fill={bg} />
      <Path
        d="M24 10c-6.5 4.2-9.5 9.6-9 15.4.4 5 4.2 9.1 9 9.6 4.8-.5 8.6-4.6 9-9.6.5-5.8-2.5-11.2-9-15.4z"
        fill={fg}
        opacity={0.95}
      />
      <Path d="M24 15v24" stroke={bg} strokeWidth={1.8} strokeLinecap="round" />
      <Path d="M24 24l-4.5-3.5M24 29.5l5-4" stroke={bg} strokeWidth={1.6} strokeLinecap="round" />
    </Svg>
  );
}

export function Wordmark({ inverse = false, size = 20 }: { inverse?: boolean; size?: number }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
      <LogoMark size={size + 8} inverse={inverse} />
      <Text
        style={{ fontFamily: fonts.display, fontSize: size, letterSpacing: -0.4 }}
        color={inverse ? colors.white : colors.ink}
      >
        AgroSense
      </Text>
    </View>
  );
}
