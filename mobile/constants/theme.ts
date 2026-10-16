/**
 * AgroSense design tokens — the single source of truth for colour, type,
 * spacing and elevation. Screens never hardcode these values.
 *
 * Direction: warm paper canvas, one deep forest brand colour, earthy status
 * colours. Fraunces (serif) for display moments, Inter for everything else.
 */

export const colors = {
  // Brand
  brand: '#0F5427',
  brandDeep: '#0A3A1B',
  brandSoft: '#2F7A47',
  brandTint: '#E4EDE3',
  brandTintStrong: '#CFE0CD',

  // Canvas & surfaces
  canvas: '#F5F3EC',
  surface: '#FFFFFF',
  surfaceSunken: '#EDEAE1',
  surfaceInverse: '#14201A',

  // Ink
  ink: '#16201A',
  inkSoft: '#46524A',
  inkMuted: '#7B857E',
  inkFaint: '#A9B0A9',
  inkInverse: '#F5F3EC',

  // Lines
  hairline: '#E3DFD4',
  hairlineStrong: '#CFCABD',

  // Status — earthy, not traffic-light
  danger: '#B4432F',
  dangerTint: '#F6E3DE',
  warning: '#B97412',
  warningTint: '#F7EAD3',
  success: '#2F7A47',
  successTint: '#E4EDE3',
  info: '#2E5E7E',
  infoTint: '#E1EBF1',

  // Accent for weather / sun moments
  sun: '#D69A2D',

  scrim: 'rgba(10, 20, 14, 0.55)',
  white: '#FFFFFF',
  black: '#000000',
} as const;

export const fonts = {
  display: 'Fraunces_600SemiBold',
  displayItalic: 'Fraunces_500Medium_Italic',
  displayRegular: 'Fraunces_400Regular',
  bold: 'Inter_700Bold',
  semibold: 'Inter_600SemiBold',
  medium: 'Inter_500Medium',
  regular: 'Inter_400Regular',
} as const;

/** Type scale. Display sizes use Fraunces; the rest use Inter. */
export const type = {
  hero: { fontFamily: fonts.display, fontSize: 40, lineHeight: 44, letterSpacing: -1 },
  title: { fontFamily: fonts.display, fontSize: 30, lineHeight: 36, letterSpacing: -0.6 },
  heading: { fontFamily: fonts.display, fontSize: 22, lineHeight: 28, letterSpacing: -0.3 },
  subheading: { fontFamily: fonts.semibold, fontSize: 17, lineHeight: 22, letterSpacing: -0.2 },
  body: { fontFamily: fonts.regular, fontSize: 15, lineHeight: 22 },
  bodyStrong: { fontFamily: fonts.semibold, fontSize: 15, lineHeight: 22 },
  small: { fontFamily: fonts.regular, fontSize: 13, lineHeight: 18 },
  smallStrong: { fontFamily: fonts.semibold, fontSize: 13, lineHeight: 18 },
  caption: { fontFamily: fonts.medium, fontSize: 12, lineHeight: 16 },
  overline: {
    fontFamily: fonts.semibold,
    fontSize: 11,
    lineHeight: 14,
    letterSpacing: 1.1,
    textTransform: 'uppercase' as const,
  },
} as const;

export const spacing = {
  xxs: 2,
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 28,
  xxxl: 40,
  gutter: 20,
} as const;

export const radius = {
  xs: 6,
  sm: 10,
  md: 14,
  lg: 18,
  xl: 24,
  pill: 999,
} as const;

export const shadows = {
  none: {},
  soft: {
    shadowColor: '#1D2A21',
    shadowOpacity: 0.06,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
  },
  raised: {
    shadowColor: '#1D2A21',
    shadowOpacity: 0.12,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 8 },
    elevation: 6,
  },
} as const;

export const hitSlop = { top: 10, bottom: 10, left: 10, right: 10 } as const;

export type Severity = 'none' | 'low' | 'moderate' | 'high' | string | null | undefined;

export function severityStyle(severity: Severity) {
  switch ((severity ?? '').toLowerCase()) {
    case 'high':
      return { label: 'Severe', fg: colors.danger, bg: colors.dangerTint };
    case 'moderate':
      return { label: 'Moderate', fg: colors.warning, bg: colors.warningTint };
    case 'low':
      return { label: 'Mild', fg: colors.success, bg: colors.successTint };
    case 'none':
      return { label: 'Healthy', fg: colors.success, bg: colors.successTint };
    default:
      return { label: 'Unrated', fg: colors.inkSoft, bg: colors.surfaceSunken };
  }
}
