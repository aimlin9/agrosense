/**
 * AgroSense design tokens. 
 * Single source of truth — never hardcode colors or font weights elsewhere.
 */

export const colors = {
  // Brand
  primary: '#16a34a',
  primaryDark: '#15803d',
  primaryLight: '#dcfce7',

  // Severity
  severityHigh: '#dc2626',
  severityModerate: '#f59e0b',
  severityLow: '#16a34a',
  severityNone: '#16a34a',
  severityUnknown: '#64748b',

  // Surfaces
  background: '#f8fafc',
  surface: '#ffffff',
  surfaceMuted: '#f1f5f9',

  // Text
  textPrimary: '#0f172a',
  textSecondary: '#475569',
  textTertiary: '#64748b',
  textMuted: '#94a3b8',

  // Borders
  border: '#e2e8f0',
  borderStrong: '#cbd5e1',

  // Trend
  trendUp: '#dc2626',
  trendDown: '#16a34a',
  trendStable: '#64748b',

  overlayDark: 'rgba(15, 84, 39, 0.55)', // green-tinted scrim for hero photos
} as const;

export const fonts = {
  // Use these EVERYWHERE. Never set fontWeight or fontFamily directly elsewhere.
  display: 'Inter_800ExtraBold',  // hero / page titles
  bold: 'Inter_700Bold',           // section titles, button labels
  semibold: 'Inter_600SemiBold',   // card titles, metadata emphasis
  medium: 'Inter_500Medium',       // active labels, light emphasis
  regular: 'Inter_400Regular',     // body, descriptions
} as const;

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
  xxxl: 48,
} as const;

export const radius = {
  sm: 6,
  md: 8,
  lg: 12,
  xl: 16,
  pill: 999,
} as const;

export const shadows = {
  card: {
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  elevated: {
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
  },
  hero: {
    shadowColor: colors.primary,
    shadowOpacity: 0.25,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 6 },
    elevation: 6,
  },
} as const;