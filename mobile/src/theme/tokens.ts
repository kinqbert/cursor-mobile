// Design tokens modelled on Cursor for iOS: warm off-white canvas, near-black ink,
// quiet grey metadata, hairline dividers, black pill primary buttons.

export const palette = {
  light: {
    background: '#F8F8F6',
    surface: '#FFFFFF',
    surfaceMuted: '#F0F0ED',
    surfacePressed: '#E9E9E5',
    text: '#1B1B1A',
    textSecondary: '#8A8A86',
    textTertiary: '#B3B3AE',
    divider: '#E6E6E1',
    border: '#E2E2DD',
    accent: '#4C79AA',
    success: '#2F8A57',
    successSoft: '#E1F0E6',
    danger: '#D24A5C',
    dangerSoft: '#F8E3E6',
    warning: '#C28A1E',
    primary: '#1C1C1B',
    onPrimary: '#FFFFFF',
    shadow: '#000000',
    scrim: 'rgba(0,0,0,0.25)',
  },
  dark: {
    background: '#0E0E0E',
    surface: '#1A1A19',
    surfaceMuted: '#222221',
    surfacePressed: '#2A2A29',
    text: '#EDEDEA',
    textSecondary: '#8E8E8A',
    textTertiary: '#5E5E5B',
    divider: '#242423',
    border: '#2C2C2A',
    accent: '#6F9BCB',
    success: '#4FB27A',
    successSoft: '#163323',
    danger: '#E8687A',
    dangerSoft: '#3A1A20',
    warning: '#D9A443',
    primary: '#EDEDEA',
    onPrimary: '#121212',
    shadow: '#000000',
    scrim: 'rgba(0,0,0,0.5)',
  },
} as const;

export type ColorName = keyof (typeof palette)['light'];
export type Colors = Record<ColorName, string>;

export const fonts = {
  regular: 'Inter_400Regular',
  medium: 'Inter_500Medium',
  semibold: 'Inter_600SemiBold',
  mono: 'monospace',
} as const;

export const space = {
  xxs: 2,
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  xxxl: 32,
} as const;

export const radius = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 22,
  pill: 999,
} as const;

export const type = {
  largeTitle: { fontFamily: fonts.medium, fontSize: 22, lineHeight: 28, letterSpacing: -0.3 },
  title: { fontFamily: fonts.medium, fontSize: 20, lineHeight: 26, letterSpacing: -0.3 },
  headline: { fontFamily: fonts.semibold, fontSize: 16, lineHeight: 22, letterSpacing: -0.1 },
  body: { fontFamily: fonts.regular, fontSize: 16, lineHeight: 23, letterSpacing: -0.1 },
  bodyMedium: { fontFamily: fonts.medium, fontSize: 16, lineHeight: 22, letterSpacing: -0.1 },
  callout: { fontFamily: fonts.regular, fontSize: 15, lineHeight: 21 },
  meta: { fontFamily: fonts.regular, fontSize: 14, lineHeight: 19 },
  section: { fontFamily: fonts.regular, fontSize: 14, lineHeight: 19 },
  caption: { fontFamily: fonts.regular, fontSize: 12, lineHeight: 16 },
  mono: { fontFamily: fonts.mono, fontSize: 13, lineHeight: 18 },
} as const;

export type TextVariant = keyof typeof type;
