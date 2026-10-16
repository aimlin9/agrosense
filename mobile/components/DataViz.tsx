import { View } from 'react-native';
import Svg, { Path } from 'react-native-svg';

import { AnimatedBar } from '@/components/motion';
import { Text } from '@/components/ui/Text';
import { colors, spacing } from '@/constants/theme';

export function Sparkline({
  values,
  width = 72,
  height = 28,
  color = colors.inkSoft,
}: {
  values: number[];
  width?: number;
  height?: number;
  color?: string;
}) {
  if (values.length < 2) return <View style={{ width, height }} />;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;
  const step = width / (values.length - 1);
  const pad = 2;
  const pts = values.map((v, i) => [i * step, pad + (height - pad * 2) * (1 - (v - min) / span)]);
  const d = pts.map(([x, y], i) => `${i ? 'L' : 'M'}${x.toFixed(1)} ${y.toFixed(1)}`).join(' ');
  return (
    <Svg width={width} height={height} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <Path d={d} stroke={color} strokeWidth={1.6} fill="none" strokeLinejoin="round" strokeLinecap="round" />
    </Svg>
  );
}

/** Horizontal meter for model confidence, with an honest label. */
export function ConfidenceMeter({ value, tone }: { value: number; tone?: string }) {
  const pct = Math.round(Math.max(0, Math.min(1, value)) * 100);
  const label = pct >= 85 ? 'High confidence' : pct >= 60 ? 'Moderate confidence' : 'Low confidence';
  const color = tone ?? (pct >= 85 ? colors.brand : pct >= 60 ? colors.warning : colors.danger);
  return (
    <View
      style={{ gap: spacing.xs + 2 }}
      accessible
      accessibilityLabel={`${label}, ${pct} percent`}
    >
      <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
        <Text variant="smallStrong" color={colors.inkSoft}>
          {label}
        </Text>
        <Text variant="smallStrong" tabular>
          {pct}%
        </Text>
      </View>
      <AnimatedBar value={pct / 100} color={color} />
    </View>
  );
}
