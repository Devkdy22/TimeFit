import type { ViewStyle } from 'react-native';

export type CubicBezier = readonly [number, number, number, number];

export const colorPalette = {
  mint: {
    500: '#58C7C2',
    600: '#46A9A5',
  },
  orange: {
    500: '#FF9F43',
    600: '#E47F1F',
  },
  red: {
    500: '#FF5D73',
    600: '#E63A52',
  },
  slate: {
    0: '#FFFFFF',
    50: '#F4F7FB',
    100: '#E8EEF7',
    300: '#A8B3C7',
    700: '#2A3448',
    800: '#161F33',
    900: '#0B1220',
    950: '#070C16',
  },
  sky: {
    500: '#6AB8FF',
  },
} as const;

export const spacingScale = {
  none: 0,
  xxs: 2,
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  xxxl: 32,
  jumbo: 40,
} as const;

export const radiusScale = {
  none: 0,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  full: 999,
} as const;

export const borderWidth = {
  none: 0,
  thin: 1,
  thick: 2,
} as const;

const shadowColor = '#000000';

export const elevationScale: Record<'none' | 'sm' | 'md' | 'lg', ViewStyle> = {
  none: {
    shadowColor,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0,
    shadowRadius: 0,
    elevation: 0,
  },
  sm: {
    shadowColor,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 2,
  },
  md: {
    shadowColor,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 4,
  },
  lg: {
    shadowColor,
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.1,
    shadowRadius: 18,
    elevation: 7,
  },
};

export const motion = {
  duration: {
    instant: 0,
    fast: 200,
    normal: 280,
    slow: 360,
    statusShift: 340,
  },
  easing: {
    standard: [0.42, 0, 0.58, 1] as CubicBezier,
    emphasized: [0.42, 0, 0.58, 1] as CubicBezier,
    exit: [0.42, 0, 0.58, 1] as CubicBezier,
  },
} as const;

export const font = {
  family: {
    regular: 'System',
    medium: 'System',
    semibold: 'System',
    bold: 'System',
  },
  weight: {
    regular: '400',
    medium: '500',
    semibold: '600',
    bold: '700',
  },
  size: {
    caption: 12,
    body: 16,
    bodyLg: 18,
    title: 26,
    display: 34,
  },
  lineHeight: {
    caption: 16,
    body: 22,
    bodyLg: 26,
    title: 32,
    display: 40,
  },
} as const;
